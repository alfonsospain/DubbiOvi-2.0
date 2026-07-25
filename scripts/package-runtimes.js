#!/usr/bin/env node

/**
 * DubbiOvi Master Cross-Platform Runtime Packager Runner
 *
 * Generic build tool for packaging local AI runtime engines (Whisper, Piper, Kokoro, XTTS, llama.cpp, FFmpeg)
 * into standardized DubbiOvi runtime archives with SHA-256 integrity checksums.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    engine: 'whisper',
    name: 'Whisper.cpp Engine',
    category: 'asr',
    version: '1.9.1',
    executable: 'whisper-cli',
    srcDir: '',
    outDir: path.resolve('./dist'),
    platform: '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--engine' || arg === '--engine-id') && args[i + 1]) config.engine = args[++i];
    else if ((arg === '--name' || arg === '--engine-name') && args[i + 1]) config.name = args[++i];
    else if (arg === '--category' && args[i + 1]) config.category = args[++i];
    else if (arg === '--version' && args[i + 1]) config.version = args[++i];
    else if ((arg === '--exec' || arg === '--binary') && args[i + 1]) config.executable = args[++i];
    else if ((arg === '--src' || arg === '--src-dir') && args[i + 1]) config.srcDir = path.resolve(args[++i]);
    else if ((arg === '--out' || arg === '--out-dir') && args[i + 1]) config.outDir = path.resolve(args[++i]);
    else if (arg === '--platform' && args[i + 1]) config.platform = args[++i];
    else if (arg === '--help') {
      console.log(`
DubbiOvi Cross-Platform Runtime Packaging CLI

Usage: node scripts/package-runtimes.js [options]

Options:
  --engine, --engine-id   Engine ID (default: whisper)
  --name, --engine-name   Display name (default: "Whisper.cpp Engine")
  --category              Domain category: asr, tts, llm, mt (default: asr)
  --version               Engine release version tag (default: 1.9.1)
  --exec, --binary        Primary binary name (default: whisper-cli)
  --src, --src-dir        Source directory containing compiled binaries
  --out, --out-dir        Destination folder (default: ./dist)
  --platform              Target platform: darwin_arm64, darwin_x64, win32_x64, linux_x64, or all
`);
      process.exit(0);
    }
  }

  return config;
}

function resolveSourceDir(config, platform, arch) {
  if (config.srcDir && fs.existsSync(config.srcDir)) {
    return config.srcDir;
  }

  const platformKey = `${platform}_${arch}`;
  const candidates = [
    path.resolve(`./dist/${config.engine}-${platformKey}/bin`),
    path.resolve(`./dist/${config.engine}-${platformKey}`),
    path.resolve(`./dist/${platformKey}/bin`),
    path.resolve(`./bin/${platformKey}`),
    path.resolve(`./bin`),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      const execName = platform === 'win32' ? `${config.executable}.exe` : config.executable;
      if (fs.existsSync(path.join(cand, execName)) || fs.existsSync(path.join(cand, config.executable))) {
        return cand;
      }
    }
  }

  // Default fallback if specified explicitly or default path
  return candidates[0];
}

async function main() {
  const config = parseArgs();
  console.log(`=================================================================`);
  console.log(`   DUBBIOVI MASTER RUNTIME PACKAGING PIPELINE`);
  console.log(`=================================================================`);
  console.log(`Engine         : ${config.engine} (${config.name})`);
  console.log(`Category       : ${config.category}`);
  console.log(`Version        : ${config.version}`);
  console.log(`Binary Name    : ${config.executable}`);
  console.log(`Output Folder  : ${config.outDir}`);
  console.log(`=================================================================`);

  const targets = config.platform
    ? [config.platform]
    : [`${process.platform}_${process.arch}`];

  for (const target of targets) {
    let [platform, arch] = target.split('_');
    if (!platform || !arch) {
      platform = process.platform;
      arch = process.arch;
    }

    const srcDir = resolveSourceDir(config, platform, arch);
    console.log(`\n[Packaging Target: ${platform}_${arch}]`);
    console.log(`  Source directory: ${srcDir}`);

    const packagerCli = path.join(__dirname, 'packager', 'index.js');
    const packagerArgs = [
      packagerCli,
      '--engine', config.engine,
      '--engine-name', config.name,
      '--category', config.category,
      '--version', config.version,
      '--exec', config.executable,
      '--src', srcDir,
      '--out', config.outDir,
      '--target-platform', platform,
      '--target-arch', arch,
    ];

    const res = spawnSync(process.execPath, packagerArgs, { stdio: 'inherit' });
    if (res.status !== 0) {
      console.error(`❌ Packaging failed for target ${platform}_${arch}`);
      process.exit(res.status || 1);
    }
  }

  console.log(`\n=================================================================`);
  console.log(` ALL RUNTIME PACKAGES SUCCESSFULLY GENERATED & VERIFIED (100%)`);
  console.log(`=================================================================`);
}

main().catch((err) => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
