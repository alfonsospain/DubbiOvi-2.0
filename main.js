const { app, BrowserWindow, dialog, ipcMain, protocol, net } = require('electron');
const { fork, spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
require('tsx/cjs');
const { RuntimeManager, RuntimeRepository, RuntimeExecutor } = require('./src/runtime');
const { WhisperBinaryLocator, WhisperModelManager } = require('./whisper-helpers');
const EngineRegistry = require('./engine-registry');
const LocalEngineManager = require('./local-engine-manager');
const AppSettingsService = require('./app-settings-service');

// Register dubbiovi-file privileged scheme for local audio resource fetching from http:// origin
try {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'dubbiovi-file', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
  ]);
} catch (_) {}

let nextProcess = null;
let mainWindow = null;
let engineRegistry = null;
let localEngineManager = null;
let appSettingsService = null;
let runtimeManager = null;
let runtimeRepository = null;
let runtimeExecutor = null;

// Resolve diagnostics logging directory
const logDir = app.getPath('logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'diagnostics.log');

// Setup logging utility
function logDiag(message) {
  const time = new Date().toISOString();
  const line = `[${time}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync(logFile, line, 'utf8');
  } catch (err) {
    console.error('Failed to write to diagnostics log file:', err);
  }
}

// Log application startup parameters
logDiag('--- DubbiOvi Diagnostics Startup ---');
logDiag(`Application Version: 1.3.7`);
logDiag(`Platform: ${process.platform} (${process.arch})`);
logDiag(`Node Version: ${process.version}`);
logDiag(`Electron Version: ${process.versions.electron}`);
logDiag(`Log file path: ${logFile}`);

// Instrument uncaught exception and promise rejection loggers
process.on('uncaughtException', (err) => {
  logDiag(`UNCAUGHT EXCEPTION: ${err.message}\nStack: ${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logDiag(`UNHANDLED REJECTION: ${reason}`);
});

// Find an available TCP port dynamically
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => reject(err));
  });
}

// Check if a specific port is free
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

// Poll the localhost server until it returns a valid HTTP response
function checkServerReady(port) {
  return new Promise((resolve) => {
    const start = Date.now();
    
    const poll = () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/',
        method: 'GET',
        timeout: 1000,
      }, (res) => {
        if (res.statusCode) {
          resolve(true);
        } else {
          setTimeout(poll, 200);
        }
      });

      req.on('error', () => {
        if (Date.now() - start > 15000) {
          logDiag('Still waiting for Next.js standalone server to start...');
        }
        setTimeout(poll, 200);
      });

      req.on('timeout', () => {
        req.destroy();
      });

      req.end();
    };

    poll();
  });
}

