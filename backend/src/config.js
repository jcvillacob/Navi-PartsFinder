// Configuración centralizada
const path = require('path');
const fs = require('fs');

// Cargar .env en desarrollo
if (process.env.NODE_ENV !== 'production' && !process.env.PORTABLE_MODE) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}

// Puertos disponibles
const PUERTOS = [
  parseInt(process.env.PORT) || 3000,
  3001, 3002, 3003, 3004, 3005
];

function obtenerRutaDB() {
  let dataPath;

  if (process.env.PORTABLE_MODE === 'true') {
    const userDataPath = process.env.USER_DATA_PATH;
    const appPath = process.env.APP_PATH;

    // PRIORIDAD 1: DB junto al ejecutable (modo portable/OneDrive)
    const localDataPath = appPath ? path.join(appPath, 'data') : null;
    
    // PRIORIDAD 2: DB en AppData (instalación normal)
    const appDataPath = userDataPath ? path.join(userDataPath, 'data') : null;

    if (localDataPath && fs.existsSync(path.join(localDataPath, 'app.db'))) {
      console.log('🔵 Modo: PORTABLE (DB junto al ejecutable)');
      dataPath = localDataPath;
    } else if (localDataPath && fs.existsSync(localDataPath)) {
      console.log('🟢 Modo: PORTABLE (carpeta data/ detectada)');
      dataPath = localDataPath;
    } else if (appDataPath && fs.existsSync(path.join(appDataPath, 'app.db'))) {
      console.log('🟡 Modo: INSTALADO (DB en AppData)');
      dataPath = appDataPath;
    } else if (appDataPath) {
      console.log('🟢 Modo: INSTALADO (nueva instalación)');
      dataPath = appDataPath;
    } else {
      console.log('🟠 Modo: DESARROLLO');
      dataPath = path.join(__dirname, '../../data');
    }
  } else {
    console.log('🟠 Modo: DESARROLLO (sin Electron)');
    dataPath = path.join(__dirname, '../../data');
  }

  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  return path.join(dataPath, 'app.db');
}

module.exports = {
  PUERTOS,
  DB_PATH: obtenerRutaDB()
};