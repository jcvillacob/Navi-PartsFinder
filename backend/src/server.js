const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const db = require("./database");
const {
  PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  INVENTORY_SYNC_TOKEN,
  ALLOWED_ORIGINS,
} = require("./config");
const { requireAuth, requireRole } = require("./middleware/auth");
const {
  getInventoryDetail,
  replaceInventorySnapshot,
  upsertInventorySnapshot,
} = require("./services/inventory.service");
const {
  ensureBucket,
  uploadObject,
  getObject,
  deleteObjects,
  bucket: imageBucket,
} = require("./services/image-storage.service");
const { processImageVariants } = require("./services/image-processing.service");

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.length === 0) {
        return callback(null, true);
      }

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no permitido por CORS"));
    },
  }),
);
app.use(express.json({ limit: "50mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    const isValidMime = allowedMimeTypes.includes(file.mimetype);
    if (isValidMime) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, gif, webp)"));
    }
  },
});

const ALLOWED_ROLES = ["admin", "importer", "viewer"];

function sanitizePartNumber(partNumber) {
  return String(partNumber || "").replace(/[^a-zA-Z0-9-_]/g, "_");
}

function buildPrivateImageUrl(partNumber, imageId, variant = "medium") {
  return `/api/parts/${encodeURIComponent(partNumber)}/image?variant=${variant}&v=${imageId}`;
}

function sanitizeExcelCellValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${value}`;
  }

  return value;
}

function sanitizeRowsForExcel(rows) {
  return rows.map((row) => {
    const sanitized = {};
    for (const [key, value] of Object.entries(row)) {
      sanitized[key] = sanitizeExcelCellValue(value);
    }
    return sanitized;
  });
}

function buildExportFilename() {
  const now = new Date();
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
  return `navi-parts-data-${iso}.xlsx`;
}

function requireInventorySyncToken(req, res, next) {
  const providedToken =
    req.headers["x-inventory-sync-token"] ||
    req.headers["x-sync-token"] ||
    req.query.token;

  if (!providedToken) {
    return res.status(401).json({ error: "Token de sincronización requerido" });
  }

  if (providedToken !== INVENTORY_SYNC_TOKEN) {
    return res.status(403).json({ error: "Token de sincronización inválido" });
  }

  return next();
}

// Función helper para registrar logs
async function logActivity(userId, username, actionType, details, req) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    await db.run(
      `INSERT INTO activity_logs (user_id, username, action_type, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, username, actionType, JSON.stringify(details), ipAddress],
    );
  } catch (error) {
    console.error("Error al registrar actividad:", error);
    // No fallamos la request principal si el log falla
  }
}

// Autenticacion
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "username y password son requeridos" });
    }

    const user = await db.get(
      "SELECT id, username, password_hash, role, name FROM users WHERE username = $1",
      [username],
    );

    if (!user) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    // Registrar Login Exitoso de forma asíncrona
    logActivity(user.id, user.username, "LOGIN", { success: true }, req);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    name: req.user.name,
  });
});