// Renders styled diagnostic errors within Electron BrowserWindow if backend crashes
function displayStartupError(message, stderr) {
  if (!mainWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DubbiOvi Startup Error</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #0b0f19;
          color: #f8fafc;
          padding: 40px;
          line-height: 1.6;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: #111827;
          border: 1px solid #1f2937;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        h1 {
          color: #ef4444;
          font-size: 24px;
          margin-top: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .error-box {
          background-color: #1e1b4b;
          border-left: 4px solid #6366f1;
          padding: 15px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
          margin: 20px 0;
          white-space: pre-wrap;
          word-break: break-all;
          overflow-x: auto;
        }
        .stderr-box {
          background-color: #18181b;
          border: 1px solid #27272a;
          padding: 15px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          margin: 20px 0;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 250px;
          overflow-y: auto;
          color: #a1a1aa;
        }
        .info {
          font-size: 13px;
          color: #94a3b8;
        }
        .btn {
          background-color: #6366f1;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          margin-top: 15px;
        }
        .btn:hover {
          background-color: #4f46e5;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>⚠️ DubbiOvi Startup Failure</h1>
        <p>The application failed to start the local backend server. Below are the details of the failure:</p>
        
        <div class="error-box">${message}</div>
        
        ${stderr ? `
          <h3>Server output (stderr):</h3>
          <div class="stderr-box">${stderr}</div>
        ` : ''}
        
        <div class="info">
          Diagnostics log written to: <br>
          <code>${logFile}</code>
        </div>
        
        <button class="btn" onclick="window.location.reload()">Retry Launch</button>
      </div>
    </body>
    </html>
  `;

  const base64Html = Buffer.from(htmlContent).toString('base64');
  mainWindow.loadURL(`data:text/html;base64,${base64Html}`);
}

async function createWindow() {
  const isDev = !app.isPackaged;
  let port;

  if (isDev) {
    port = 9002; // Port configured in package.json dev command
  } else {
    // Attempt to use a fixed port (9981) so that origin-based localStorage persists across launches.
    const preferredPort = 9981;
    const isFree = await isPortFree(preferredPort);
    if (!isFree) {
      logDiag(`[Electron] Preferred port ${preferredPort} is busy. Terminating.`);
      dialog.showMessageBoxSync({
        type: 'warning',
        title: 'DubbiOvi Already Running',
        message: 'Another instance of DubbiOvi may already be running, or a previous instance did not shut down correctly.',
        detail: 'Please close the other instance and try again.',
        buttons: ['Exit']
      });
      app.quit();
      return;
    }
    port = preferredPort;
  }

  const iconPath = isDev
    ? path.join(__dirname, 'public', 'icon.png')
    : path.join(app.getAppPath(), '.next', 'standalone', 'public', 'icon.png');

  // Create the main window only if port check succeeds or we are in development
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    title: 'DubbiOvi',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    logDiag(`[Electron] Connecting to local Next.js dev server at http://127.0.0.1:${port}`);
    await checkServerReady(port);
  } else {
    logDiag(`[Electron] Starting Next.js standalone server on port ${port}...`);

    // In a packaged app, resources are in the app folder (since we compile with asar: false)
    const serverPath = path.join(app.getAppPath(), '.next', 'standalone', 'server.js');
    logDiag(`[Electron] Executing server path: ${serverPath}`);

    let serverErrorOutput = '';

    nextProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: port.toString(),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    nextProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      logDiag(`[Next.js stdout] ${msg.trim()}`);
    });

    nextProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      serverErrorOutput += msg;
      logDiag(`[Next.js stderr] ${msg.trim()}`);
    });

    nextProcess.on('error', (err) => {
      logDiag(`[Electron] Next.js child process encountered an error: ${err.message}`);
    });

    nextProcess.on('exit', (code, signal) => {
      logDiag(`[Electron] Next.js child process exited with code ${code} and signal ${signal}`);
    });

    try {
      await Promise.race([
        checkServerReady(port),
        new Promise((_, reject) => {
          nextProcess.on('exit', (code, signal) => {
            reject(new Error(`Next.js standalone server exited early with code ${code} (signal: ${signal}).`));
          });
          nextProcess.on('error', (err) => {
            reject(new Error(`Failed to start Next.js process: ${err.message}`));
          });
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Next.js server startup timed out (15 seconds).')), 15000);
        })
      ]);
      logDiag(`[Electron] Next.js server resolved successfully on port ${port}`);
    } catch (err) {
      logDiag(`[Electron] Backend launch failure: ${err.message}`);
      displayStartupError(err.message, serverErrorOutput);
      return;
    }
  }

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (detachedWindow) {
      detachedWindow.close();
      detachedWindow = null;
    }
  });
}

const { pathToFileURL } = require('url');

