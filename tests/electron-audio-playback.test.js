const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

app.setName('dubbiovi');

// 1. Register dubbiovi-file privileged scheme
try {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'dubbiovi-file', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
  ]);
} catch (_) {}

app.whenReady().then(async () => {
  console.log('=====================================================');
  console.log(' ELECTRON AUDIO PLAYBACK HARDWARE DIAGNOSTIC SUITE');
  console.log('=====================================================');

  // Protocol handler for dubbiovi-file:// URIs
  protocol.handle('dubbiovi-file', (request) => {
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
    const fileUrl = pathToFileURL(filePath).toString();
    console.log(`[dubbiovi-file IPC] Protocol request received for file: ${filePath}`);
    console.log(`[dubbiovi-file IPC] Delegating to native file URL: ${fileUrl}`);
    return net.fetch(fileUrl);
  });

  const testWavPath = path.join(app.getPath('userData'), 'Audio', 'voice_test-preview_50f924fa.wav');
  console.log(`[Test Setup] Target test WAV file path: ${testWavPath}`);
  console.log(`[Test Setup] Target file exists: ${fs.existsSync(testWavPath)}`);

  if (!fs.existsSync(testWavPath)) {
    console.error('❌ FAIL: Target test WAV file does not exist at path!');
    app.exit(1);
  }

  const stat = fs.statSync(testWavPath);
  console.log(`[Test Setup] Target file size: ${stat.size} bytes`);

  const win = new BrowserWindow({
    width: 600,
    height: 400,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  const customProtocolUrl = `dubbiovi-file://${testWavPath.replace(/\\/g, '/')}`;
  const fileProtocolUrl = pathToFileURL(testWavPath).toString();

  console.log(`[Test Setup] Custom Protocol URL : ${customProtocolUrl}`);
  console.log(`[Test Setup] Native File URL   : ${fileProtocolUrl}`);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><title>Audio Playback Test</title></head>
    <body>
      <h1>Electron Audio Playback Diagnostics</h1>
      <script>
        async function runTests() {
          const results = [];
          
          async function testAudio(url, label) {
            console.log('Testing ' + label + ' with URL: ' + url);
            const audio = new Audio(url);
            
            return new Promise((resolve) => {
              audio.oncanplaythrough = () => {
                console.log('✓ ' + label + ' canplaythrough event fired!');
              };
              
              audio.play().then(() => {
                console.log('✓ ' + label + ' audio.play() succeeded!');
                results.push({ label, success: true, src: audio.src, currentSrc: audio.currentSrc });
                resolve();
              }).catch((err) => {
                console.error('❌ ' + label + ' audio.play() failed:', err);
                results.push({
                  label,
                  success: false,
                  src: audio.src,
                  currentSrc: audio.currentSrc,
                  readyState: audio.readyState,
                  networkState: audio.networkState,
                  error: audio.error ? { code: audio.error.code, message: audio.error.message } : null,
                  exceptionMessage: err.message || String(err)
                });
                resolve();
              });
            });
          }

          await testAudio('${customProtocolUrl}', 'Custom Protocol (dubbiovi-file)');
          await testAudio('${fileProtocolUrl}', 'File Protocol (file://)');

          // Send results back to main process
          const { ipcRenderer } = require('electron');
          ipcRenderer.send('playback-results', results);
        }

        window.onload = runTests;
      </script>
    </body>
    </html>
  `;

  ipcMain.on('playback-results', (event, results) => {
    console.log('\n=====================================================');
    console.log(' ELECTRON PLAYBACK DIAGNOSTIC RESULTS');
    console.log('=====================================================');
    for (const r of results) {
      console.log(`\nLabel: ${r.label}`);
      console.log(`  Success        : ${r.success}`);
      console.log(`  audio.src      : ${r.src}`);
      console.log(`  audio.currentSrc: ${r.currentSrc}`);
      if (!r.success) {
        console.log(`  readyState     : ${r.readyState}`);
        console.log(`  networkState   : ${r.networkState}`);
        console.log(`  audio.error    :`, JSON.stringify(r.error));
        console.log(`  Exception      : ${r.exceptionMessage}`);
      }
    }
    console.log('\n=====================================================');
    app.exit(0);
  });

  win.loadURL(`data:text/html;base64,${Buffer.from(htmlContent).toString('base64')}`);
});
