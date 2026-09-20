const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const canonicalMasterPath = path.join(__dirname, '..', 'assets', 'icons', 'icon-app.png');
const fallbackMasterPath = path.join(__dirname, '..', 'build', 'icon-app.png');

const publicDir = path.join(__dirname, '..', 'public');
const buildDir = path.join(__dirname, '..', 'build');

const publicPngPath = path.join(publicDir, 'icon.png');
const publicIcoPath = path.join(publicDir, 'icon.ico');
const publicIcnsPath = path.join(publicDir, 'icon.icns');

const buildPngPath = path.join(buildDir, 'icon.png');
const buildIcoPath = path.join(buildDir, 'icon.ico');
const buildIcnsPath = path.join(buildDir, 'icon.icns');
const buildMasterPath = path.join(buildDir, 'icon-app.png');

// Ensure destination directories exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

let masterPngPath = canonicalMasterPath;

if (!fs.existsSync(masterPngPath)) {
  if (fs.existsSync(fallbackMasterPath)) {
    masterPngPath = fallbackMasterPath;
  } else {
    console.error('[Icon Helper] Error: Canonical master artwork assets/icons/icon-app.png not found.');
    process.exit(1);
  }
}

// Copy master artwork to build/icon-app.png if not already there
if (masterPngPath !== buildMasterPath) {
  fs.copyFileSync(masterPngPath, buildMasterPath);
}

async function generateIcons() {
  try {
    // 1. Generate 512x512 PNG for macOS, Web app & Electron Window
    console.log('[Icon Helper] Generating 512x512 icon.png from master artwork...');
    await sharp(masterPngPath)
      .resize(512, 512)
      .png()
      .toFile(publicPngPath);
    fs.copyFileSync(publicPngPath, buildPngPath);
    console.log('[Icon Helper] Successfully generated ' + publicPngPath + ' and ' + buildPngPath);

    // 2. Generate PNG buffers for multiple sizes for the ICO file
    console.log('[Icon Helper] Generating multi-resolution icon.ico (16x16, 32x32, 48x48, 256x256)...');
    const resolutions = [16, 32, 48, 256];
    const pngBuffers = [];

    for (const size of resolutions) {
      const buffer = await sharp(masterPngPath)
        .resize(size, size)
        .png()
        .toBuffer();
      pngBuffers.push(buffer);
    }

    // Header size (6 bytes) + Directory size (16 bytes per entry * number of entries)
    const headerSize = 6;
    const entrySize = 16;
    const directorySize = resolutions.length * entrySize;
    const totalHeaderSize = headerSize + directorySize;

    // Allocate buffer for header and directory entries
    const icoHeader = Buffer.alloc(totalHeaderSize);
    
    // Write ICO Header
    icoHeader.writeUInt16LE(0, 0);                 // Reserved (must be 0)
    icoHeader.writeUInt16LE(1, 2);                 // Type (1 = ICO)
    icoHeader.writeUInt16LE(resolutions.length, 4); // Number of images in file

    let currentOffset = totalHeaderSize;

    // Write Directory Entries
    for (let i = 0; i < resolutions.length; i++) {
      const size = resolutions[i];
      const pngBuffer = pngBuffers[i];
      const entryOffset = headerSize + i * entrySize;

      // 0 means 256 in ICO width/height byte definitions
      const displaySize = size === 256 ? 0 : size;

      icoHeader.writeUInt8(displaySize, entryOffset);           // Width
      icoHeader.writeUInt8(displaySize, entryOffset + 1);       // Height
      icoHeader.writeUInt8(0, entryOffset + 2);                 // Color count (0 = no palette)
      icoHeader.writeUInt8(0, entryOffset + 3);                 // Reserved
      icoHeader.writeUInt16LE(1, entryOffset + 4);              // Color planes (1)
      icoHeader.writeUInt16LE(32, entryOffset + 6);             // Bits per pixel (32)
      icoHeader.writeUInt32LE(pngBuffer.length, entryOffset + 8); // Size of image data in bytes
      icoHeader.writeUInt32LE(currentOffset, entryOffset + 12);  // Offset of image data from beginning of file

      currentOffset += pngBuffer.length;
    }

    // Concatenate header and all PNG images
    const icoBuffer = Buffer.concat([icoHeader, ...pngBuffers]);
    fs.writeFileSync(publicIcoPath, icoBuffer);
    fs.writeFileSync(buildIcoPath, icoBuffer);
    console.log('[Icon Helper] Successfully generated ' + publicIcoPath + ' and ' + buildIcoPath);

    // 3. Generate ICNS for macOS using standard iconset and iconutil
    if (process.platform === 'darwin') {
      console.log('[Icon Helper] Generating build/icon.icns for macOS via iconutil...');
      const tempIconsetDir = path.join(buildDir, 'icon.iconset');
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
        await sharp(masterPngPath)
          .resize(entry.size, entry.size)
          .png()
          .toFile(path.join(tempIconsetDir, entry.name));
      }

      const { execSync } = require('child_process');
      execSync(`iconutil -c icns "${tempIconsetDir}" -o "${buildIcnsPath}"`);
      fs.copyFileSync(buildIcnsPath, publicIcnsPath);
      fs.rmSync(tempIconsetDir, { recursive: true, force: true });
      console.log('[Icon Helper] Successfully generated ' + publicIcnsPath + ' and ' + buildIcnsPath);
    } else {
      console.log(`[Icon Helper] Skipping macOS ICNS generation on ${process.platform}`);
    }
  } catch (err) {
    console.error('[Icon Helper] Error generating icons:', err);
    process.exit(1);
  }
}

generateIcons();
