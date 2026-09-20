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
 * Builds the SVG markup for small-size document sheet representations (16x16 up to 64x64).
 * Optimized for maximum readability in Finder List view and small UI contexts:
 * - Tighter outer padding so paper sheet occupies more pixels on canvas
 * - Crisp, higher-contrast paper border stroke (#94A3B8)
 * - Defined fold geometry with clear contrast
 * - Compact drop shadows to prevent blurriness at tiny resolutions
 */
function createSmallDocumentSheetSvg() {
  return `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="docSmallShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#090d16" flood-opacity="0.28" />
    </filter>
    <filter id="foldSmallShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="-6" dy="8" stdDeviation="8" flood-color="#090d16" flood-opacity="0.30" />
    </filter>
    <linearGradient id="smallSheetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="65%" stop-color="#F9FAFB" />
      <stop offset="100%" stop-color="#EFF2F7" />
    </linearGradient>
    <linearGradient id="smallFoldFlapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="35%" stop-color="#F8FAFC" />
      <stop offset="75%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
  </defs>

  <!-- Optimized paper sheet: width 720, height 880 (left: 152, right: 872; top: 72, bottom: 952) -->
  <g filter="url(#docSmallShadow)">
    <path d="
      M 184 72
      L 692 72
      L 872 252
      L 872 920
      A 32 32 0 0 1 840 952
      L 184 952
      A 32 32 0 0 1 152 920
      L 152 104
      A 32 32 0 0 1 184 72
      Z
    " fill="url(#smallSheetGrad)" stroke="#94A3B8" stroke-width="4" />
  </g>

  <!-- Fold shadow cast onto the sheet -->
  <path d="M 692 72 L 872 252 L 692 252 Z" fill="#090d16" opacity="0.16" filter="url(#foldSmallShadow)" />

  <!-- Folded Corner Flap -->
  <path d="
    M 692 72
    L 692 238
    A 14 14 0 0 0 706 252
    L 872 252
    Z
  " fill="url(#smallFoldFlapGrad)" stroke="#94A3B8" stroke-width="3" />

  <!-- Crease boundary stroke -->
  <line x1="692" y1="72" x2="872" y2="252" stroke="#94A3B8" stroke-width="3" />
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


async function generateDocumentIcons() {
  console.log('[Document Icon Helper] Generating clean master document icon from assets/icons/icon-app.png...');

  // 1. Render sheet base from SVG (1024x1024) - Large Master
  const sheetSvg = Buffer.from(createDocumentSheetSvg());
  const sheetBuffer = await sharp(sheetSvg).png().toBuffer();

  // 2. Prepare refined DubbiOvi emblem from assets/icons/icon-app.png for large master (280x280)
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

  // 5. Prepare optimized small-size document icon composition (for 16x16, 24x24, 32x32, 48x48, 64x64)
  // Features enlarged emblem (500x500), reduced whitespace, and crisp boundary for micro-legibility
  const smallSheetSvg = Buffer.from(createSmallDocumentSheetSvg());
  const smallSheetBuffer = await sharp(smallSheetSvg).png().toBuffer();

  const smallEmblemSize = 500;
  const smallSquareEmblem = await sharp(appIconSourcePath)
    .extract({ left: 81, top: 81, width: 1092, height: 1092 })
    .resize(smallEmblemSize, smallEmblemSize, {
      fit: 'fill',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  const smallPad = 30;
  const smallShadowBoxSize = smallEmblemSize + smallPad * 2;
  const smallRx = Math.round(smallEmblemSize * 0.22);
  const smallBadgeShadowSvg = `
    <svg width="${smallShadowBoxSize}" height="${smallShadowBoxSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="smallBadgeShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#090d16" flood-opacity="0.25" />
        </filter>
      </defs>
      <rect x="${smallPad}" y="${smallPad}" width="${smallEmblemSize}" height="${smallEmblemSize}" rx="${smallRx}" fill="#090d16" filter="url(#smallBadgeShadow)" opacity="0.8" />
    </svg>
  `;
  const smallShadowBuf = await sharp(Buffer.from(smallBadgeShadowSvg)).png().toBuffer();
  const smallShadowedBadge = await sharp(smallShadowBuf)
    .composite([{ input: smallSquareEmblem, left: smallPad, top: smallPad }])
    .png()
    .toBuffer();

  const smallLeft = Math.round(512 - smallShadowBoxSize / 2);
  const smallTop = Math.round(602 - smallShadowBoxSize / 2);
  const smallDocIconBuffer = await sharp(smallSheetBuffer)
    .composite([{ input: smallShadowedBadge, left: smallLeft, top: smallTop }])
    .png()
    .toBuffer();

  // 6. Generate multi-resolution Windows ICO (16, 24, 32, 48, 64, 256)
  // Sizes <= 64 use optimized small-size composition; size 256 uses approved large master
  console.log('[Document Icon Helper] Generating build/document.ico for Windows...');
  const icoResolutions = [16, 24, 32, 48, 64, 256];
  const icoBuffers = [];
  for (const size of icoResolutions) {
    const sourceBuffer = size <= 64 ? smallDocIconBuffer : masterDocIconBuffer;
    const buf = await sharp(sourceBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    icoBuffers.push(buf);
  }
  const icoBuffer = createIcoBuffer(icoResolutions, icoBuffers);
  fs.writeFileSync(outputBuildIcoPath, icoBuffer);
  console.log(`[Document Icon Helper] Wrote Windows ICO to ${outputBuildIcoPath}`);

  // 7. Generate multi-resolution macOS ICNS using standard iconset and iconutil
  // Sizes <= 64 use optimized small-size composition; sizes >= 128 use approved large master
  console.log('[Document Icon Helper] Generating build/document.icns for macOS via iconutil...');
  const tempIconsetDir = path.join(buildDir, 'document.iconset');
  if (fs.existsSync(tempIconsetDir)) {
    fs.rmSync(tempIconsetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempIconsetDir, { recursive: true });

  const iconsetEntries = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 }
  ];

  for (const entry of iconsetEntries) {
    const sourceBuffer = entry.size <= 64 ? smallDocIconBuffer : masterDocIconBuffer;
    await sharp(sourceBuffer)
      .resize(entry.size, entry.size)
      .png()
      .toFile(path.join(tempIconsetDir, entry.name));
  }

  const { execSync } = require('child_process');
  execSync(`iconutil -c icns "${tempIconsetDir}" -o "${outputBuildIcnsPath}"`);

  // Clean up temporary iconset
  fs.rmSync(tempIconsetDir, { recursive: true, force: true });
  console.log(`[Document Icon Helper] Wrote macOS ICNS to ${outputBuildIcnsPath}`);

  console.log('[Document Icon Helper] Successfully completed document icon generation.');
}

generateDocumentIcons().catch((err) => {
  console.error('[Document Icon Helper] Fatal error generating document icon:', err);
  process.exit(1);
});
