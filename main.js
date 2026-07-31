const electron = require('electron');
const electronObj = typeof electron === 'object' && electron !== null ? electron : {};
const { app, BrowserWindow, dialog, protocol, net } = electronObj;
const ipcMain = electronObj.ipcMain || { handle: () => {}, on: () => {} };

const { fork, spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const runtimePath = fs.existsSync(path.join(__dirname, 'lib', 'runtime', 'index.js'))
  ? './lib/runtime'
  : (fs.existsSync(path.join(__dirname, 'src', 'runtime', 'index.js')) ? './src/runtime' : './lib/runtime');
const { RuntimeManager, RuntimeRepository, RuntimeExecutor } = require(runtimePath);
const { WhisperBinaryLocator, WhisperModelManager } = require('./whisper-helpers');
const EngineRegistry = require('./engine-registry');
const LocalEngineManager = require('./local-engine-manager');
const AppSettingsService = require('./app-settings-service');

// Register dubbiovi-file privileged scheme for local audio resource fetching from http:// origin
if (protocol && protocol.registerSchemesAsPrivileged) {
  try {
    protocol.registerSchemesAsPrivileged([
      { scheme: 'dubbiovi-file', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
    ]);
  } catch (_) {}
}

let nextProcess = null;
let mainWindow = null;
let engineRegistry = null;
let localEngineManager = null;
let appSettingsService = null;
let runtimeManager = null;
let runtimeRepository = null;
let runtimeExecutor = null;

// Resolve diagnostics logging directory
const getAppUserDataPath = (sub) => {
  if (typeof app !== 'undefined' && app?.getPath) {
    return sub ? app.getPath(sub) : app.getPath('userData');
  }
  return path.join(process.cwd(), 'logs');
};
const logDir = getAppUserDataPath('logs');
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

if (app && app.whenReady) {
app.whenReady().then(() => {
  // Protocol handler for dubbiovi-file:// URIs allowing http:// origins to stream local audio
  try {
    protocol.handle('dubbiovi-file', async (request) => {
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
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.ogg': 'audio/ogg',
          '.flac': 'audio/flac',
          '.aac': 'audio/aac',
          '.m4a': 'audio/mp4',
        };
        const mimeType = mimeTypes[ext] || 'audio/mpeg';

        const res = await net.fetch(fileUrl);
        const headers = new Headers(res.headers);
        headers.set('Content-Type', mimeType);
        headers.set('Access-Control-Allow-Origin', '*');

        const stat = fs.statSync(filePath);
        logDiag(`[dubbiovi-file IPC] Serving audio file: ${filePath} | Size: ${stat.size} bytes | Extension: ${ext} | MIME: ${mimeType} | Status: ${res.status}`);

        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers,
        });
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

  try {
    const startupFFmpegPath = resolveFFmpegExecutable();
    logDiag(`[FFmpeg Resolution] Startup Check -> Resolved FFmpeg executable:\n${startupFFmpegPath}`);
    console.log(`[FFmpeg Resolution] Startup Check -> Resolved FFmpeg executable:\n${startupFFmpegPath}`);
  } catch (err) {
    logDiag(`[FFmpeg Resolution] Startup check error: ${err.message}`);
  }

  if (process.env.ELECTRON_TEST !== '1' && process.env.NODE_ENV !== 'test') {
    createWindow();
  }
  });
}

if (app && app.on) {
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
}

// IPC Handlers for native save and file dialogs
ipcMain.handle('save-file', async (event, filePath, data, projectPath) => {
  try {
    const baseDir = projectPath ? projectPath : app.getPath('userData');
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);
    const parentDir = path.dirname(absolutePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    let buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const u8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer || data);
      buffer = Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
    } else if (typeof data === 'string') {
      const trimmed = data.trim();
      if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length % 4 === 0 && trimmed.length > 50) {
        buffer = Buffer.from(trimmed, 'base64');
      } else {
        buffer = Buffer.from(data, 'utf8');
      }
    } else if (data && typeof data === 'object' && Array.isArray(data.data)) {
      buffer = Buffer.from(data.data);
    } else if (data && typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
      buffer = Buffer.from(data.data);
    } else {
      buffer = Buffer.from(data);
    }

    fs.writeFileSync(absolutePath, buffer);
    const hexHeader = buffer.subarray(0, 12).toString('hex');
    logDiag(`[save-file IPC] Saved ${buffer.length} binary bytes to ${absolutePath}. Hex header: ${hexHeader}`);
    return { success: true, length: buffer.length };
  } catch (error) {
    logDiag(`[save-file IPC] Error saving file to ${filePath}: ${error.message}`);
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

ipcMain.handle('download-engine-model', async (event, { engineId, modelName, downloadUrl, configUrl }) => {
  const targetName = modelName || 'ggml-tiny.bin';
  const targetEngine = engineId || 'whisper';
  if (!localEngineManager) {
    throw new Error('LocalEngineManager is not initialized.');
  }

  logDiag(`[LocalEngineManager] Downloading model ${targetName} for engine ${targetEngine}...`);

  const installedPath = await localEngineManager.downloadModel(
    targetEngine,
    targetName,
    (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('model-download-progress', {
          engineId: targetEngine,
          modelName: targetName,
          ...progress,
        });
      }
    },
    downloadUrl,
    configUrl
  );

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

ipcMain.handle('delete-engine-model', async (event, { engineId, modelName }) => {
  const targetEngine = engineId || 'piper';
  if (!modelName || typeof modelName !== 'string') {
    throw new Error('Model name is required for deletion.');
  }
  const modelsDir = path.join(app.getPath('userData'), 'models', targetEngine);
  const modelPath = path.join(modelsDir, modelName);
  const configPath = `${modelPath}.json`;

  logDiag(`[delete-engine-model IPC] Deleting model package ${modelName} from ${modelsDir}...`);

  let deletedCount = 0;
  if (fs.existsSync(modelPath)) {
    fs.unlinkSync(modelPath);
    deletedCount++;
  }
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
    deletedCount++;
  }

  return { success: true, deletedCount };
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

  let targetPath = relativePath;
  if (!path.isAbsolute(relativePath)) {
    const projCandidate = projectPath ? path.join(projectPath, relativePath) : null;
    const userCandidate = path.join(app.getPath('userData'), relativePath);
    const cwdCandidate = path.join(process.cwd(), relativePath);

    if (projCandidate && fs.existsSync(projCandidate)) {
      targetPath = projCandidate;
    } else if (fs.existsSync(userCandidate)) {
      targetPath = userCandidate;
    } else if (fs.existsSync(cwdCandidate)) {
      targetPath = cwdCandidate;
    } else if (projCandidate) {
      targetPath = projCandidate;
    } else {
      targetPath = userCandidate;
    }
  }

  logDiag(`[resolve-audio-path IPC] Input: "${relativePath}" | ProjectPath: "${projectPath}" => Resolved: "${targetPath}" (Exists: ${fs.existsSync(targetPath)})`);

  const normalized = targetPath.replace(/\\/g, '/');
  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `dubbiovi-file://${cleanPath}`;
});

ipcMain.handle('get-system-diagnostics', async () => {
  const osPlatform = process.platform;
  const osArch = process.arch;
  const isAppleSilicon = osPlatform === 'darwin' && osArch === 'arm64';

  const diagnostics = {
    platform: osPlatform,
    arch: osArch,
    isAppleSilicon,
    dockerInstalled: false,
    dockerRunning: false,
    dockerVersion: '',
    pythonInstalled: false,
    pythonVersion: '',
  };

  const execPromise = (cmd, args, timeout = 2500) => {
    return new Promise((resolve) => {
      const { execFile } = require('child_process');
      execFile(cmd, args, { timeout }, (err, stdout) => {
        if (err) {
          resolve({ success: false, stdout: '' });
        } else {
          resolve({ success: true, stdout: (stdout || '').trim() });
        }
      });
    });
  };

  const dockerVer = await execPromise('docker', ['--version']);
  if (dockerVer.success) {
    diagnostics.dockerInstalled = true;
    diagnostics.dockerVersion = dockerVer.stdout;
    const dockerInfo = await execPromise('docker', ['info']);
    if (dockerInfo.success) {
      diagnostics.dockerRunning = true;
    }
  }

  let pyVer = await execPromise('python3', ['--version']);
  if (!pyVer.success) {
    pyVer = await execPromise('python', ['--version']);
  }
  if (pyVer.success) {
    diagnostics.pythonInstalled = true;
    diagnostics.pythonVersion = pyVer.stdout;
  }

  return diagnostics;
});

// -----------------------------------------------------------------------------
// Milestone 15.4: Native Save As Dialog & FFmpeg Audio Mixdown IPC Bridges
// -----------------------------------------------------------------------------

/**
 * Multi-tier FFmpeg binary path resolver.
 * Priority order:
 * 1. Development: project-local bin/ directory
 * 2. Packaged Application: process.resourcesPath/bin/
 * 3. Managed Runtime Directory: userData/runtimes or userData/engines
 * 4. System PATH: final fallback only
 */
function resolveFFmpegExecutable() {
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'ffmpeg.exe' : 'ffmpeg';

  // 1. Development: project-local bin/ directory
  const devBinPath = path.join(__dirname, 'bin', binaryName);
  const cwdBinPath = path.join(process.cwd(), 'bin', binaryName);
  if (fs.existsSync(devBinPath)) {
    logDiag(`[FFmpeg Resolution] Found development binary at: ${devBinPath}`);
    return devBinPath;
  }
  if (fs.existsSync(cwdBinPath)) {
    logDiag(`[FFmpeg Resolution] Found CWD binary at: ${cwdBinPath}`);
    return cwdBinPath;
  }

  // 2. Packaged Application: process.resourcesPath/bin/
  if (process.resourcesPath) {
    const packagedBinPath = path.join(process.resourcesPath, 'bin', binaryName);
    const packagedRootPath = path.join(process.resourcesPath, binaryName);
    if (fs.existsSync(packagedBinPath)) {
      logDiag(`[FFmpeg Resolution] Found packaged binary at: ${packagedBinPath}`);
      return packagedBinPath;
    }
    if (fs.existsSync(packagedRootPath)) {
      logDiag(`[FFmpeg Resolution] Found packaged root binary at: ${packagedRootPath}`);
      return packagedRootPath;
    }
  }

  // 3. Managed Runtime Directory (userData/runtimes or userData/engines)
  const userDataDir = typeof app !== 'undefined' && app ? app.getPath('userData') : process.cwd();
  const managedCandidates = [
    path.join(userDataDir, 'runtimes', 'ffmpeg', 'bin', binaryName),
    path.join(userDataDir, 'runtimes', 'ffmpeg', binaryName),
    path.join(userDataDir, 'engines', 'ffmpeg', binaryName),
    path.join(userDataDir, 'bin', binaryName),
  ];

  if (runtimeManager) {
    try {
      const ffmpegRuntime = runtimeManager.getRuntime('ffmpeg', '1.0.0');
      if (ffmpegRuntime && ffmpegRuntime.executablePath && fs.existsSync(ffmpegRuntime.executablePath)) {
        logDiag(`[FFmpeg Resolution] Found managed RuntimeManager binary at: ${ffmpegRuntime.executablePath}`);
        return ffmpegRuntime.executablePath;
      }
    } catch (_) {}
  }

  for (const candidate of managedCandidates) {
    if (fs.existsSync(candidate)) {
      logDiag(`[FFmpeg Resolution] Found managed runtime binary at: ${candidate}`);
      return candidate;
    }
  }

  // 4. System PATH as final fallback only
  logDiag(`[FFmpeg Resolution] Managed/bundled FFmpeg not found on disk. Falling back to system PATH ('${binaryName}').`);
  return binaryName;
}

/**
 * Multi-tier FFprobe binary path resolver matching FFmpeg resolution rules.
 */
function resolveFFprobeExecutable() {
  const isWin = process.platform === 'win32';
  const binaryName = isWin ? 'ffprobe.exe' : 'ffprobe';

  // 1. Development: project-local bin/ directory
  const devBinPath = path.join(__dirname, 'bin', binaryName);
  const cwdBinPath = path.join(process.cwd(), 'bin', binaryName);
  if (fs.existsSync(devBinPath)) {
    logDiag(`[FFprobe Resolution] Found development binary at: ${devBinPath}`);
    return devBinPath;
  }
  if (fs.existsSync(cwdBinPath)) {
    logDiag(`[FFprobe Resolution] Found CWD binary at: ${cwdBinPath}`);
    return cwdBinPath;
  }

  // 2. Packaged Application: process.resourcesPath/bin/
  if (process.resourcesPath) {
    const packagedBinPath = path.join(process.resourcesPath, 'bin', binaryName);
    const packagedRootPath = path.join(process.resourcesPath, binaryName);
    if (fs.existsSync(packagedBinPath)) {
      logDiag(`[FFprobe Resolution] Found packaged binary at: ${packagedBinPath}`);
      return packagedBinPath;
    }
    if (fs.existsSync(packagedRootPath)) {
      logDiag(`[FFprobe Resolution] Found packaged root binary at: ${packagedRootPath}`);
      return packagedRootPath;
    }
  }

  // 3. Managed Runtime Directory
  const userDataDir = typeof app !== 'undefined' && app ? app.getPath('userData') : process.cwd();
  const managedCandidates = [
    path.join(userDataDir, 'runtimes', 'ffmpeg', 'bin', binaryName),
    path.join(userDataDir, 'runtimes', 'ffmpeg', binaryName),
    path.join(userDataDir, 'engines', 'ffmpeg', binaryName),
    path.join(userDataDir, 'bin', binaryName),
  ];

  for (const candidate of managedCandidates) {
    if (fs.existsSync(candidate)) {
      logDiag(`[FFprobe Resolution] Found managed runtime binary at: ${candidate}`);
      return candidate;
    }
  }

  logDiag(`[FFprobe Resolution] Managed/bundled FFprobe not found on disk. Falling back to system PATH ('${binaryName}').`);
  return binaryName;
}

ipcMain.handle('show-save-dialog', async (event, options) => {
  if (!mainWindow) return { canceled: true };
  const { defaultPath, filters } = options || {};
  logDiag(`[SaveDialog IPC] Opening native Save As dialog (defaultPath: ${defaultPath})...`);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File As',
    defaultPath: defaultPath || 'dubbed_output.mp4',
    filters: filters || [
      { name: 'MP4 Video File', extensions: ['mp4'] },
      { name: 'WAV Audio File', extensions: ['wav'] },
      { name: 'MP3 Audio File', extensions: ['mp3'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  logDiag(`[SaveDialog IPC] Result: canceled=${result.canceled}, filePath="${result.filePath}"`);
  return result;
});

ipcMain.handle('render-audio-mixdown', async (event, { ffmpegArgs, outputPath, projectPath }) => {
  logDiag(`[AudioMixdown IPC] Starting FFmpeg audio mixdown render...`);
  logDiag(`[AudioMixdown IPC] Path returned by native Save dialog: "${outputPath}"`);
  logDiag(`[AudioMixdown IPC] Raw FFmpeg Args: ${JSON.stringify(ffmpegArgs)}`);

  if (!outputPath || !ffmpegArgs || !Array.isArray(ffmpegArgs)) {
    logDiag(`[AudioMixdown IPC] Error: Invalid arguments passed to render-audio-mixdown`);
    return {
      success: false,
      error: 'Invalid arguments: ffmpegArgs (array) and outputPath (string) are required.',
    };
  }

  // Ensure target output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Resolve any relative input paths in ffmpegArgs to absolute on-disk paths
  const resolvedArgs = ffmpegArgs.map((arg, idx) => {
    if (idx > 0 && ffmpegArgs[idx - 1] === '-i') {
      if (!path.isAbsolute(arg) && !arg.startsWith('http://') && !arg.startsWith('https://')) {
        const projCandidate = projectPath ? path.join(projectPath, arg) : null;
        const userCandidate = typeof app !== 'undefined' && app ? path.join(app.getPath('userData'), arg) : null;
        const cwdCandidate = path.join(process.cwd(), arg);

        if (projCandidate && fs.existsSync(projCandidate)) {
          return projCandidate;
        } else if (userCandidate && fs.existsSync(userCandidate)) {
          return userCandidate;
        } else if (fs.existsSync(cwdCandidate)) {
          return cwdCandidate;
        } else if (projCandidate) {
          return projCandidate;
        } else {
          return userCandidate;
        }
      }
    }
    return arg;
  });

  logDiag(`[AudioMixdown IPC] Resolved FFmpeg Args: ${JSON.stringify(resolvedArgs)}`);

  const ffmpegExecPath = resolveFFmpegExecutable();
  logDiag(`[AudioMixdown IPC] Resolved FFmpeg executable:\n${ffmpegExecPath}`);
  console.log(`[AudioMixdown IPC] Resolved FFmpeg executable:\n${ffmpegExecPath}`);

  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const ffmpegProc = spawn(ffmpegExecPath, resolvedArgs, { windowsHide: true });

    let stdout = '';
    let stderr = '';

    ffmpegProc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffmpegProc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProc.on('error', (err) => {
      logDiag(`[AudioMixdown IPC] FFmpeg spawn error: ${err.message}`);
      resolve({
        success: false,
        error: `FFmpeg binary error: ${err.message}. Please verify FFmpeg is installed and accessible in system PATH.`,
        stdout,
        stderr,
      });
    });

    ffmpegProc.on('close', (code) => {
      logDiag(`[AudioMixdown IPC] FFmpeg exited with code ${code}`);
      const fileExists = fs.existsSync(outputPath);
      const fileSize = fileExists ? fs.statSync(outputPath).size : 0;

      logDiag(`[AudioMixdown IPC] Post-FFmpeg File Check: outputPath="${outputPath}" | exists=${fileExists} | fileSize=${fileSize} bytes`);

      if (code === 0 && fileExists && fileSize > 0) {
        logDiag(`[AudioMixdown IPC] Render SUCCESS: ${fileSize} bytes written to ${outputPath}`);
        resolve({
          success: true,
          outputPath,
          fileSize,
          stdout,
          stderr,
        });
      } else {
        const errorMsg = stderr || `FFmpeg process exited with code ${code} (output file exists: ${fileExists})`;
        logDiag(`[AudioMixdown IPC] Render FAILURE: ${errorMsg}`);
        resolve({
          success: false,
          exitCode: code,
          error: errorMsg,
          stdout,
          stderr,
        });
      }
    });
  });
});

ipcMain.handle('render-video-export', async (event, options) => {
  const {
    videoPath,
    outputPath,
    mode = 'both', // 'both' | 'original' | 'voices' | 'silent'
    originalVolume = 1.0,
    originalEnabled = true,
    voiceVolume = 1.0,
    voiceEnabled = true,
    takes = [],
    projectPath,
  } = options || {};

  logDiag(`[VideoExport IPC] Starting video export (mode=${mode})...`);
  logDiag(`[VideoExport IPC] Source video path: "${videoPath}" | Output path: "${outputPath}"`);

  if (!videoPath || !outputPath) {
    return {
      success: false,
      error: 'Invalid arguments: videoPath and outputPath are required.',
    };
  }

  // 1. Resolve source video path
  let resolvedVideoPath = videoPath;
  if (!path.isAbsolute(resolvedVideoPath) && !resolvedVideoPath.startsWith('http://') && !resolvedVideoPath.startsWith('https://')) {
    const projCandidate = projectPath ? path.join(projectPath, resolvedVideoPath) : null;
    const userCandidate = typeof app !== 'undefined' && app ? path.join(app.getPath('userData'), resolvedVideoPath) : null;
    const cwdCandidate = path.join(process.cwd(), resolvedVideoPath);

    if (projCandidate && fs.existsSync(projCandidate)) {
      resolvedVideoPath = projCandidate;
    } else if (userCandidate && fs.existsSync(userCandidate)) {
      resolvedVideoPath = userCandidate;
    } else if (fs.existsSync(cwdCandidate)) {
      resolvedVideoPath = cwdCandidate;
    }
  }

  if (!fs.existsSync(resolvedVideoPath)) {
    logDiag(`[VideoExport IPC] Error: Source video file does not exist at "${resolvedVideoPath}"`);
    return {
      success: false,
      error: `Source video file not found at: ${resolvedVideoPath}`,
    };
  }

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const ffmpegExecPath = resolveFFmpegExecutable();
  const ffprobeExecPath = resolveFFprobeExecutable();
  const { spawn } = require('child_process');

  // Helper to run ffprobe
  const probeFile = (filePath) => {
    return new Promise((resolve) => {
      const proc = spawn(ffprobeExecPath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ], { windowsHide: true });
      let out = '';
      proc.stdout.on('data', d => { out += d.toString(); });
      proc.on('close', code => {
        if (code === 0 && out) {
          try {
            resolve(JSON.parse(out));
          } catch (_) { resolve(null); }
        } else {
          resolve(null);
        }
      });
      proc.on('error', () => resolve(null));
    });
  };

  // Inspect source video with ffprobe
  const sourceProbe = await probeFile(resolvedVideoPath);
  const vStream = sourceProbe?.streams?.find((s) => s.codec_type === 'video');
  const aStream = sourceProbe?.streams?.find((s) => s.codec_type === 'audio');
  const sourceDuration = sourceProbe?.format?.duration ? parseFloat(sourceProbe.format.duration) : null;
  const hasAudioStream = !!aStream;

  logDiag(`[VideoExport IPC] Source Probe: hasVideo=${!!vStream}, hasAudio=${hasAudioStream}, duration=${sourceDuration}s`);

  // 2. Execute Mode Export
  let tempAudioPath = null;

  try {
    if (mode === 'silent') {
      // Silent Mode: copy video, drop audio
      logDiag(`[VideoExport IPC] Executing Silent Mode video export...`);
      const ffmpegArgs = [
        '-y',
        '-i', resolvedVideoPath,
        '-map', '0:v:0',
        '-c:v', 'copy',
        '-an',
        outputPath,
      ];

      const res = await new Promise((resolve) => {
        const proc = spawn(ffmpegExecPath, ffmpegArgs, { windowsHide: true });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('error', err => resolve({ success: false, error: err.message }));
        proc.on('close', code => {
          if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: stderr || `FFmpeg exited with code ${code}` });
          }
        });
      });

      if (!res.success) {
        return { success: false, error: res.error };
      }
    } else {
      // Audio Modes: 'both' | 'original' | 'voices'
      logDiag(`[VideoExport IPC] Executing Audio Mode export (${mode})...`);

      const os = require('os');
      tempAudioPath = path.join(os.tmpdir(), `dubbiovi_mix_${Date.now()}_${Math.floor(Math.random() * 100000)}.wav`);

      let mixArgsToRun = [];

      if (options.mixdownArgs && Array.isArray(options.mixdownArgs) && options.mixdownArgs.length > 0) {
        mixArgsToRun = [...options.mixdownArgs];
        mixArgsToRun[mixArgsToRun.length - 1] = tempAudioPath;

        // If source video has no audio stream, strip [0:a] filter references
        if (!hasAudioStream && mixArgsToRun.includes('-filter_complex')) {
          const filterIdx = mixArgsToRun.indexOf('-filter_complex');
          if (filterIdx !== -1 && filterIdx + 1 < mixArgsToRun.length) {
            let fc = mixArgsToRun[filterIdx + 1];
            let segments = fc.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.includes('[0:a]'));
            fc = segments.join('; ').replace(/\[a0\]/g, '');
            fc = fc.replace(/amix=inputs=(\d+)/, (match, count) => {
              const newCount = Math.max(1, parseInt(count, 10) - 1);
              return `amix=inputs=${newCount}`;
            });
            if (fc.includes('amix=inputs=1:')) {
              fc = fc.replace(/amix=inputs=1:duration=longest:dropout_transition=0/, 'anull');
            }
            if (!fc || fc.trim() === '') {
              fc = 'anullsrc=r=44100:cl=stereo[outa]';
            }
            mixArgsToRun[filterIdx + 1] = fc;
          }
        }
      } else {
        // Fallback simple mixdown args if mixdownArgs not provided
        if (hasAudioStream) {
          mixArgsToRun = ['-y', '-i', resolvedVideoPath, '-c:a', 'pcm_s16le', tempAudioPath];
        } else {
          mixArgsToRun = ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-c:a', 'pcm_s16le', '-t', (sourceDuration || 1).toString(), tempAudioPath];
        }
      }

      // Resolve args for temp audio rendering
      const resolvedMixArgs = mixArgsToRun.map((arg, idx) => {
        if (idx > 0 && mixArgsToRun[idx - 1] === '-i') {
          if (!path.isAbsolute(arg) && !arg.startsWith('http://') && !arg.startsWith('https://')) {
            const projCandidate = projectPath ? path.join(projectPath, arg) : null;
            const userCandidate = typeof app !== 'undefined' && app ? path.join(app.getPath('userData'), arg) : null;
            const cwdCandidate = path.join(process.cwd(), arg);

            if (projCandidate && fs.existsSync(projCandidate)) return projCandidate;
            if (userCandidate && fs.existsSync(userCandidate)) return userCandidate;
            if (fs.existsSync(cwdCandidate)) return cwdCandidate;
          }
        }
        return arg;
      });

      logDiag(`[VideoExport IPC] Rendering temporary mixdown to "${tempAudioPath}"...`);
      const renderAudioRes = await new Promise((resolve) => {
        const proc = spawn(ffmpegExecPath, resolvedMixArgs, { windowsHide: true });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('error', err => resolve({ success: false, error: err.message }));
        proc.on('close', code => {
          if (code === 0 && fs.existsSync(tempAudioPath) && fs.statSync(tempAudioPath).size > 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: stderr || `FFmpeg mixdown exited with code ${code}` });
          }
        });
      });

      if (!renderAudioRes.success) {
        return { success: false, error: `Audio mixdown failed: ${renderAudioRes.error}` };
      }

      // Mux source video and temp audio into final MP4 using empirical duration strategy (-t sourceDuration if available)
      logDiag(`[VideoExport IPC] Muxing video and audio into MP4...`);
      const muxArgs = [
        '-y',
        '-i', resolvedVideoPath,
        '-i', tempAudioPath,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
      ];

      if (sourceDuration && sourceDuration > 0) {
        muxArgs.push('-t', sourceDuration.toString());
      } else {
        muxArgs.push('-shortest');
      }

      muxArgs.push(outputPath);

      const muxRes = await new Promise((resolve) => {
        const proc = spawn(ffmpegExecPath, muxArgs, { windowsHide: true });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('error', err => resolve({ success: false, error: err.message }));
        proc.on('close', code => {
          if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: stderr || `FFmpeg muxing exited with code ${code}` });
          }
        });
      });

      if (!muxRes.success) {
        return { success: false, error: `FFmpeg video/audio muxing failed: ${muxRes.error}` };
      }
    }

    // 3. Post-Export Verification via ffprobe
    const outputProbe = await probeFile(outputPath);
    const outVStream = outputProbe?.streams?.find((s) => s.codec_type === 'video');
    const outAStream = outputProbe?.streams?.find((s) => s.codec_type === 'audio');
    const outDuration = outputProbe?.format?.duration ? parseFloat(outputProbe.format.duration) : 0;
    const fileSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    const videoStreamCopied = outVStream && vStream ? (outVStream.codec_name === vStream.codec_name) : true;

    logDiag(`[VideoExport IPC] Export SUCCESS! Output size=${fileSize} bytes, duration=${outDuration}s, videoCopied=${videoStreamCopied}`);

    return {
      success: true,
      outputPath,
      fileSize,
      duration: outDuration,
      videoStreamCopied,
      videoCodec: outVStream?.codec_name,
      audioCodec: outAStream?.codec_name,
    };
  } catch (err) {
    logDiag(`[VideoExport IPC] Export Exception: ${err.message}`);
    return {
      success: false,
      error: err.message || 'Video export failed.',
    };
  } finally {
    // 4. Automatic temporary file cleanup
    if (tempAudioPath && fs.existsSync(tempAudioPath)) {
      try {
        fs.unlinkSync(tempAudioPath);
        logDiag(`[VideoExport IPC] Cleaned up temporary audio file: ${tempAudioPath}`);
      } catch (e) {
        logDiag(`[VideoExport IPC] Failed to remove temp file ${tempAudioPath}: ${e.message}`);
      }
    }
  }
});

if (typeof module !== 'undefined') {
  module.exports = {
    resolveFFmpegExecutable,
    resolveFFprobeExecutable,
  };
}


