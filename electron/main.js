const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");

let mainWindow;
let backendProcess;
let backendPort = 3000;

app.setAppUserModelId("com.navitrans.buscador-equivalencias");

function startBackend() {
  const userDataPath = app.getPath("userData");
  const appPath = path.dirname(app.getPath("exe"));

  let backendPath;
  if (process.env.NODE_ENV === "development") {
    backendPath = path.join(__dirname, "../backend/src/server.js");
  } else {
    const basePath = app.getAppPath();
    backendPath = path.join(basePath, "backend/src/server.js");
  }

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const logPath = path.join(userDataPath, "backend.log");
  const logStream = fs.createWriteStream(logPath, { flags: "w" });

  logStream.write("=== Inicio de backend ===\n");
  logStream.write(`Backend path: ${backendPath}\n`);
  logStream.write(`UserData: ${userDataPath}\n`);
  logStream.write(`AppPath: ${appPath}\n`);

  console.log("ðŸš€ Iniciando backend desde:", backendPath);

  const backendDir = path.dirname(backendPath);

  backendProcess = spawn("node", [backendPath], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORTABLE_MODE: "true",
      USER_DATA_PATH: userDataPath,
      APP_PATH: appPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    const msg = data.toString();
    console.log(`Backend: ${msg}`);
    logStream.write(`[STDOUT] ${msg}`);

    // Detectar puerto del log
    const portMatch = msg.match(/localhost:(\d+)/);
    if (portMatch) {
      backendPort = parseInt(portMatch[1]);
      console.log(`ðŸ“ Backend en puerto: ${backendPort}`);
    }
  });

  backendProcess.stderr.on("data", (data) => {
    const msg = data.toString();
    console.error(`Backend Error: ${msg}`);
    logStream.write(`[STDERR] ${msg}`);
  });

  backendProcess.on("close", (code) => {
    logStream.write(`Backend exited with code ${code}\n`);
    logStream.end();
  });

  backendProcess.on("error", (err) => {
    logStream.write(`Error: ${err}\n`);
    logStream.end();
  });
}

function waitForBackend(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      const req = http.request(
        { host: "localhost", port, path: "/api/health", timeout: 500 },
        (res) => {
          resolve();
        }
      );

      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(new Error("Backend no respondiÃ³"));
        } else {
          setTimeout(check, 200);
        }
      });

      req.end();
    };

    check();
  });
}

function createWindow() {
  const iconPath =
    process.env.NODE_ENV === "development"
      ? path.join(__dirname, "../assets/logo.ico")
      : path.join(app.getAppPath(), "assets/logo.ico");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:4200");
    mainWindow.webContents.openDevTools();
  } else {
    const appPath = app.getAppPath();
    const indexPath = path.join(
      appPath,
      "frontend/dist/mi-app-frontend/browser/index.html"
    );
    const fileUrl = `file://${indexPath.replace(/\\/g, "/")}`;

    console.log("Loading frontend from:", fileUrl);
    mainWindow.loadURL(fileUrl).catch((err) => {
      console.error("Error loading frontend:", err);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startBackend();

  try {
    await waitForBackend(backendPort);
    console.log("âœ… Backend listo");
    createWindow();
  } catch (error) {
    console.error("âŒ Error esperando backend:", error);
    createWindow(); // Abrir ventana de todas formas
  }
});

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("quit", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
