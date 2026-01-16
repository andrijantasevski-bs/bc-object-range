const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'images', 'icon.svg');
const pngPath = path.join(__dirname, '..', 'images', 'icon.png');

const svgContent = fs.readFileSync(svgPath, 'utf8');

sharp(Buffer.from(svgContent))
  .resize(128, 128)
  .png()
  .toFile(pngPath)
  .then(() => console.log('Icon created successfully at', pngPath))
  .catch(err => console.error('Error:', err));
