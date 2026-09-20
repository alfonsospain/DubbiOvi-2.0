const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const appIconSourcePath = path.join(rootDir, 'assets', 'icons', 'icon-app.png');
const outputPngPath = path.join(rootDir, 'assets', 'icons', 'document-icon.png');
const outputBuildIcnsPath = path.join(rootDir, 'build', 'document.icns');
const outputBuildIcoPath = path.join(rootDir, 'build', 'document.ico');

// Ensure target directories exist
const assetsIconsDir = path.join(rootDir, 'assets', 'icons');
const buildDir = path.join(rootDir, 'build');
if (!fs.existsSync(assetsIconsDir)) fs.mkdirSync(assetsIconsDir, { recursive: true });
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

if (!fs.existsSync(appIconSourcePath)) {
  console.error('[Document Icon Helper] Error: App icon source not found at ' + appIconSourcePath);
  process.exit(1);
}

/**
 * Builds the SVG markup for the document sheet canvas (1024x1024).
 * Features:
 * - Transparent background
 * - Soft layered ambient drop shadows
 * - Crisp white/light gradient paper sheet
 * - Elegantly folded top-right dog-ear corner with interior shading and diagonal crease
 * - Subtle inner paper border for high contrast across dark and light OS backgrounds
 */
function createDocumentSheetSvg() {
  return `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Soft ambient shadow beneath the paper document -->
    <filter id="docAmbientShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#090d16" flood-opacity="0.24" />
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#090d16" flood-opacity="0.12" />
    </filter>

    <!-- Shadow cast by the folded corner flap onto the main sheet -->
    <filter id="foldShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="-8" dy="10" stdDeviation="12" flood-color="#090d16" flood-opacity="0.28" />
    </filter>

    <!-- Paper sheet vertical gradient (clean modern document white) -->
    <linearGradient id="sheetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="65%" stop-color="#F9FAFB" />
      <stop offset="100%" stop-color="#EFF2F7" />
    </linearGradient>

    <!-- Folded corner flap gradient -->
    <linearGradient id="foldFlapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="35%" stop-color="#F8FAFC" />
      <stop offset="75%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>

    <!-- Diagonal crease line gradient -->
    <linearGradient id="creaseGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#94A3B8" stop-opacity="0.7" />
      <stop offset="100%" stop-color="#E2E8F0" stop-opacity="0.3" />
    </linearGradient>
  </defs>

  <!-- Document Sheet with Ambient Shadow -->
  <!-- Left: 192, Right: 832 (width 640); Top: 92, Bottom: 932 (height 840) -->
  <!-- Corner fold cut from (672, 92) to (832, 252) -> 160x160 fold -->
  <g filter="url(#docAmbientShadow)">
    <path d="
      M 224 92
      L 672 92
      L 832 252
      L 832 900
      A 32 32 0 0 1 800 932
      L 224 932
      A 32 32 0 0 1 192 900
      L 192 124
      A 32 32 0 0 1 224 92
      Z
    " fill="url(#sheetGrad)" stroke="#CBD5E1" stroke-width="2.5" />
  </g>

  <!-- Fold shadow cast onto the sheet -->
  <path d="M 672 92 L 832 252 L 672 252 Z" fill="#090d16" opacity="0.12" filter="url(#foldShadow)" />

  <!-- Folded Corner Flap -->
  <path d="
    M 672 92
    L 672 238
    A 14 14 0 0 0 686 252
    L 832 252
    Z
  " fill="url(#foldFlapGrad)" stroke="#94A3B8" stroke-width="1.5" />

  <!-- Crease boundary stroke -->
  <line x1="672" y1="92" x2="832" y2="252" stroke="url(#creaseGrad)" stroke-width="2" />
</svg>
`;
}

/**
 * Encodes an array of raw PNG buffers into a multi-resolution Windows .ico file.
 */
function createIcoBuffer(resolutions, pngBuffers) {
  const headerSize = 6;
  const entrySize = 16;
  const directorySize = resolutions.length * entrySize;
  const totalHeaderSize = headerSize + directorySize;

  const icoHeader = Buffer.alloc(totalHeaderSize);
  icoHeader.writeUInt16LE(0, 0);                 // Reserved
  icoHeader.writeUInt16LE(1, 2);                 // Type 1 = ICO
  icoHeader.writeUInt16LE(resolutions.length, 4); // Number of images

  let currentOffset = totalHeaderSize;

  for (let i = 0; i < resolutions.length; i++) {
    const size = resolutions[i];
    const pngBuffer = pngBuffers[i];
    const entryOffset = headerSize + i * entrySize;
    const displaySize = size >= 256 ? 0 : size;

    icoHeader.writeUInt8(displaySize, entryOffset);
    icoHeader.writeUInt8(displaySize, entryOffset + 1);
    icoHeader.writeUInt8(0, entryOffset + 2);                   // Palette count
    icoHeader.writeUInt8(0, entryOffset + 3);                   // Reserved
    icoHeader.writeUInt16LE(1, entryOffset + 4);                // Color planes
    icoHeader.writeUInt16LE(32, entryOffset + 6);               // Bits per pixel
    icoHeader.writeUInt32LE(pngBuffer.length, entryOffset + 8); // Image data byte length
    icoHeader.writeUInt32LE(currentOffset, entryOffset + 12);   // Image data byte offset

    currentOffset += pngBuffer.length;
  }

  return Buffer.concat([icoHeader, ...pngBuffers]);
}