// Usuarios (solo admin)
app.get("/api/users", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const users = await db.all(
      "SELECT id, username, role, name, created_at, updated_at FROM users ORDER BY id",
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/users",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { username, password, role, name } = req.body || {};

      if (!username || !password || !role || !name) {
        return res
          .status(400)
          .json({ error: "username, password, role y name son requeridos" });
      }

      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: "Rol no valido" });
      }

      const existing = await db.get(
        "SELECT id FROM users WHERE username = $1",
        [username],
      );
      if (existing) {
        return res.status(409).json({ error: "Usuario ya existe" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await db.run(
        `INSERT INTO users (username, password_hash, role, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
        [username, passwordHash, role, name],
      );

      return res.status(201).json({ id: result.lastID });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
);

app.put(
  "/api/users/:id",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { username, password, role, name } = req.body || {};

      if (!userId) {
        return res.status(400).json({ error: "Id invalido" });
      }

      if (role && !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: "Rol no valido" });
      }

      const updates = [];
      const params = [];
      let idx = 1;

      if (username) {
        updates.push(`username = $${idx++}`);
        params.push(username);
      }

      if (name) {
        updates.push(`name = $${idx++}`);
        params.push(name);
      }

      if (role) {
        updates.push(`role = $${idx++}`);
        params.push(role);
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${idx++}`);
        params.push(passwordHash);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No hay campos para actualizar" });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(userId);

      await db.run(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`,
        params,
      );

      return res.json({ ok: true });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Usuario ya existe" });
      }
      return res.status(500).json({ error: error.message });
    }
  },
);

// Exportar datos en Excel (solo admin)
app.get(
  "/api/admin/data/export",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const [parts, compatibilities, inventory, images] = await Promise.all([
        db.all(
          `SELECT
             id,
             part_number,
             description,
             response_brand,
             image_url,
             created_at
           FROM parts
           ORDER BY id`,
        ),
        db.all(
          `SELECT
             pc.id,
             p.part_number,
             pc.compatible_part_number,
             pc.equipment_model,
             pc.original_brand,
             pc.created_at
           FROM part_compatibilities pc
           JOIN parts p ON p.id = pc.part_id
           ORDER BY p.part_number, pc.id`,
        ),
        db.all(
          `SELECT
             part_number,
             zona,
             sede,
             almacen,
             cantidad,
             costo_unitario,
             source_updated_at,
             synced_at
           FROM inventory_availability
           ORDER BY part_number, zona, sede, almacen`,
        ),
        db.all(
          `SELECT
             pi.id,
             p.part_number,
             pi.storage_provider,
             pi.bucket,
             pi.object_key_medium,
             pi.object_key_thumb,
             pi.content_type,
             pi.size_bytes,
             pi.width,
             pi.height,
             pi.checksum_sha256,
             pi.is_primary,
             pi.created_at,
             pi.deleted_at
           FROM part_images pi
           JOIN parts p ON p.id = pi.part_id
           ORDER BY p.part_number, pi.id`,
        ),
      ]);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(sanitizeRowsForExcel(parts)),
        "parts",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(sanitizeRowsForExcel(compatibilities)),
        "compatibilities",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(sanitizeRowsForExcel(inventory)),
        "inventory",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(sanitizeRowsForExcel(images)),
        "images",
      );

      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
      const filename = buildExportFilename();

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);

      if (req.user) {
        logActivity(
          req.user.id,
          req.user.username,
          "UPLOAD",
          {
            type: "ADMIN_EXPORT_DATA",
            stats: {
              parts: parts.length,
              compatibilities: compatibilities.length,
              inventory: inventory.length,
              images: images.length,
            },
          },
          req,
        );
      }
    } catch (error) {
      console.error("Error exportando datos:", error);
      res.status(500).json({ error: "Error exportando datos" });
    }
  },
);

// Reiniciar datos de la base (sin usuarios, solo admin)
app.post(
  "/api/admin/data/reset",
  requireAuth,
  requireRole(["admin"]),
  async (req, res) => {
    const client = await db.pool.connect();

    try {
      const counts = await db.get(
        `SELECT
           (SELECT COUNT(*)::int FROM parts) AS parts,
           (SELECT COUNT(*)::int FROM part_compatibilities) AS compatibilities,
           (SELECT COUNT(*)::int FROM part_images) AS images,
           (SELECT COUNT(*)::int FROM inventory_availability) AS inventory,
           (SELECT COUNT(*)::int FROM activity_logs) AS activity_logs`,
      );

      const imageKeysRows = await db.all(
        `SELECT object_key_original, object_key_medium, object_key_thumb
         FROM part_images`,
      );

      const objectKeys = [
        ...new Set(
          imageKeysRows
            .flatMap((row) => [
              row.object_key_original,
              row.object_key_medium,
              row.object_key_thumb,
            ])
            .filter(Boolean),
        ),
      ];

      await client.query("BEGIN");
      await client.query(
        `TRUNCATE TABLE
           part_images,
           part_compatibilities,
           inventory_availability,
           activity_logs,
           parts
         RESTART IDENTITY CASCADE`,
      );
      await client.query("COMMIT");

      let deletedObjects = 0;
      let objectCleanupWarning = null;
      if (objectKeys.length > 0) {
        try {
          await deleteObjects(objectKeys);
          deletedObjects = objectKeys.length;
        } catch (cleanupError) {
          objectCleanupWarning =
            "Datos eliminados de la base, pero no fue posible limpiar todos los objetos en S3";
          console.error(
            "Error limpiando objetos de imágenes en S3:",
            cleanupError.message,
          );
        }
      }

      return res.json({
        ok: true,
        message: "Datos reiniciados correctamente",
        deleted: {
          ...counts,
          deletedObjects,
        },
        warning: objectCleanupWarning,
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Error haciendo rollback de reset:", rollbackError.message);
      }
      console.error("Error reiniciando datos:", error);
      return res.status(500).json({ error: "Error reiniciando datos" });
    } finally {
      client.release();
    }
  },
);
// Endpoint de búsqueda
app.get("/api/search", requireAuth, async (req, res) => {
  try {
    const searchQuery = req.query.q;
    let compatibilities;

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;

      const matchingParts = await db.all(
        `SELECT DISTINCT part_number
         FROM v_parts_search
         WHERE part_number ILIKE $1
         OR compatible_part_number ILIKE $1
         OR equipment_model ILIKE $1`,
        [searchPattern],
      );

      if (matchingParts.length === 0) {
        return res.json([]);
      }

      const partNumbers = [...new Set(matchingParts.map((p) => p.part_number))];

      // Crear placeholders para PostgreSQL ($1, $2, $3...)
      const placeholders = partNumbers.map((_, i) => `$${i + 1}`).join(",");

      const recursiveQuery = `
        WITH RECURSIVE compatibility_network AS (
          SELECT DISTINCT part_number, 0 as depth
          FROM v_parts_search
          WHERE part_number IN (${placeholders})

          UNION

          SELECT DISTINCT v.part_number, cn.depth + 1
          FROM v_parts_search v
          INNER JOIN compatibility_network cn
            ON v.compatible_part_number = cn.part_number
          WHERE cn.depth < 2
        )
        SELECT DISTINCT v.*
        FROM v_parts_search v
        INNER JOIN compatibility_network cn ON v.part_number = cn.part_number
        ORDER BY v.part_number
      `;

      compatibilities = await db.all(recursiveQuery, partNumbers);
    } else {
      compatibilities = await db.all(
        "SELECT * FROM v_parts_search ORDER BY part_number",
      );
    }

    const mapped = compatibilities.map((c) => ({
      partNumber: c.part_number,
      description: c.description,
      compatiblePart: c.compatible_part_number,
      equipment: c.equipment_model,
      brand: c.original_brand,
      spareBrand: c.response_brand,
    }));

    res.json(mapped);

    // Registrar Búsqueda
    if (searchQuery && req.user) {
      logActivity(
        req.user.id,
        req.user.username,
        "SEARCH",
        { query: searchQuery, resultsCount: mapped.length },
        req,
      );
    }
  } catch (error) {
    console.error("Error en búsqueda:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalles de una parte
app.get("/api/parts/:partNumber", requireAuth, async (req, res) => {
  try {
    const { partNumber } = req.params;

    let part = await db.get("SELECT * FROM parts WHERE part_number = $1", [
      partNumber,
    ]);

    if (!part) {
      part = await db.get(
        `SELECT p.*
         FROM parts p
         JOIN part_compatibilities pc ON p.id = pc.part_id
         WHERE pc.compatible_part_number = $1
         LIMIT 1`,
        [partNumber],
      );
    }

    if (!part) {
      const searchPattern = `%${partNumber}%`;
      part = await db.get(
        `SELECT DISTINCT p.*
         FROM parts p
         LEFT JOIN part_compatibilities pc ON p.id = pc.part_id
         WHERE p.part_number ILIKE $1
         OR pc.compatible_part_number ILIKE $1
         LIMIT 1`,
        [searchPattern],
      );
    }

    if (!part) {
      return res.status(404).json({ error: "Part not found" });
    }

    const primaryImage = await db.get(
      `SELECT id
       FROM part_images
       WHERE part_id = $1
         AND is_primary = TRUE
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [part.id],
    );

    const imageUrl = primaryImage
      ? buildPrivateImageUrl(part.part_number, primaryImage.id, "medium")
      : null;

    res.json({
      partNumber: part.part_number,
      description: part.description,
      brand: part.response_brand,
      category: "General",
      stock: 0,
      imageUrl,
    });
  } catch (error) {
    console.error("Error obteniendo parte:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener sugerencias para autocompletado
app.get("/api/suggestions", requireAuth, async (req, res) => {
  try {
    const searchQuery = req.query.q;

    if (!searchQuery || searchQuery.length < 3) {
      return res.json([]);
    }

    const searchPattern = `%${searchQuery}%`;
    const suggestions = [];
    const seen = new Set();

    const partNumbers = await db.all(
      `SELECT DISTINCT part_number, description
       FROM parts
       WHERE part_number ILIKE $1
       LIMIT 5`,
      [searchPattern],
    );

    partNumbers.forEach((p) => {
      if (!seen.has(p.part_number)) {
        suggestions.push({
          value: p.part_number,
          label: p.description,
          type: "part",
        });
        seen.add(p.part_number);
      }
    });

    const compatibleParts = await db.all(
      `SELECT DISTINCT pc.compatible_part_number, pc.equipment_model, p.part_number
       FROM part_compatibilities pc
       JOIN parts p ON pc.part_id = p.id
       WHERE pc.compatible_part_number ILIKE $1
       LIMIT 5`,
      [searchPattern],
    );

    compatibleParts.forEach((c) => {
      if (!seen.has(c.compatible_part_number)) {
        suggestions.push({
          value: c.compatible_part_number,
          label: `Compatible con ${c.part_number} - ${c.equipment_model}`,
          type: "compatible",
        });
        seen.add(c.compatible_part_number);
      }
    });

    const equipment = await db.all(
      `SELECT DISTINCT pc.equipment_model, p.part_number, p.description
       FROM part_compatibilities pc
       JOIN parts p ON pc.part_id = p.id
       WHERE pc.equipment_model ILIKE $1
       LIMIT 5`,
      [searchPattern],
    );

    equipment.forEach((e) => {
      if (!seen.has(e.equipment_model)) {
        suggestions.push({
          value: e.equipment_model,
          label: `${e.part_number} - ${e.description}`,
          type: "equipment",
        });
        seen.add(e.equipment_model);
      }
    });

    res.json(suggestions.slice(0, 10));
  } catch (error) {
    console.error("Error en sugerencias:", error);
    res.status(500).json({ error: error.message });
  }
});

// Importar compatibilidades
app.post(
  "/api/compatibilities/import",
  requireAuth,
  requireRole(["admin", "importer"]),
  async (req, res) => {
    try {
      const items = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Se esperaba un array de items" });
      }

      let newParts = 0;
      let updatedParts = 0;
      let newCompatibilities = 0;

      for (const item of items) {
        const partNumber = item.partNumber || "NAV81N6-26601";
        const description = item.description || "CADENA (SIN ZAPATAS)";

        const existingPart = await db.get(
          "SELECT id FROM parts WHERE part_number = $1",
          [partNumber],
        );

        if (existingPart) {
          await db.run(
            `UPDATE parts SET description = $1, response_brand = $2 WHERE part_number = $3`,
            [description, item.spareBrand || "Navitrans", partNumber],
          );
          updatedParts++;
        } else {
          await db.run(
            `INSERT INTO parts (part_number, description, response_brand)
           VALUES ($1, $2, $3)`,
            [partNumber, description, item.spareBrand || "Navitrans"],
          );
          newParts++;
        }

        const part = await db.get(
          "SELECT id FROM parts WHERE part_number = $1",
          [partNumber],
        );

        if (part) {
          const existingCompat = await db.get(
            `SELECT id FROM part_compatibilities
           WHERE part_id = $1 AND compatible_part_number = $2`,
            [part.id, item.compatiblePart],
          );

          if (!existingCompat) {
            await db.run(
              `INSERT INTO part_compatibilities (part_id, compatible_part_number, equipment_model, original_brand)
             VALUES ($1, $2, $3, $4)`,
              [part.id, item.compatiblePart, item.equipment, item.brand],
            );
            newCompatibilities++;
          }
        }
      }

      res.status(201).json({
        message: `Importados ${items.length} registros`,
        stats: { newParts, updatedParts, newCompatibilities },
      });

      // Registrar Importación
      if (req.user) {
        logActivity(
          req.user.id,
          req.user.username,
          "UPLOAD",
          {
            type: "IMPORT_BATCH",
            count: items.length,
            stats: { newParts, updatedParts, newCompatibilities },
          },
          req,
        );
      }
    } catch (error) {
      console.error("Error en importación:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Sincronizar disponibilidad desde fuente externa (ej: PC local con acceso a SQL Server)
app.post(
  "/api/inventory/sync",
  requireInventorySyncToken,
  async (req, res) => {
    try {
      const items = Array.isArray(req.body) ? req.body : req.body?.items;
      if (!Array.isArray(items)) {
        return res.status(400).json({
          error:
            "Payload inválido. Se esperaba un array o un objeto con { items: [] }",
        });
      }

      const mode = req.query.mode === "upsert" ? "upsert" : "replace";
      const result =
        mode === "upsert"
          ? await upsertInventorySnapshot(items)
          : await replaceInventorySnapshot(items);

      return res.status(201).json({
        ok: true,
        mode,
        ...result,
      });
    } catch (error) {
      console.error("Error sincronizando inventario:", error);
      return res.status(500).json({ error: error.message });
    }
  },
);

// Obtener detalle de inventario
app.get("/api/inventory/:partNumber", requireAuth, async (req, res) => {
  try {
    const { partNumber } = req.params;
    const inventoryDetail = await getInventoryDetail(partNumber);
    res.json(inventoryDetail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener imagen de una parte (acceso privado autenticado)
app.get("/api/parts/:partNumber/image", requireAuth, async (req, res) => {
  try {
    const { partNumber } = req.params;
    const variant = req.query.variant === "thumb" ? "thumb" : "medium";

    const part = await db.get("SELECT id FROM parts WHERE part_number = $1", [
      partNumber,
    ]);

    if (!part) {
      return res.status(404).json({ error: "Parte no encontrada" });
    }

    const image = await db.get(
      `SELECT object_key_medium, object_key_thumb, content_type
       FROM part_images
       WHERE part_id = $1
         AND is_primary = TRUE
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [part.id],
    );

    if (!image) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    const objectKey =
      variant === "thumb"
        ? image.object_key_thumb || image.object_key_medium
        : image.object_key_medium || image.object_key_thumb;

    if (!objectKey) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    const object = await getObject(objectKey);

    res.setHeader("Content-Type", object.ContentType || image.content_type);
    res.setHeader("Cache-Control", "private, max-age=300");

    if (object.ContentLength) {
      res.setHeader("Content-Length", object.ContentLength);
    }

    if (!object.Body || typeof object.Body.pipe !== "function") {
      return res.status(500).json({ error: "No fue posible leer la imagen" });
    }

    object.Body.on("error", (streamError) => {
      console.error("Error transmitiendo imagen:", streamError.message);
      if (!res.headersSent) {
        res.status(500).end("Error transmitiendo imagen");
      }
    });

    object.Body.pipe(res);
  } catch (error) {
    const notFoundCodes = new Set(["NoSuchKey", "NotFound", "NoSuchBucket"]);
    if (notFoundCodes.has(error.name)) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }

    console.error("Error obteniendo imagen:", error);
    return res.status(500).json({ error: "Error obteniendo imagen" });
  }
});

// Subir imagen para una parte
app.post(
  "/api/parts/:partNumber/image",
  requireAuth,
  requireRole(["admin", "importer"]),
  upload.single("image"),
  async (req, res) => {
    const uploadedKeys = [];
    let previousImage = null;

    try {
      const { partNumber } = req.params;

      if (!req.file || !req.file.buffer) {
        return res
          .status(400)
          .json({ error: "No se proporcionó ninguna imagen" });
      }

      const part = await db.get(
        "SELECT id, part_number FROM parts WHERE part_number = $1",
        [partNumber],
      );

      if (!part) {
        return res.status(404).json({ error: "Parte no encontrada" });
      }

      const { mediumBuffer, thumbBuffer, mediumWidth, mediumHeight } =
        await processImageVariants(req.file.buffer);

      const checksum = crypto
        .createHash("sha256")
        .update(mediumBuffer)
        .digest("hex");

      const uploadId = crypto.randomUUID();
      const safePartNumber = sanitizePartNumber(part.part_number);
      const keyPrefix = `parts/${safePartNumber}/${uploadId}`;
      const mediumKey = `${keyPrefix}/medium.webp`;
      const thumbKey = `${keyPrefix}/thumb.webp`;

      await Promise.all([
        uploadObject({
          key: mediumKey,
          body: mediumBuffer,
          contentType: "image/webp",
          cacheControl: "private, max-age=31536000, immutable",
        }),
        uploadObject({
          key: thumbKey,
          body: thumbBuffer,
          contentType: "image/webp",
          cacheControl: "private, max-age=31536000, immutable",
        }),
      ]);

      uploadedKeys.push(mediumKey, thumbKey);

      previousImage = await db.get(
        `SELECT id, object_key_medium, object_key_thumb
         FROM part_images
         WHERE part_id = $1
           AND is_primary = TRUE
           AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [part.id],
      );

      const client = await db.pool.connect();
      let insertedImageId = null;

      try {
        await client.query("BEGIN");

        await client.query(
          `UPDATE part_images
           SET is_primary = FALSE, deleted_at = CURRENT_TIMESTAMP
           WHERE part_id = $1
             AND is_primary = TRUE
             AND deleted_at IS NULL`,
          [part.id],
        );

        const insertResult = await client.query(
          `INSERT INTO part_images (
             part_id,
             image_path,
             storage_provider,
             bucket,
             object_key_medium,
             object_key_thumb,
             content_type,
             size_bytes,
             width,
             height,
             checksum_sha256,
             is_primary,
             created_by
           ) VALUES (
             $1, $2, 's3', $3, $4, $5, 'image/webp', $6, $7, $8, $9, TRUE, $10
           )
           RETURNING id`,
          [
            part.id,
            mediumKey,
            imageBucket,
            mediumKey,
            thumbKey,
            mediumBuffer.length,
            mediumWidth,
            mediumHeight,
            checksum,
            req.user?.id || null,
          ],
        );

        insertedImageId = insertResult.rows[0].id;
        const imageUrl = buildPrivateImageUrl(
          part.part_number,
          insertedImageId,
          "medium",
        );

        await client.query(
          "UPDATE parts SET image_url = $1 WHERE part_number = $2",
          [imageUrl, part.part_number],
        );

        await client.query("COMMIT");
      } catch (dbError) {
        await client.query("ROLLBACK");
        throw dbError;
      } finally {
        client.release();
      }

      if (previousImage) {
        try {
          await deleteObjects([
            previousImage.object_key_medium,
            previousImage.object_key_thumb,
          ]);
        } catch (cleanupError) {
          console.error(
            "No fue posible eliminar imágenes anteriores:",
            cleanupError.message,
          );
        }
      }

      const imageUrl = buildPrivateImageUrl(
        part.part_number,
        insertedImageId,
        "medium",
      );

      res.json({
        message: "Imagen subida correctamente",
        imageUrl,
        imageId: insertedImageId,
      });

      if (req.user) {
        logActivity(
          req.user.id,
          req.user.username,
          "UPLOAD",
          {
            type: "IMAGE_UPLOAD",
            partNumber: part.part_number,
            imageId: insertedImageId,
          },
          req,
        );
      }
    } catch (error) {
      if (uploadedKeys.length > 0) {
        try {
          await deleteObjects(uploadedKeys);
        } catch (cleanupError) {
          console.error(
            "No fue posible limpiar objetos tras fallo:",
            cleanupError.message,
          );
        }
      }

      console.error("Error subiendo imagen:", error);
      return res.status(500).json({ error: "Error subiendo imagen" });
    }
  },
);

app.use((error, req, res, next) => {
  if (!error) {
    return next();
  }

  if (error.message === "Origen no permitido por CORS") {
    return res.status(403).json({ error: "Origen no permitido" });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "La imagen supera el límite de 5MB" });
    }

    return res.status(400).json({ error: error.message });
  }

  if (error.message?.includes("Solo se permiten imágenes")) {
    return res.status(400).json({ error: error.message });
  }

  return next(error);
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error("Error no controlado:", error);
  return res.status(500).json({ error: "Error interno del servidor" });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "parts-finder-pro",
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor después de inicializar la base de datos
async function startServer() {
  try {
    await db.initialize();
    await ensureBucket();
    app.listen(PORT, () => {
      console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al iniciar:", error.message);
    process.exit(1);
  }
}

startServer();
