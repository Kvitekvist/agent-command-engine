#!/usr/bin/env node
/**
 * Create .icns file from iconset directory
 * This is a fallback for when iconutil is not available (Windows/Linux)
 * Uses png2icons package to convert PNG set to .icns
 */

const fs = require('fs');
const path = require('path');

// Check if png2icons is available
try {
  require.resolve('png2icons');
} catch (e) {
  console.error('png2icons not found. Installing...');
  const { execSync } = require('child_process');
  try {
    // Update .npmrc to allow png2icons
    const npmrcPath = path.join(__dirname, '..', 'src', '.npmrc');
    let npmrc = '';
    if (fs.existsSync(npmrcPath)) {
      npmrc = fs.readFileSync(npmrcPath, 'utf8');
    }
    if (!npmrc.includes('png2icons')) {
      fs.writeFileSync(npmrcPath, npmrc + '\nallowScripts[]=png2icons@*\n');
    }

    execSync('npm install png2icons', {
      cwd: path.join(__dirname, '..', 'src'),
      stdio: 'inherit'
    });
  } catch (installErr) {
    console.error('Failed to install png2icons:', installErr.message);
    process.exit(1);
  }
}

const png2icons = require('png2icons');

const projectRoot = path.join(__dirname, '..');
const iconsetDir = path.join(projectRoot, 'assets', 'icons', 'icon.iconset');
const outputIcns = path.join(projectRoot, 'assets', 'icons', 'icon.icns');

// Check iconset exists
if (!fs.existsSync(iconsetDir)) {
  console.error(`Error: iconset directory not found at ${iconsetDir}`);
  console.error('Run scripts/create-icons.py first to generate the PNG set');
  process.exit(1);
}

console.log('Creating .icns file from PNG set...');

// Read the 1024x1024 PNG as the source
const sourceIcon = path.join(iconsetDir, 'icon_1024x1024.png');
if (!fs.existsSync(sourceIcon)) {
  console.error(`Error: Source icon not found at ${sourceIcon}`);
  process.exit(1);
}

const input = fs.readFileSync(sourceIcon);

try {
  const icnsOutput = png2icons.createICNS(input, png2icons.BILINEAR, 0);
  fs.writeFileSync(outputIcns, icnsOutput);

  const stats = fs.statSync(outputIcns);
  console.log(`✓ Successfully created: ${outputIcns}`);
  console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
} catch (err) {
  console.error('✗ Failed to create .icns file:', err.message);
  process.exit(1);
}