/**
 * Encodes an array of PNG buffers into an Apple multi-resolution .icns file.
 */
function createIcnsBuffer(icnsSizes, pngBuffers) {
  const icnsBlocks = [];
  let icnsTotalLength = 8; // Header length ('icns' + uint32 length)

  for (let i = 0; i < icnsSizes.length; i++) {
    const { type } = icnsSizes[i];
    const buffer = pngBuffers[i];

    const blockHeader = Buffer.alloc(8);
    blockHeader.write(type, 0, 4, 'ascii');
    blockHeader.writeUInt32BE(buffer.length + 8, 4);

    icnsBlocks.push(blockHeader);
    icnsBlocks.push(buffer);
    icnsTotalLength += 8 + buffer.length;
  }

  const icnsHeader = Buffer.alloc(8);
  icnsHeader.write('icns', 0, 4, 'ascii');
  icnsHeader.writeUInt32BE(icnsTotalLength, 4);

  return Buffer.concat([icnsHeader, ...icnsBlocks]);
}

async function generateDocumentIcons() {
  console.log('[Document Icon Helper] Generating clean master document icon from assets/icons/icon-app.png...');

  // 1. Render sheet base from SVG (1024x1024)
  const sheetSvg = Buffer.from(createDocumentSheetSvg());
  const sheetBuffer = await sharp(sheetSvg).png().toBuffer();

  // 2. Prepare refined DubbiOvi emblem from assets/icons/icon-app.png
  // Extract square squircle (1092x1092) centered at (627, 627) and resize cleanly to 280x280
  const emblemSize = 280;
  const squareEmblem = await sharp(appIconSourcePath)
    .extract({ left: 81, top: 81, width: 1092, height: 1092 })
    .resize(emblemSize, emblemSize, {
      fit: 'fill',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  // 3. Render ambient drop shadow for badge (inset by 4px so no solid fill boundary can peek out)
  const shadowSvg = `
    <svg width="360" height="360" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#090d16" flood-opacity="0.22" />
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#090d16" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect x="44" y="44" width="272" height="272" rx="58" fill="#090d16" filter="url(#shadow)" opacity="0.9" />
    </svg>
  `;

  const shadowBuf = await sharp(Buffer.from(shadowSvg)).png().toBuffer();

  const shadowedBadge = await sharp(shadowBuf)
    .composite([
      {
        input: squareEmblem,
        left: 40,
        top: 40
      }
    ])
    .png()
    .toBuffer();

  // 4. Position badge centered on the document sheet's lower body:
  // Sheet horizontal center: 512. ShadowedBadge is 360 wide with badge at 40..320 (width 280).
  // Left: 512 - 180 = 332.
  // Badge vertical: y = 452. ShadowedBadge has 40px top offset, so top = 452 - 40 = 412.
  const masterDocIconBuffer = await sharp(sheetBuffer)
    .composite([
      {
        input: shadowedBadge,
        left: 332,
        top: 412
      }
    ])
    .png()
    .toBuffer();

  // Save master document icon
  fs.writeFileSync(outputPngPath, masterDocIconBuffer);
  console.log(`[Document Icon Helper] Wrote clean master icon to ${outputPngPath}`);

  // 5. Generate multi-resolution Windows ICO (16, 24, 32, 48, 64, 256)
  console.log('[Document Icon Helper] Generating build/document.ico for Windows...');
  const icoResolutions = [16, 24, 32, 48, 64, 256];
  const icoBuffers = [];
  for (const size of icoResolutions) {
    const buf = await sharp(masterDocIconBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    icoBuffers.push(buf);
  }
  const icoBuffer = createIcoBuffer(icoResolutions, icoBuffers);
  fs.writeFileSync(outputBuildIcoPath, icoBuffer);
  console.log(`[Document Icon Helper] Wrote Windows ICO to ${outputBuildIcoPath}`);

  // 6. Generate multi-resolution macOS ICNS (16, 32, 64, 128, 256, 512, 1024)
  console.log('[Document Icon Helper] Generating build/document.icns for macOS...');
  const icnsSizes = [
    { size: 16, type: 'icp4' },
    { size: 32, type: 'icp5' },
    { size: 64, type: 'icp6' },
    { size: 128, type: 'ic07' },
    { size: 256, type: 'ic08' },
    { size: 512, type: 'ic09' },
    { size: 1024, type: 'ic10' }
  ];
  const icnsBuffers = [];
  for (const { size } of icnsSizes) {
    const buf = await sharp(masterDocIconBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    icnsBuffers.push(buf);
  }
  const icnsBuffer = createIcnsBuffer(icnsSizes, icnsBuffers);
  fs.writeFileSync(outputBuildIcnsPath, icnsBuffer);
  console.log(`[Document Icon Helper] Wrote macOS ICNS to ${outputBuildIcnsPath}`);

  console.log('[Document Icon Helper] Successfully completed document icon generation.');
}

generateDocumentIcons().catch((err) => {
  console.error('[Document Icon Helper] Fatal error generating document icon:', err);
  process.exit(1);
});
