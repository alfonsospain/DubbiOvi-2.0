import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function runOfficialIconPipelineTests() {
  console.log('=====================================================');
  console.log(' STARTING MILESTONE B2.2 OFFICIAL ICON PIPELINE TEST ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  const rootDir = path.resolve(__dirname, '..');
  const masterAppIcon = path.join(rootDir, 'build', 'icon-app.png');
  const transparentIcon = path.join(rootDir, 'build', 'icon-transparent.png');

  // Test 1: Canonical master asset existence
  console.log('[Test 1] Verifying canonical master icon asset...');
  assert(fs.existsSync(masterAppIcon), 'Canonical master build/icon-app.png exists');
  const appIconStat = fs.statSync(masterAppIcon);
  assert(appIconStat.size > 500000, `build/icon-app.png is high-resolution non-transparent PNG (${appIconStat.size} bytes)`);
  assert(fs.existsSync(transparentIcon), 'build/icon-transparent.png remains in repo for website/doc branding');

  // Test 2: Generate-icon script configuration
  console.log('\n[Test 2] Verifying scripts/generate-icon.js source target...');
  const scriptPath = path.join(rootDir, 'scripts', 'generate-icon.js');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  assert(scriptContent.includes("build/icon-app.png") || scriptContent.includes("icon-app.png"), 'scripts/generate-icon.js uses build/icon-app.png as master artwork source');
  assert(!scriptContent.includes("const masterPngPath = path.join(__dirname, '..', 'build', 'icon-transparent.png');"), 'scripts/generate-icon.js no longer uses build/icon-transparent.png as master source');

  // Test 3: Icon Generation Execution
  console.log('\n[Test 3] Executing npm run generate-icon...');
  let genOutput = '';
  try {
    genOutput = execSync('npm run generate-icon', { cwd: rootDir, encoding: 'utf8' });
    assert(true, 'npm run generate-icon executed cleanly with exit code 0');
  } catch (err: any) {
    assert(false, `npm run generate-icon failed: ${err.message}`);
  }

  // Verify output files
  const requiredFiles = [
    path.join(rootDir, 'public', 'icon.png'),
    path.join(rootDir, 'public', 'icon.ico'),
    path.join(rootDir, 'public', 'icon.icns'),
    path.join(rootDir, 'build', 'icon.png'),
    path.join(rootDir, 'build', 'icon.ico'),
    path.join(rootDir, 'build', 'icon.icns'),
  ];

  for (const filePath of requiredFiles) {
    const rel = path.relative(rootDir, filePath);
    assert(fs.existsSync(filePath) && fs.statSync(filePath).size > 0, `Generated icon asset ${rel} exists and is non-empty`);
  }

  // Test 4: electron-builder.json5 configuration
  console.log('\n[Test 4] Verifying electron-builder.json5 icon configuration...');
  const builderConfigPath = path.join(rootDir, 'electron-builder.json5');
  const builderContent = fs.readFileSync(builderConfigPath, 'utf8');
  assert(builderContent.includes('"icon": "build/icon.icns"'), 'macOS target uses build/icon.icns');
  assert(builderContent.includes('"icon": "build/icon.ico"'), 'Windows target uses build/icon.ico');

  // Test 5: main.js BrowserWindow icon configuration
  console.log('\n[Test 5] Verifying main.js BrowserWindow icon configuration...');
  const mainJsPath = path.join(rootDir, 'main.js');
  const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
  assert(mainJsContent.includes('icon.png'), 'main.js loads icon.png for Electron BrowserWindow');

  console.log('\n=====================================================');
  if (failed === 0) {
    console.log(` ALL OFFICIAL APPLICATION ICON TESTS PASSED (${passed}/${passed})`);
  } else {
    console.error(` TEST SUITE FAILED (${passed} passed, ${failed} failed)`);
  }
  console.log('=====================================================\n');

  if (failed > 0) process.exit(1);
}

runOfficialIconPipelineTests().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
