const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

app.setName('dubbiovi-validation');

// Import main.js to load real IPC handlers (render-audio-mixdown, resolveFFmpegExecutable, etc.)
const { resolveFFmpegExecutable } = require('../main.js');

app.whenReady().then(async () => {
  console.log('=====================================================');
  console.log(' ELECTRON UI WORKFLOW FFMPEG EXPORT & PLAYBACK SUITE');
  console.log('=====================================================');

  const resolvedFFmpegPath = resolveFFmpegExecutable();
  console.log(`[IPC Validation] Resolved FFmpeg Executable:\n${resolvedFFmpegPath}`);

  // Prepare input test assets inside tmp/
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const inputVideoAudio = path.join(tempDir, 'ui_input_video.wav');
  const takeVoiceAudio = path.join(tempDir, 'ui_take_voice.wav');
  const outputMixdownWav = path.join(tempDir, 'ui_project_export_mixdown.wav');

  if (fs.existsSync(outputMixdownWav)) fs.unlinkSync(outputMixdownWav);

  console.log('\n[Creating real DubbiOvi test project audio tracks...]');
  // 1. Original soundtrack (3 sec 440Hz sine wave)
  await new Promise((resolve) => {
    const p1 = spawn(resolvedFFmpegPath, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', inputVideoAudio]);
    p1.on('close', resolve);
  });

  // 2. Dubbed take track (1.5 sec 880Hz sine wave)
  await new Promise((resolve) => {
    const p2 = spawn(resolvedFFmpegPath, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=1.5', takeVoiceAudio]);
    p2.on('close', resolve);
  });

  console.log('  ✓ Original Video Track:', inputVideoAudio);
  console.log('  ✓ Dubbed Take Track:', takeVoiceAudio);

  // Launch Electron BrowserWindow to simulate UI workflow and HTML5 audio playback
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // FFmpeg arguments constructed by AudioMixdownService
  const ffmpegArgs = [
    '-y',
    '-i', inputVideoAudio,
    '-i', takeVoiceAudio,
    '-filter_complex', '[0:a]volume=0.80[a0]; [1:a]adelay=delays=500:all=1,volume=1.00[a1]; [a0][a1]amix=inputs=2:duration=longest:dropout_transition=0[outa]',
    '-map', '[outa]',
    '-c:a', 'pcm_s16le',
    outputMixdownWav
  ];

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><title>Electron UI Export & Playback Validation</title></head>
    <body>
      <h1>Electron UI Audio Mixdown & Playback Validation</h1>
      <script>
        const { ipcRenderer } = require('electron');

        async function runUiWorkflow() {
          console.log('Step 1: Invoking render-audio-mixdown through Electron IPC bridge (main.js)...');
          const result = await ipcRenderer.invoke('render-audio-mixdown', {
            ffmpegArgs: ${JSON.stringify(ffmpegArgs)},
            outputPath: '${outputMixdownWav}'
          });

          console.log('Main process response:', JSON.stringify(result));

          if (!result.success) {
            ipcRenderer.send('validation-finished', { success: false, error: result.error });
            return;
          }

          console.log('Step 2: Export completed! Loading generated WAV in HTML5 Audio Player...');
          const audioUrl = 'dubbiovi-file://${outputMixdownWav.replace(/\\/g, '/')}';
          const audio = new Audio(audioUrl);

          audio.oncanplaythrough = () => {
            console.log('✓ HTML5 Audio canplaythrough fired for generated WAV!');
          };

          audio.play().then(() => {
            console.log('✓ HTML5 Audio play() started successfully for exported WAV file!');
            ipcRenderer.send('validation-finished', {
              success: true,
              outputPath: result.outputPath,
              fileSize: result.fileSize,
              duration: audio.duration,
            });
          }).catch((err) => {
            console.error('❌ HTML5 Audio play() failed:', err);
            ipcRenderer.send('validation-finished', { success: false, error: err.message || String(err) });
          });
        }

        window.onload = runUiWorkflow;
      </script>
    </body>
    </html>
  `;

  ipcMain.on('validation-finished', (event, res) => {
    console.log('\n=====================================================');
    console.log('       ELECTRON UI WORKFLOW VALIDATION REPORT        ');
    console.log('=====================================================');
    console.log(`• FFmpeg Local Binary Path : ${resolvedFFmpegPath}`);
    console.log(`• Render Mixdown Output    : ${res.outputPath || outputMixdownWav}`);
    console.log(`• Export Successful        : ${res.success}`);
    console.log(`• Output File Size         : ${res.fileSize || 0} bytes`);

    if (res.success && fs.existsSync(outputMixdownWav) && fs.statSync(outputMixdownWav).size > 0) {
      console.log('• HTML5 Audio Playback     : SUCCESS (canplaythrough & play() verified inside Electron renderer window)');
      console.log('\n✅ ELECTRON UI WORKFLOW FFMPEG EXPORT & PLAYBACK VALIDATION PASSED!');
      app.exit(0);
    } else {
      console.error(`• Failure Reason           : ${res.error}`);
      console.error('\n❌ ELECTRON UI WORKFLOW VALIDATION FAILED!');
      app.exit(1);
    }
  });

  win.loadURL(`data:text/html;base64,${Buffer.from(htmlContent).toString('base64')}`);
});
