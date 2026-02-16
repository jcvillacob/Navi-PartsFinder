const db = require("../database");

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeInventoryItems(items) {
  const deduped = new Map();

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const partNumber = normalizeText(
      rawItem.partNumber || rawItem.PartNumber || rawItem.part_number,
    ).toUpperCase();

    if (!partNumber) {
      continue;
    }

    const zona = normalizeText(rawItem.zona || rawItem.Zona);
    const sede = normalizeText(rawItem.sede || rawItem.Sede);
    const almacen = normalizeText(
      rawItem.almacen || rawItem.Almacen || rawItem.Almacén,
    );
    const cantidad = normalizeNumber(rawItem.cantidad || rawItem.Cantidad);
    const costoUnitario = normalizeNumber(
      rawItem.costoUnitario || rawItem.CostoUnitario,
    );
    const sourceUpdatedAt = normalizeDate(
      rawItem.sourceUpdatedAt ||
        rawItem.SourceUpdatedAt ||
        rawItem.source_updated_at,
    );

    const key = `${partNumber}|${zona}|${sede}|${almacen}`;
    const existing = deduped.get(key);

    if (existing) {
      existing.cantidad += cantidad;
      existing.costo_unitario = costoUnitario;
      existing.source_updated_at = sourceUpdatedAt;
      continue;
    }

    deduped.set(key, {
      part_number: partNumber,
      zona,
      sede,
      almacen,
      cantidad,
      costo_unitario: costoUnitario,
      source_updated_at: sourceUpdatedAt,
    });
  }

  return Array.from(deduped.values());
}

async function upsertInventoryRows(client, normalizedItems) {
  if (normalizedItems.length === 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO inventory_availability (
        part_number, zona, sede, almacen, cantidad, costo_unitario, source_updated_at, synced_at
      )
      SELECT
        x.part_number,
        COALESCE(x.zona, ''),
        COALESCE(x.sede, ''),
        COALESCE(x.almacen, ''),
        COALESCE(x.cantidad, 0),
        COALESCE(x.costo_unitario, 0),
        x.source_updated_at,
        CURRENT_TIMESTAMP
      FROM jsonb_to_recordset($1::jsonb) AS x(
        part_number TEXT,
        zona TEXT,
        sede TEXT,
        almacen TEXT,
        cantidad NUMERIC,
        costo_unitario NUMERIC,
        source_updated_at TIMESTAMP
      )
      ON CONFLICT (part_number, zona, sede, almacen)
      DO UPDATE SET
        cantidad = EXCLUDED.cantidad,
        costo_unitario = EXCLUDED.costo_unitario,
        source_updated_at = EXCLUDED.source_updated_at,
        synced_at = CURRENT_TIMESTAMP
    `,
    [JSON.stringify(normalizedItems)],
  );
}

async function replaceInventorySnapshot(items) {
  const normalizedItems = normalizeInventoryItems(items);
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM inventory_availability");
    await upsertInventoryRows(client, normalizedItems);
    await client.query("COMMIT");

    return {
      received: items.length,
      stored: normalizedItems.length,
      mode: "replace",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertInventorySnapshot(items) {
  const normalizedItems = normalizeInventoryItems(items);
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");
    await upsertInventoryRows(client, normalizedItems);
    await client.query("COMMIT");

    return {
      received: items.length,
      stored: normalizedItems.length,
      mode: "upsert",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Obtiene el resumen de inventario para una pieza (cantidad total y primera ubicación)
 */
async function getInventory(partNumber) {
  try {
    const normalizedPartNumber = normalizeText(partNumber).toUpperCase();
    const result = await db.get(
      `
        SELECT
          COALESCE(SUM(cantidad), 0) AS total_quantity,
          (
            SELECT sede
            FROM inventory_availability
            WHERE part_number = $1
              AND cantidad > 0
            ORDER BY cantidad DESC
            LIMIT 1
          ) AS location
        FROM inventory_availability
        WHERE part_number = $1
      `,
      [normalizedPartNumber],
    );

    const quantity = normalizeNumber(result?.total_quantity);
    return {
      quantity,
      location: quantity > 0 ? result?.location || "Sin stock" : "Sin stock",
    };
  } catch (err) {
    console.error("Error leyendo inventario local:", err.message);
    return { quantity: 0, location: "Error conexión" };
  }
}

/**
 * Obtiene el detalle completo de inventario por sede/almacén para una pieza
 */
async function getInventoryDetail(partNumber) {
  const normalizedPartNumber = normalizeText(partNumber).toUpperCase();

  try {
    const rows = await db.all(
      `
        SELECT
          part_number AS "partNumber",
          zona,
          sede,
          almacen,
          cantidad::float8 AS cantidad,
          costo_unitario::float8 AS "costoUnitario"
        FROM inventory_availability
        WHERE part_number = $1
          AND cantidad > 0
        ORDER BY cantidad DESC
      `,
      [normalizedPartNumber],
    );

    const totalQuantity = rows.reduce(
      (sum, item) => sum + normalizeNumber(item.cantidad),
      0,
    );

    return {
      partNumber: normalizedPartNumber,
      totalQuantity,
      available: totalQuantity > 0,
      locations: rows,
    };
  } catch (err) {
    console.error("Error obteniendo detalle de inventario:", err.message);
    return {
      partNumber: normalizedPartNumber,
      totalQuantity: 0,
      available: false,
      locations: [],
      error: "Error de conexión",
    };
  }
}

module.exports = {
  getInventory,
  getInventoryDetail,
  replaceInventorySnapshot,
  upsertInventorySnapshot,
};
