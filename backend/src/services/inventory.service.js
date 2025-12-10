const sql = require('mssql');

// Configuración según documentación Navitrans
const config = {
    user: process.env.INVENTORY_DB_USER || 'UserConfiabilidad',
    password: process.env.INVENTORY_DB_PASSWORD || 'N@v1c0nf2025**',
    server: process.env.INVENTORY_DB_SERVER || '172.25.1.4',
    port: parseInt(process.env.INVENTORY_DB_PORT) || 1433,
    database: process.env.INVENTORY_DB_NAME || 'DB_DynamicsBI_Prod',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    connectionTimeout: 30000,
    requestTimeout: 30000
};

let pool = null;

async function getPool() {
    if (!pool) {
        pool = await sql.connect(config);
    }
    return pool;
}

/**
 * Obtiene el resumen de inventario para una pieza (cantidad total y primera ubicación)
 * Usado para enriquecer las compatibilidades
 */
async function getInventory(partNumber) {
    try {
        const poolConnection = await getPool();
        const result = await poolConnection.request()
            .input('partNumber', sql.VarChar, partNumber)
            .query(`
                SELECT
                    SUM(DisponibleSede) AS TotalQuantity,
                    (SELECT TOP 1 Sede FROM vwDisponiblePryConf
                     WHERE Codarticulo = @partNumber AND DisponibleSede > 0
                     ORDER BY DisponibleSede DESC) AS Location
                FROM vwDisponiblePryConf
                WHERE Codarticulo = @partNumber
            `);

        if (result.recordset.length > 0 && result.recordset[0].TotalQuantity > 0) {
            return {
                quantity: result.recordset[0].TotalQuantity || 0,
                location: result.recordset[0].Location || 'Sin stock'
            };
        }
        return { quantity: 0, location: 'Sin stock' };
    } catch (err) {
        console.error('Error conectando a SQL Server:', err.message);
        return { quantity: 0, location: 'Error conexión' };
    }
}

/**
 * Obtiene el detalle completo de inventario por sede/almacén para una pieza
 * Devuelve todas las sedes donde hay stock disponible
 */
async function getInventoryDetail(partNumber) {
    try {
        const poolConnection = await getPool();
        const result = await poolConnection.request()
            .input('partNumber', sql.VarChar, partNumber)
            .query(`
                SELECT
                    Codarticulo AS PartNumber,
                    Zona,
                    Sede,
                    Almacén AS Almacen,
                    DisponibleSede AS Cantidad,
                    CostoUnitario
                FROM vwDisponiblePryConf
                WHERE Codarticulo = @partNumber
                    AND DisponibleSede > 0
                ORDER BY DisponibleSede DESC
            `);

        const items = result.recordset.map(row => ({
            partNumber: row.PartNumber,
            zona: row.Zona,
            sede: row.Sede,
            almacen: row.Almacen,
            cantidad: row.Cantidad,
            costoUnitario: row.CostoUnitario
        }));

        const totalQuantity = items.reduce((sum, item) => sum + item.cantidad, 0);

        return {
            partNumber,
            totalQuantity,
            available: totalQuantity > 0,
            locations: items
        };
    } catch (err) {
        console.error('Error obteniendo detalle de inventario:', err.message);
        return {
            partNumber,
            totalQuantity: 0,
            available: false,
            locations: [],
            error: 'Error de conexión'
        };
    }
}

module.exports = { getInventory, getInventoryDetail };
