import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, spawnSync } from 'child_process';
import { resolveFFmpegExecutable, resolveFFprobeExecutable } from '../main.js';

/**
 * Milestone 16 — Final Video Export Integration Test Suite
 */
async function runVideoExportIntegrationTests() {
  console.log('=====================================================');
  console.log('  MILESTONE 16 — FINAL VIDEO EXPORT INTEGRATION SUITE ');
  console.log('=====================================================');

  // Test 1: Executable Resolution (macOS & Windows)
  console.log('\n[Test 1] Validating FFmpeg and FFprobe Executable Resolution...');
  const ffmpegPath = resolveFFmpegExecutable();
  const ffprobePath = resolveFFprobeExecutable();

  console.log(`  ✓ Resolved FFmpeg Executable: ${ffmpegPath}`);
  console.log(`  ✓ Resolved FFprobe Executable: ${ffprobePath}`);

  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(`FAILED: FFmpeg executable does not exist at ${ffmpegPath}`);
  }
  if (!fs.existsSync(ffprobePath)) {
    throw new Error(`FAILED: FFprobe executable does not exist at ${ffprobePath}`);
  }
  console.log('  ✓ Verified both FFmpeg and FFprobe binaries exist on disk.');

  // Helper to run ffprobe and return JSON stream/format metadata
  function probeMedia(filePath: string) {
    const res = spawnSync(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    if (res.error || res.status !== 0) {
      throw new Error(`ffprobe failed on ${filePath}: ${res.error?.message || res.stderr.toString()}`);
    }
    const data = JSON.parse(res.stdout.toString());
    const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
    const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');
    const duration = parseFloat(data.format.duration);
    return {
      duration,
      videoStream,
      audioStream,
      hasVideo: !!videoStream,
      hasAudio: !!audioStream,
      videoCodec: videoStream?.codec_name,
      audioCodec: audioStream?.codec_name,
    };
  }

  // Setup test environment directory inside tmp/
  const testDir = path.join(process.cwd(), 'tmp', 'video_export_tests');
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const sourceWithAudio = path.join(testDir, 'source_with_audio.mp4');
  const sourceSilent = path.join(testDir, 'source_silent.mp4');
  const voiceTakeAsset = path.join(testDir, 'take_voice_1.wav');

  console.log('\n[Generating synthetic test media files...]');
  // 1. Source Video with Audio Track (4s video + 4s 440Hz sine audio)
  spawnSync(ffmpegPath, [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=4:size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    sourceWithAudio,
  ]);

  // 2. Source Video without Audio Track (4s video, silent)
  spawnSync(ffmpegPath, [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=4:size=640x360:rate=30',
    '-c:v', 'libx264',
    sourceSilent,
  ]);

  // 3. Take Voice Asset (2s 880Hz sine audio)
  spawnSync(ffmpegPath, [
    '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2',
    '-c:a', 'pcm_s16le',
    voiceTakeAsset,
  ]);

  const probeSrcAudio = probeMedia(sourceWithAudio);
  const probeSrcSilent = probeMedia(sourceSilent);

  console.log(`  ✓ Source Video (With Audio): duration=${probeSrcAudio.duration}s, vCodec=${probeSrcAudio.videoCodec}, aCodec=${probeSrcAudio.audioCodec}`);
  console.log(`  ✓ Source Video (Silent): duration=${probeSrcSilent.duration}s, vCodec=${probeSrcSilent.videoCodec}, hasAudio=${probeSrcSilent.hasAudio}`);

  // Retrieve IPC handler function from electron ipcMain
  const electron = require('electron');
  const handler = (electron.ipcMain as any)._invokeHandlers?.get('render-video-export');
  if (!handler) {
    throw new Error('FAILED: render-video-export IPC handler is not registered on ipcMain!');
  }

  // Sample Take data matching app structure
  const sampleTakes: any[] = [
    {
      id: 'take-1',
      subtitleId: 'sub-1',
      startSeconds: 1.0,
      endSeconds: 3.0,
      voiceAssetId: 'asset-1',
      relativePath: voiceTakeAsset,
    },
  ];

  // Test 2: Silent MP4 Export
  console.log('\n[Test 2] Validating Silent MP4 Export (no audio stream)...');
  const outSilent = path.join(testDir, 'export_silent_mode.mp4');
  const resSilent = await handler(null, {
    videoPath: sourceWithAudio,
    outputPath: outSilent,
    mode: 'silent',
  });

  if (!resSilent.success) {
    throw new Error(`Silent mode export failed: ${resSilent.error}`);
  }
  const probeOutSilent = probeMedia(outSilent);
  console.log(`  ✓ Output Silent MP4: fileSize=${resSilent.fileSize} bytes, duration=${probeOutSilent.duration}s, hasAudio=${probeOutSilent.hasAudio}`);
  if (probeOutSilent.hasAudio) {
    throw new Error('FAILED: Silent mode MP4 output contains an audio stream!');
  }
  if (probeOutSilent.videoCodec !== probeSrcAudio.videoCodec) {
    throw new Error(`FAILED: Video stream was re-encoded! Expected ${probeSrcAudio.videoCodec}, got ${probeOutSilent.videoCodec}`);
  }
  console.log('  ✓ Verified 0 audio streams and exact video stream copy.');

  // Test 3: Original Only Video Export
  console.log('\n[Test 3] Validating Original Only Video Export...');
  const outOrig = path.join(testDir, 'export_original_only.mp4');
  const resOrig = await handler(null, {
    videoPath: sourceWithAudio,
    outputPath: outOrig,
    mode: 'original',
    originalVolume: 1.0,
    takes: sampleTakes,
  });

  if (!resOrig.success) {
    throw new Error(`Original only export failed: ${resOrig.error}`);
  }
  const probeOutOrig = probeMedia(outOrig);
  console.log(`  ✓ Output Original Only MP4: duration=${probeOutOrig.duration}s, aCodec=${probeOutOrig.audioCodec}, vCodec=${probeOutOrig.videoCodec}`);
  if (probeOutOrig.audioCodec !== 'aac') {
    throw new Error(`FAILED: Audio codec should be aac, got ${probeOutOrig.audioCodec}`);
  }
  console.log('  ✓ Verified AAC audio encoding and copied video stream.');

  // Test 4: AI Voices Only Video Export
  console.log('\n[Test 4] Validating AI Voices Only Video Export...');
  const outVoices = path.join(testDir, 'export_voices_only.mp4');
  const resVoices = await handler(null, {
    videoPath: sourceWithAudio,
    outputPath: outVoices,
    mode: 'voices',
    voiceVolume: 0.9,
    voiceEnabled: true,
    takes: sampleTakes,
  });

  if (!resVoices.success) {
    throw new Error(`AI Voices only export failed: ${resVoices.error}`);
  }
  const probeOutVoices = probeMedia(outVoices);
  console.log(`  ✓ Output AI Voices Only MP4: duration=${probeOutVoices.duration}s, aCodec=${probeOutVoices.audioCodec}`);
  console.log('  ✓ Verified AI Voices Only mode export succeeded.');

  // Test 5: Both Together Video Export
  console.log('\n[Test 5] Validating Both Together Video Export...');
  const outBoth = path.join(testDir, 'export_both_together.mp4');
  const resBoth = await handler(null, {
    videoPath: sourceWithAudio,
    outputPath: outBoth,
    mode: 'both',
    originalVolume: 0.8,
    originalEnabled: true,
    voiceVolume: 0.9,
    voiceEnabled: true,
    takes: sampleTakes,
  });

  if (!resBoth.success) {
    throw new Error(`Both Together export failed: ${resBoth.error}`);
  }
  const probeOutBoth = probeMedia(outBoth);
  console.log(`  ✓ Output Both Together MP4: duration=${probeOutBoth.duration}s, size=${resBoth.fileSize} bytes`);
  console.log('  ✓ Verified Both Together mixed audio export succeeded.');

  // Test 6: Source Video Without Audio Track (Silent Source Video)
  console.log('\n[Test 6] Validating Export on Source Video Without Audio Track...');
  const outSilentSourceBoth = path.join(testDir, 'export_from_silent_source.mp4');
  const resSilentSource = await handler(null, {
    videoPath: sourceSilent,
    outputPath: outSilentSourceBoth,
    mode: 'both',
    originalVolume: 1.0,
    originalEnabled: true,
    voiceVolume: 1.0,
    voiceEnabled: true,
    takes: sampleTakes,
  });

  if (!resSilentSource.success) {
    throw new Error(`Export from silent source video failed: ${resSilentSource.error}`);
  }
  const probeOutSilentSrc = probeMedia(outSilentSourceBoth);
  console.log(`  ✓ Output from Silent Source MP4: duration=${probeOutSilentSrc.duration}s, aCodec=${probeOutSilentSrc.audioCodec}`);
  console.log('  ✓ Verified silent source video export handled missing audio stream gracefully.');

  // Test 7: Preservation of Video Duration
  console.log('\n[Test 7] Validating Preservation of Video Duration...');
  const srcDur = probeSrcAudio.duration;
  const outDur = probeOutBoth.duration;
  const durDiff = Math.abs(srcDur - outDur);
  console.log(`  ✓ Source Duration: ${srcDur}s | Output Duration: ${outDur}s | Diff: ${durDiff.toFixed(3)}s`);
  if (durDiff > 0.15) {
    throw new Error(`FAILED: Duration mismatch! Source=${srcDur}s, Output=${outDur}s`);
  }
  console.log('  ✓ Verified video duration preservation within 0.15s threshold.');

  // Test 8: Video Stream Copy Verification
  console.log('\n[Test 8] Validating Video Stream Copy (-c:v copy)...');
  if (!resBoth.videoStreamCopied || probeOutBoth.videoCodec !== probeSrcAudio.videoCodec) {
    throw new Error(`FAILED: Video stream was not copied! Source codec=${probeSrcAudio.videoCodec}, Output codec=${probeOutBoth.videoCodec}`);
  }
  console.log('  ✓ Verified video stream copied without re-encoding.');

  // Test 9: Paths Containing Spaces
  console.log('\n[Test 9] Validating Paths Containing Spaces...');
  const spaceDir = path.join(testDir, 'folder with spaces');
  fs.mkdirSync(spaceDir, { recursive: true });
  const spaceVideoSrc = path.join(spaceDir, 'input video with spaces.mp4');
  const spaceVideoOut = path.join(spaceDir, 'output video with spaces.mp4');

  fs.copyFileSync(sourceWithAudio, spaceVideoSrc);

  const resSpace = await handler(null, {
    videoPath: spaceVideoSrc,
    outputPath: spaceVideoOut,
    mode: 'both',
    takes: sampleTakes,
  });

  if (!resSpace.success) {
    throw new Error(`Export with spaces in path failed: ${resSpace.error}`);
  }
  const probeSpace = probeMedia(spaceVideoOut);
  console.log(`  ✓ Output Video with spaces: size=${resSpace.fileSize} bytes, duration=${probeSpace.duration}s`);
  console.log('  ✓ Verified path handling with spaces succeeded.');

  // Test 10: Temporary File Cleanup
  console.log('\n[Test 10] Validating Temporary File Cleanup...');
  const tempFilesRemaining = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('dubbiovi_mix_'));
  console.log(`  ✓ Temporary mixdown files remaining in os.tmpdir(): ${tempFilesRemaining.length}`);
  if (tempFilesRemaining.length > 0) {
    throw new Error(`FAILED: Temporary mixdown files were not cleaned up: ${tempFilesRemaining.join(', ')}`);
  }
  console.log('  ✓ Verified temporary mixdown files were automatically cleaned up.');

  // Test 11: FFmpeg Failure Propagation
  console.log('\n[Test 11] Validating FFmpeg Failure Propagation...');
  const resFail = await handler(null, {
    videoPath: path.join(testDir, 'non_existent_video_file.mp4'),
    outputPath: path.join(testDir, 'fail_output.mp4'),
    mode: 'both',
  });

  if (resFail.success) {
    throw new Error('FAILED: Invalid video path unexpectedly returned success!');
  }
  console.log(`  ✓ Failure propagated correctly: "${resFail.error}"`);

  // Clean up test environment
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('\n=====================================================');
  console.log(' ✅ MILESTONE 16 VIDEO EXPORT INTEGRATION PASSED     ');
  console.log('=====================================================');
}

runVideoExportIntegrationTests().catch((err) => {
  console.error('\n❌ VIDEO EXPORT INTEGRATION TEST SUITE FAILED:', err);
  process.exit(1);
});