app.whenReady().then(() => {
  // Protocol handler for dubbiovi-file:// URIs allowing http:// origins to stream local audio
  try {
    protocol.handle('dubbiovi-file', (request) => {
      try {
        let rawPath = decodeURIComponent(request.url.replace(/^dubbiovi-file:\/\//i, ''));
        if (process.platform === 'win32') {
          if (rawPath.startsWith('/')) {
            rawPath = rawPath.substring(1);
          }
          if (/^[a-zA-Z]\//.test(rawPath)) {
            rawPath = rawPath[0] + ':' + rawPath.substring(1);
          }
        } else {
          if (!rawPath.startsWith('/')) {
            rawPath = '/' + rawPath;
          }
        }
        const filePath = rawPath;

        if (!fs.existsSync(filePath)) {
          logDiag(`[dubbiovi-file IPC] Error: Requested file not found at ${filePath}`);
          return new Response('File Not Found', { status: 404 });
        }

        const fileUrl = pathToFileURL(filePath).toString();
        logDiag(`[dubbiovi-file IPC] Serving audio file URL: ${fileUrl}`);
        return net.fetch(fileUrl);
      } catch (err) {
        logDiag(`[dubbiovi-file IPC] URL parsing error: ${err.message}`);
        return new Response('Bad Request', { status: 400 });
      }
    });
  } catch (err) {
    logDiag(`[protocol.handle] Error registering dubbiovi-file handler: ${err.message}`);
  }

  try {
    appSettingsService = new AppSettingsService(app);
    app.settingsService = appSettingsService;
    logDiag('[AppSettingsService] Initialized AppSettingsService successfully.');
  } catch (err) {
    logDiag(`[AppSettingsService] Initialization error: ${err.message}`);
  }

  try {
    engineRegistry = new EngineRegistry();
    engineRegistry.registerDefaults();
    localEngineManager = new LocalEngineManager(app, engineRegistry);
    localEngineManager.initializeStorage();
    app.engineManager = localEngineManager;
    logDiag('[LocalEngineManager] Initialized local AI engines infrastructure successfully.');
  } catch (err) {
    logDiag(`[LocalEngineManager] Storage initialization error: ${err.message}`);
  }

  try {
    const runtimesDir = path.join(app.getPath('userData'), 'runtimes');
    const cacheDir = path.join(app.getPath('userData'), 'cache');
    runtimeRepository = new RuntimeRepository();
    runtimeManager = new RuntimeManager({
      runtimesDir,
      cacheDir,
      appVersion: app.getVersion(),
    });
    runtimeExecutor = new RuntimeExecutor(runtimeManager.registry);
    logDiag('[RuntimeManager] Initialized RuntimeManager, RuntimeRepository & RuntimeExecutor successfully.');
  } catch (err) {
    logDiag(`[RuntimeManager] Initialization error: ${err.message}`);
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up child process when app closes
app.on('will-quit', () => {
  if (nextProcess) {
    logDiag('[Electron] Terminating Next.js standalone server process...');
    nextProcess.kill();
  }
});

// IPC Handlers for native save and file dialogs
ipcMain.handle('show-save-dialog', async (event, options) => {
  if (!mainWindow) return { canceled: true };
  return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('save-file', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, data, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

let detachedWindow = null;

ipcMain.on('open-detached-video', (event, url) => {
  if (detachedWindow) {
    detachedWindow.focus();
    return;
  }

  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  const windowOptions = {
    width: 800,
    height: 600,
    title: 'DubbiOvi - Video Player',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  };

  if (externalDisplay) {
    windowOptions.x = externalDisplay.bounds.x + 50;
    windowOptions.y = externalDisplay.bounds.y + 50;
  }

  detachedWindow = new BrowserWindow(windowOptions);
  detachedWindow.loadURL(url);

  detachedWindow.on('closed', () => {
    detachedWindow = null;
    if (mainWindow) {
      mainWindow.webContents.send('detached-window-status', { open: false });
    }
  });

  if (mainWindow) {
    mainWindow.webContents.send('detached-window-status', { open: true });
  }
});

ipcMain.on('close-detached-video', () => {
  if (detachedWindow) {
    detachedWindow.close();
    detachedWindow = null;
  }
});

ipcMain.handle('run-whisper-local', async (event, { audioBuffer, modelPath }) => {
  const tempId = Math.random().toString(36).substring(7);
  const tempWavPath = path.join(app.getPath('temp'), `whisper_${tempId}.wav`);
  const tempJsonPath = `${tempWavPath}.json`;

  const cleanup = () => {
    try {
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
    } catch (err) {
      logDiag(`[WhisperLocal] Cleanup error: ${err.message}`);
    }
  };

  try {
    fs.writeFileSync(tempWavPath, Buffer.from(audioBuffer));

    let cliPath = null;
    if (runtimeManager) {
      const runtimeInfo = runtimeManager.getRuntime('whisper', '1.9.1');
      if (runtimeInfo && runtimeInfo.executablePath && fs.existsSync(runtimeInfo.executablePath)) {
        cliPath = runtimeInfo.executablePath;
      }
    }
    if (!cliPath && localEngineManager) {
      cliPath = localEngineManager.locateExecutable('whisper');
    }
    if (!cliPath) {
      cliPath = WhisperBinaryLocator.locate(app);
    }

    const resolvedModelPath = localEngineManager
      ? localEngineManager.locateModel('whisper', modelPath)
      : WhisperModelManager.resolveActiveModelPath(app, modelPath);

    if (!fs.existsSync(resolvedModelPath)) {
      throw new Error(`Whisper model file not found at: ${resolvedModelPath}. Please download 'ggml-tiny.bin' and place it in the 'models/whisper/' folder.`);
    }

    logDiag(`[WhisperLocal] Spawning CLI: ${cliPath}`);
    logDiag(`[WhisperLocal] Model path: ${resolvedModelPath}`);
    logDiag(`[WhisperLocal] Input audio: ${tempWavPath}`);

    return await new Promise((resolve, reject) => {
      const args = ['-m', resolvedModelPath, '-f', tempWavPath, '-oj'];
      const child = spawn(cliPath, args);
      let stderrOutput = '';

      child.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      child.on('error', (err) => {
        cleanup();
        reject(new Error(`Failed to execute whisper-cli binary: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          cleanup();
          reject(new Error(`whisper-cli exited with code ${code}. Stderr details: ${stderrOutput}`));
          return;
        }

        try {
          if (!fs.existsSync(tempJsonPath)) {
            throw new Error(`Whisper JSON output file missing at: ${tempJsonPath}`);
          }
          const rawData = fs.readFileSync(tempJsonPath, 'utf8');
          const jsonData = JSON.parse(rawData);
          cleanup();
          resolve(jsonData);
        } catch (err) {
          cleanup();
          reject(err);
        }
      });
    });
  } catch (error) {
    cleanup();
    logDiag(`[WhisperLocal] Error in run-whisper-local handler: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('check-engine-binary', async (event, { engineId }) => {
  const targetEngine = engineId || 'whisper';

  // Use new Runtime Framework for 'whisper' and 'piper' engines
  if (runtimeManager && (targetEngine === 'whisper' || targetEngine === 'whisper-local' || targetEngine === 'piper' || targetEngine === 'piper-local')) {
    const runtimeId = targetEngine.includes('piper') ? 'piper' : 'whisper';
    const version = runtimeId === 'piper' ? '1.0.0' : '1.9.1';
    const info = runtimeManager.getRuntime(runtimeId, version);
    const installed = !!info && fs.existsSync(info.executablePath);
    return { installed, executablePath: installed ? info.executablePath : null };
  }

  // Legacy fallback for unmigrated engines
  if (!localEngineManager) {
    return { installed: false, executablePath: null };
  }
  const execPath = localEngineManager.locateExecutable(targetEngine);
  const installed = fs.existsSync(execPath);

  let permissionsStr = 'N/A';
  if (installed && process.platform !== 'win32') {
    try {
      const stat = fs.statSync(execPath);
      permissionsStr = (stat.mode & 0o777).toString(8);
    } catch (_) {}
  }

  logDiag(`[check-engine-binary Diagnostic Log]`);
  logDiag(`  - engineId: ${targetEngine}`);
  logDiag(`  - userData directory: ${app.getPath('userData')}`);
  logDiag(`  - locateExecutable resolved path: ${execPath}`);
  logDiag(`  - fs.existsSync(execPath): ${installed}`);
  logDiag(`  - executable permissions: ${permissionsStr}`);

  return { installed, executablePath: installed ? execPath : null };
});

ipcMain.handle('download-engine-binary', async (event, { engineId }) => {
  const targetEngine = engineId || 'whisper';

  // Use new Runtime Framework for 'whisper' and 'piper' engines
  if (runtimeManager && runtimeRepository && (targetEngine === 'whisper' || targetEngine === 'whisper-local' || targetEngine === 'piper' || targetEngine === 'piper-local')) {
    const runtimeId = targetEngine.includes('piper') ? 'piper' : 'whisper';
    const version = runtimeId === 'piper' ? '1.0.0' : '1.9.1';
    logDiag(`[RuntimeManager] Downloading & installing runtime package for engine '${runtimeId}'...`);
    const descriptor = await runtimeRepository.getDescriptor(runtimeId, version, process.platform, process.arch);
    if (!descriptor) {
      throw new Error(`Catalog descriptor not found for runtime '${runtimeId}' (${process.platform}_${process.arch}).`);
    }

    const info = await runtimeManager.installRuntime(descriptor, (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('engine-download-progress', {
          engineId: runtimeId,
          ...progress,
        });
        mainWindow.webContents.send('runtime-download-progress', {
          runtimeId,
          ...progress,
        });
      }
    });

    logDiag(`[RuntimeManager] Successfully installed runtime binary executable to ${info.executablePath}`);
    return { success: true, executablePath: info.executablePath };
  }

  // Legacy fallback for unmigrated engines
  if (!localEngineManager) {
    throw new Error('LocalEngineManager is not initialized.');
  }

  logDiag(`[LocalEngineManager] Downloading binary release package for engine ${targetEngine}...`);

  const installedPath = await localEngineManager.installEngineBinary(targetEngine, (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('engine-download-progress', {
        engineId: targetEngine,
        ...progress,
      });
    }
  });

  logDiag(`[LocalEngineManager] Successfully installed binary executable to ${installedPath}`);
  return { success: true, executablePath: installedPath };
});

ipcMain.handle('check-engine-model', async (event, { engineId, modelName }) => {
  const targetName = modelName || 'ggml-tiny.bin';
  const targetEngine = engineId || 'whisper';
  if (!localEngineManager) {
    return { exists: false, modelPath: null };
  }
  const resolvedPath = localEngineManager.locateModel(targetEngine, targetName);
  let exists = fs.existsSync(resolvedPath);

  // For Piper ONNX models, BOTH .onnx and .onnx.json MUST exist on disk
  if (exists && (targetEngine === 'piper' || targetName.endsWith('.onnx'))) {
    const configPath = `${resolvedPath}.json`;
    if (!fs.existsSync(configPath)) {
      logDiag(`[check-engine-model IPC] Model ${targetName} exists but companion config ${configPath} is MISSING.`);
      exists = false;
    }
  }

  return { exists, modelPath: resolvedPath, modelName: targetName };
});

ipcMain.handle('download-engine-model', async (event, { engineId, modelName }) => {
  const targetName = modelName || 'ggml-tiny.bin';
  const targetEngine = engineId || 'whisper';
  if (!localEngineManager) {
    throw new Error('LocalEngineManager is not initialized.');
  }

  logDiag(`[LocalEngineManager] Downloading model ${targetName} for engine ${targetEngine}...`);

  const installedPath = await localEngineManager.downloadModel(targetEngine, targetName, (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('model-download-progress', {
        engineId: targetEngine,
        modelName: targetName,
        ...progress,
      });
    }
  });

  // Verify models directory contents on disk immediately after download
  const targetDir = path.dirname(installedPath);
  const dirFiles = fs.existsSync(targetDir) ? fs.readdirSync(targetDir) : [];
  logDiag(`[LocalEngineManager] Successfully installed model to ${installedPath}`);
  logDiag(`[LocalEngineManager] Contents of ${targetDir} after download: [${dirFiles.join(', ')}]`);

  if (targetEngine === 'piper' || targetName.endsWith('.onnx')) {
    const configPath = `${installedPath}.json`;
    const configExists = fs.existsSync(configPath);
    logDiag(`[LocalEngineManager] Verification: .onnx exists=${fs.existsSync(installedPath)}, .onnx.json exists=${configExists}`);
    if (!configExists) {
      throw new Error(`Model installation failed: companion configuration file ${configPath} was not created on disk.`);
    }
  }

  return { success: true, modelPath: installedPath };
});

// -----------------------------------------------------------------------------
// Milestone 5/6: Runtime Manager Subsystem IPC Endpoints
// -----------------------------------------------------------------------------

ipcMain.handle('check-runtime-installed', async (event, { runtimeId, version }) => {
  const targetId = runtimeId || 'whisper';
  if (!runtimeManager) {
    return { isInstalled: false, runtimeInfo: null };
  }
  const info = runtimeManager.getRuntime(targetId, version);
  const isInstalled = !!info && fs.existsSync(info.executablePath);
  return { isInstalled, runtimeInfo: isInstalled ? info : null };
});

ipcMain.handle('get-runtime-descriptor', async (event, { runtimeId, version }) => {
  const targetId = runtimeId || 'whisper';
  if (!runtimeRepository) {
    return null;
  }
  return runtimeRepository.getDescriptor(targetId, version, process.platform, process.arch);
});

ipcMain.handle('install-runtime', async (event, { runtimeId, version }) => {
  const targetId = runtimeId || 'whisper';
  if (!runtimeManager || !runtimeRepository) {
    throw new Error('RuntimeManager or RuntimeRepository is not initialized.');
  }

  const descriptor = await runtimeRepository.getDescriptor(targetId, version, process.platform, process.arch);
  if (!descriptor) {
    throw new Error(`Catalog descriptor not found for runtime '${targetId}' (${process.platform}_${process.arch}).`);
  }

  logDiag(`[RuntimeManager] Installing runtime '${descriptor.id}' v${descriptor.version}...`);

  const info = await runtimeManager.installRuntime(descriptor, (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('runtime-download-progress', {
        runtimeId: descriptor.id,
        ...progress,
      });
    }
  });

  logDiag(`[RuntimeManager] Successfully installed runtime to ${info.installedPath}`);
  return info;
});

ipcMain.handle('get-installed-runtimes', async () => {
  if (!runtimeManager) {
    return [];
  }
  return runtimeManager.getAllRuntimes();
});

ipcMain.handle('execute-runtime', async (event, options) => {
  if (!runtimeExecutor) {
    throw new Error('RuntimeExecutor is not initialized in Main Process.');
  }
  const { executionId, runtimeId, version, args, env, cwd, timeoutMs } = options || {};
  logDiag(`[RuntimeExecutor IPC] Executing runtime '${runtimeId || 'whisper'}' with args: ${JSON.stringify(args || [])}`);

  return runtimeExecutor.execute({
    runtimeId: runtimeId || 'whisper',
    version,
    args: args || ['--help'],
    env,
    cwd,
    timeoutMs,
    onStdout: (chunk) => {
      if (mainWindow && executionId) {
        mainWindow.webContents.send('runtime-output-stream', { executionId, stream: 'stdout', chunk });
      }
    },
    onStderr: (chunk) => {
      if (mainWindow && executionId) {
        mainWindow.webContents.send('runtime-output-stream', { executionId, stream: 'stderr', chunk });
      }
    },
  });
});

// App Settings IPC Handlers
ipcMain.handle('get-app-setting', async (event, { key, defaultValue }) => {
  if (!appSettingsService) return defaultValue !== undefined ? defaultValue : null;
  return appSettingsService.getSetting(key, defaultValue);
});

ipcMain.handle('set-app-setting', async (event, { key, value }) => {
  if (!appSettingsService) throw new Error('AppSettingsService is not initialized.');
  appSettingsService.setSetting(key, value);
  return { success: true };
});

// -----------------------------------------------------------------------------
// Milestone 9D: Piper Voice Provider IPC Bridge
// -----------------------------------------------------------------------------

ipcMain.handle('list-models', async (event, engineId) => {
  const targetEngine = engineId || 'piper';
  const modelsDir = path.join(app.getPath('userData'), 'models', targetEngine);
  if (!fs.existsSync(modelsDir)) {
    return [];
  }
  try {
    const files = fs.readdirSync(modelsDir);
    return files
      .filter((f) => f.endsWith('.onnx') || f.endsWith('.bin') || f.endsWith('.gguf'))
      .map((f) => ({
        id: f,
        filename: f,
        path: path.join(modelsDir, f),
      }));
  } catch (err) {
    logDiag(`[list-models IPC] Error listing models for ${targetEngine}: ${err.message}`);
    return [];
  }
});

ipcMain.handle('run-piper-local', async (event, { text, modelName, outputFilename, projectPath }) => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Missing parameter: non-empty text string is required for Piper voice generation.');
  }

  const targetModel = modelName || 'en_US-lessac-high.onnx';
  const modelsDir = path.join(app.getPath('userData'), 'models', 'piper');
  const modelPath = path.join(modelsDir, targetModel);

  const audioDir = projectPath ? path.join(projectPath, 'Audio') : path.join(app.getPath('userData'), 'Audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const outFilename = outputFilename || `voice_${Date.now()}.wav`;
  const absoluteOutputPath = path.join(audioDir, outFilename);

  logDiag(`[PiperLocal IPC] Input Text: "${text}"`);
  logDiag(`[PiperLocal IPC] Target Model: ${targetModel}`);
  logDiag(`[PiperLocal IPC] Model Path: ${modelPath} (Exists: ${fs.existsSync(modelPath)})`);
  logDiag(`[PiperLocal IPC] Target Output Path: ${absoluteOutputPath}`);

  // 1. Verify voice model file exists
  if (!fs.existsSync(modelPath)) {
    logDiag(`[PiperLocal IPC] Error: Voice model file not found at ${modelPath}`);
    throw new Error(`Voice model file '${targetModel}' not found at ${modelPath}. Please download the voice model first.`);
  }

  // 1b. Verify accompanying .onnx.json config file exists (download if missing)
  const configPath = `${modelPath}.json`;
  if (!fs.existsSync(configPath)) {
    logDiag(`[PiperLocal IPC] Warning: Accompanying config ${configPath} missing. Attempting auto-repair...`);
    try {
      if (localEngineManager) {
        await localEngineManager.downloadModel('piper', targetModel);
      }
    } catch (repairErr) {
      logDiag(`[PiperLocal IPC] Auto-repair failed: ${repairErr.message}`);
    }

    if (!fs.existsSync(configPath)) {
      throw new Error(`Voice model configuration file '${targetModel}.json' is missing at ${configPath}. Please redownload the voice model.`);
    }
  }

  // 2. Verify runtime installation
  const installedRuntime = runtimeManager?.getRuntime('piper', '1.0.0');
  if (!installedRuntime || !runtimeExecutor) {
    logDiag(`[PiperLocal IPC] Error: Piper runtime is not installed or available.`);
    throw new Error(`Piper Neural TTS engine runtime is not installed. Please download the Piper runtime from the Providers page.`);
  }

  // 3. Execute native Piper engine via RuntimeExecutor
  logDiag(`[PiperLocal IPC] Spawning RuntimeExecutor for piper v1.0.0...`);
  const execDir = path.dirname(installedRuntime.executablePath);
  const espeakDataDir = path.join(execDir, 'espeak-ng-data');
  const piperArgs = ['--model', modelPath, '--output_file', absoluteOutputPath];
  if (fs.existsSync(espeakDataDir)) {
    piperArgs.push('--espeak_data', espeakDataDir);
  }

  const execResult = await runtimeExecutor.execute({
    runtimeId: 'piper',
    version: '1.0.0',
    args: piperArgs,
    cwd: execDir,
    inputData: text,
  });

  logDiag(`[PiperLocal IPC] RuntimeExecutor Exit Code: ${execResult.exitCode} (Duration: ${execResult.durationMs} ms)`);
  if (execResult.stdout) logDiag(`[PiperLocal IPC] Stdout: ${execResult.stdout}`);
  if (execResult.stderr) logDiag(`[PiperLocal IPC] Stderr: ${execResult.stderr}`);

  if (execResult.exitCode !== 0) {
    throw new Error(`Piper TTS execution failed (exit code ${execResult.exitCode}): ${execResult.stderr || execResult.error || 'Unknown runtime error'}`);
  }

  // 4. Verify generated WAV file on disk
  if (!fs.existsSync(absoluteOutputPath)) {
    throw new Error(`Piper TTS execution completed with code 0 but failed to create output WAV file at ${absoluteOutputPath}`);
  }

  const stat = fs.statSync(absoluteOutputPath);
  logDiag(`[PiperLocal IPC] Generated WAV size: ${stat.size} bytes`);
  if (stat.size < 100) {
    throw new Error(`Piper TTS produced invalid empty WAV file (${stat.size} bytes) at ${absoluteOutputPath}`);
  }

  return {
    success: true,
    exitCode: 0,
    outputPath: absoluteOutputPath,
    filename: outFilename,
    modelUsed: targetModel,
    executionId: execResult.executionId,
    executionTimeMs: execResult.durationMs,
    fileSize: stat.size,
  };
});

ipcMain.handle('resolve-audio-path', async (event, { relativePath, projectPath }) => {
  if (!relativePath) return '';
  if (relativePath.startsWith('dubbiovi-file://') || relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const baseDir = projectPath ? projectPath : app.getPath('userData');
  const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(baseDir, relativePath);
  const normalized = fullPath.replace(/\\/g, '/');
  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `dubbiovi-file://${cleanPath}`;
});
