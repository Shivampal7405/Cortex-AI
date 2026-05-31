import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const iconsDir = resolve(rootDir, 'icons');

if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Draw a letter "C" using SVG and sharp
async function generateIcon(size: number, bgColor: string, name: string) {
  const svgText = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="${size * 0.2}" fill="${bgColor}" />
      <text x="50%" y="50%" font-family="sans-serif" font-weight="bold" font-size="${size * 0.6}" fill="white" text-anchor="middle" dominant-baseline="central">C</text>
    </svg>
  `;
  
  await sharp(Buffer.from(svgText))
    .png()
    .toFile(resolve(iconsDir, name));
  
  console.log(`Generated ${name}`);
}

async function main() {
  const normalColor = '#7C3AED'; // Purple
  const warnColor = '#D97706'; // Amber
  const errorColor = '#DC2626'; // Red

  await generateIcon(16, normalColor, 'icon-16.png');
  await generateIcon(32, normalColor, 'icon-32.png');
  await generateIcon(48, normalColor, 'icon-48.png');
  await generateIcon(128, normalColor, 'icon-128.png');
  
  await generateIcon(48, warnColor, 'icon-warn-48.png');
  await generateIcon(48, errorColor, 'icon-error-48.png');
}

main().catch(console.error);
