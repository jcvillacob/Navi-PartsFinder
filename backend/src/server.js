const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const db = require("./database");
const { PUERTOS } = require("./config");
const net = require("net");
const path = require("path");

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
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

// Asegurar que la columna image_url existe en la tabla parts
try {
  const tableInfo = db.prepare("PRAGMA table_info(parts)").all();
  const hasImageUrl = tableInfo.some(col => col.name === "image_url");
  if (!hasImageUrl) {
    db.prepare("ALTER TABLE parts ADD COLUMN image_url TEXT").run();
    console.log("✅ Columna image_url agregada a la tabla parts");
  }
} catch (err) {
  console.error("Error verificando columna image_url:", err.message);
}

// Endpoint de búsqueda
app.get("/api/search", async (req, res) => {
  try {
    const searchQuery = req.query.q;
    let compatibilities;

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;

      const matchingParts = db
        .prepare(
          `
        SELECT DISTINCT part_number 
        FROM v_parts_search 
        WHERE part_number LIKE ? 
        OR compatible_part_number LIKE ?
        OR equipment_model LIKE ?
      `
        )
        .all(searchPattern, searchPattern, searchPattern);

      if (matchingParts.length === 0) {
        return res.json([]);
      }

      const partNumbers = [...new Set(matchingParts.map((p) => p.part_number))];
      const placeholders = partNumbers.map(() => "?").join(",");

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

      compatibilities = db.prepare(recursiveQuery).all(...partNumbers);
    } else {
      const stmt = db.prepare(
        "SELECT * FROM v_parts_search ORDER BY part_number"
      );
      compatibilities = stmt.all();
    }

    const { getInventory } = require("./services/inventory.service");

    // Mapeo inicial
    const baseMapped = compatibilities.map((c) => ({
      partNumber: c.part_number,
      description: c.description,
      compatiblePart: c.compatible_part_number,
      equipment: c.equipment_model,
      brand: c.original_brand,
      spareBrand: c.response_brand,
    }));

    // Enriquecer con datos de inventario externo
    // Usamos Promise.all para hacer las consultas en paralelo
    const enrichedMapped = await Promise.all(
      baseMapped.map(async (item) => {
        // Consultamos disponibilidad usando el número de parte de Navitrans (item.partNumber)
        const inventory = await getInventory(item.partNumber);
        return {
          ...item,
          quantity: inventory.quantity,
          location: inventory.location,
          availability: inventory.quantity > 0,
        };
      })
    );

    res.json(enrichedMapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalles de una parte (busca por part_number o por referencia compatible)
app.get("/api/parts/:partNumber", (req, res) => {
  try {
    const { partNumber } = req.params;

    // Primero buscar directamente por part_number
    let part = db
      .prepare("SELECT * FROM parts WHERE part_number = ?")
      .get(partNumber);

    // Si no se encuentra, buscar si es una referencia compatible
    if (!part) {
      const compatibility = db
        .prepare(`
          SELECT p.*
          FROM parts p
          JOIN part_compatibilities pc ON p.id = pc.part_id
          WHERE pc.compatible_part_number = ?
          LIMIT 1
        `)
        .get(partNumber);

      if (compatibility) {
        part = compatibility;
      }
    }

    // Si aún no se encuentra, buscar por LIKE en part_number o compatible_part_number
    if (!part) {
      const searchPattern = `%${partNumber}%`;
      const compatibility = db
        .prepare(`
          SELECT DISTINCT p.*
          FROM parts p
          LEFT JOIN part_compatibilities pc ON p.id = pc.part_id
          WHERE p.part_number LIKE ?
          OR pc.compatible_part_number LIKE ?
          LIMIT 1
        `)
        .get(searchPattern, searchPattern);

      if (compatibility) {
        part = compatibility;
      }
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
    res.status(500).json({ error: error.message });
  }
});

// Obtener sugerencias para autocompletado
app.get("/api/suggestions", (req, res) => {
  try {
    const searchQuery = req.query.q;

    if (!searchQuery || searchQuery.length < 3) {
      return res.json([]);
    }

    const searchPattern = `%${searchQuery}%`;

    // Buscar en números de parte, partes compatibles y equipos
    const suggestions = [];
    const seen = new Set();

    // Números de parte
    const partNumbers = db
      .prepare(
        `
      SELECT DISTINCT part_number, description
      FROM parts
      WHERE part_number LIKE ?
      LIMIT 5
    `
      )
      .all(searchPattern);

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

    // Partes compatibles
    const compatibleParts = db
      .prepare(
        `
      SELECT DISTINCT pc.compatible_part_number, pc.equipment_model, p.part_number
      FROM part_compatibilities pc
      JOIN parts p ON pc.part_id = p.id
      WHERE pc.compatible_part_number LIKE ?
      LIMIT 5
    `
      )
      .all(searchPattern);

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

    // Equipos
    const equipment = db
      .prepare(
        `
      SELECT DISTINCT pc.equipment_model, p.part_number, p.description
      FROM part_compatibilities pc
      JOIN parts p ON pc.part_id = p.id
      WHERE pc.equipment_model LIKE ?
      LIMIT 5
    `
      )
      .all(searchPattern);

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

    // Limitar a 10 sugerencias totales
    res.json(suggestions.slice(0, 10));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Importar compatibilidades con estadísticas
app.post("/api/compatibilities/import", (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Se esperaba un array de items" });
    }

    let newParts = 0;
    let updatedParts = 0;
    let newCompatibilities = 0;

    const checkPartExists = db.prepare(
      "SELECT id FROM parts WHERE part_number = ?"
    );

    const insertPart = db.prepare(`
      INSERT INTO parts (part_number, description, response_brand)
      VALUES (@partNumber, @description, @spareBrand)
      ON CONFLICT(part_number) DO UPDATE SET
        description = excluded.description,
        response_brand = excluded.response_brand
    `);

    const getPartId = db.prepare("SELECT id FROM parts WHERE part_number = ?");
    const insertCompat = db.prepare(`
      INSERT INTO part_compatibilities (part_id, compatible_part_number, equipment_model, original_brand)
      VALUES (@partId, @compatiblePart, @equipment, @brand)
    `);

    const importTransaction = db.transaction((data) => {
      for (const item of data) {
        const partNumber = item.partNumber || "NAV81N6-26601";
        const description = item.description || "CADENA (SIN ZAPATAS)";

        const existingPart = checkPartExists.get(partNumber);

        insertPart.run({
          partNumber: partNumber,
          description: description,
          spareBrand: item.spareBrand || "Navitrans",
        });

        if (existingPart) {
          updatedParts++;
        } else {
          newParts++;
        }

        const part = getPartId.get(partNumber);

        if (part) {
          const existingCompat = db
            .prepare(
              `
            SELECT id FROM part_compatibilities 
            WHERE part_id = ? AND compatible_part_number = ?
          `
            )
            .get(part.id, item.compatiblePart);

          if (!existingCompat) {
            insertCompat.run({
              partId: part.id,
              compatiblePart: item.compatiblePart,
              equipment: item.equipment,
              brand: item.brand,
            });
            newCompatibilities++;
          }
        }
      }
    });

    importTransaction(items);

    res.status(201).json({
      message: `Importados ${items.length} registros`,
      stats: {
        newParts,
        updatedParts,
        newCompatibilities,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener detalle de inventario de una pieza
app.get("/api/inventory/:partNumber", async (req, res) => {
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
app.post("/api/parts/:partNumber/image", upload.single("image"), (req, res) => {
  try {
    const { partNumber } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ninguna imagen" });
    }

    // Verificar que la parte existe
    const part = db.prepare("SELECT id FROM parts WHERE part_number = ?").get(partNumber);

    if (!part) {
      // Eliminar el archivo subido si la parte no existe
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Parte no encontrada" });
    }

    // Actualizar la URL de imagen en la base de datos
    const imageUrl = `/uploads/${req.file.filename}`;
    db.prepare("UPDATE parts SET image_url = ? WHERE part_number = ?").run(imageUrl, partNumber);

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

// === DETECCIÓN AUTOMÁTICA DE PUERTO ===

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function findAvailablePort() {
  for (const port of PUERTOS) {
    const available = await checkPort(port);
    if (available) {
      return port;
    }
    console.log(`⚠️ Puerto ${port} ocupado, intentando siguiente...`);
  }
  throw new Error("No hay puertos disponibles");
}

async function startServer() {
  try {
    const port = await findAvailablePort();
    app.listen(port, () => {
      console.log(`🚀 Backend corriendo en http://localhost:${port}`);
      if (process.send) {
        process.send({ type: "port", port });
      }
    });
  } catch (error) {
    console.error("❌ Error al iniciar servidor:", error.message);
    process.exit(1);
  }
}

startServer();
