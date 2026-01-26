const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./database");
const { PORT, JWT_SECRET, JWT_EXPIRES_IN } = require("./config");
const path = require("path");
const { requireAuth, requireRole } = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Configuración de multer para subida de imágenes
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const partNumber = req.params.partNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
    const ext = path.extname(file.originalname);
    cb(null, `${partNumber}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, gif, webp)"));
    }
  },
});

const ALLOWED_ROLES = ["admin", "importer", "viewer"];

// Autenticacion
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: "username y password son requeridos" });
    }

    const user = await db.get(
      "SELECT id, username, password_hash, role, name FROM users WHERE username = $1",
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

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
      "SELECT id, username, role, name, created_at, updated_at FROM users ORDER BY id"
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { username, password, role, name } = req.body || {};

    if (!username || !password || !role || !name) {
      return res.status(400).json({ error: "username, password, role y name son requeridos" });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: "Rol no valido" });
    }

    const existing = await db.get("SELECT id FROM users WHERE username = $1", [username]);
    if (existing) {
      return res.status(409).json({ error: "Usuario ya existe" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO users (username, password_hash, role, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [username, passwordHash, role, name]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
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
      params
    );

    return res.json({ ok: true });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Usuario ya existe" });
    }
    return res.status(500).json({ error: error.message });
  }
});
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
        [searchPattern]
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
        "SELECT * FROM v_parts_search ORDER BY part_number"
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
  } catch (error) {
    console.error("Error en búsqueda:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalles de una parte
app.get("/api/parts/:partNumber", requireAuth, async (req, res) => {
  try {
    const { partNumber } = req.params;

    let part = await db.get(
      "SELECT * FROM parts WHERE part_number = $1",
      [partNumber]
    );

    if (!part) {
      part = await db.get(
        `SELECT p.*
         FROM parts p
         JOIN part_compatibilities pc ON p.id = pc.part_id
         WHERE pc.compatible_part_number = $1
         LIMIT 1`,
        [partNumber]
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
        [searchPattern]
      );
    }

    if (!part) {
      return res.status(404).json({ error: "Part not found" });
    }

    res.json({
      partNumber: part.part_number,
      description: part.description,
      brand: part.response_brand,
      category: "General",
      stock: 0,
      imageUrl: part.image_url || null,
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
      [searchPattern]
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
      [searchPattern]
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
      [searchPattern]
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
app.post("/api/compatibilities/import", requireAuth, requireRole(["admin", "importer"]), async (req, res) => {
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
        [partNumber]
      );

      if (existingPart) {
        await db.run(
          `UPDATE parts SET description = $1, response_brand = $2 WHERE part_number = $3`,
          [description, item.spareBrand || "Navitrans", partNumber]
        );
        updatedParts++;
      } else {
        await db.run(
          `INSERT INTO parts (part_number, description, response_brand)
           VALUES ($1, $2, $3)`,
          [partNumber, description, item.spareBrand || "Navitrans"]
        );
        newParts++;
      }

      const part = await db.get(
        "SELECT id FROM parts WHERE part_number = $1",
        [partNumber]
      );

      if (part) {
        const existingCompat = await db.get(
          `SELECT id FROM part_compatibilities
           WHERE part_id = $1 AND compatible_part_number = $2`,
          [part.id, item.compatiblePart]
        );

        if (!existingCompat) {
          await db.run(
            `INSERT INTO part_compatibilities (part_id, compatible_part_number, equipment_model, original_brand)
             VALUES ($1, $2, $3, $4)`,
            [part.id, item.compatiblePart, item.equipment, item.brand]
          );
          newCompatibilities++;
        }
      }
    }

    res.status(201).json({
      message: `Importados ${items.length} registros`,
      stats: { newParts, updatedParts, newCompatibilities },
    });
  } catch (error) {
    console.error("Error en importación:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalle de inventario
app.get("/api/inventory/:partNumber", requireAuth, async (req, res) => {
  try {
    const { partNumber } = req.params;
    const { getInventoryDetail } = require("./services/inventory.service");
    const inventoryDetail = await getInventoryDetail(partNumber);
    res.json(inventoryDetail);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subir imagen para una parte
app.post("/api/parts/:partNumber/image", requireAuth, requireRole(["admin", "importer"]), upload.single("image"), async (req, res) => {
  try {
    const { partNumber } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ninguna imagen" });
    }

    const part = await db.get(
      "SELECT id FROM parts WHERE part_number = $1",
      [partNumber]
    );

    if (!part) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Parte no encontrada" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    await db.run(
      "UPDATE parts SET image_url = $1 WHERE part_number = $2",
      [imageUrl, partNumber]
    );

    res.json({
      message: "Imagen subida correctamente",
      imageUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    app.listen(PORT, () => {
      console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al iniciar:", error.message);
    process.exit(1);
  }
}

startServer();




