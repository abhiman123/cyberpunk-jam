const fs = require('fs');
const { PNG } = require('pngjs');

const data = fs.readFileSync('public/Red.png');
const png = PNG.sync.read(data);

let minX = png.width, maxX = 0, minY = png.height, maxY = 0;

for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
        const idx = (png.width * y + x) << 2;
        const a = png.data[idx + 3];
        if (a > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
}
console.log(`Non-transparent bounds: x: ${minX}-${maxX}, y: ${minY}-${maxY}`);
