// Generates the LifeLens leaf icons (favicon, apple-touch-icon, PWA icons). Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#dce9d9";
const FG = "#426f50";
const LEAF = `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`;

function leafSvg({ radius, leafRatio, strokeWidth = 2 }) {
  const size = 512;
  const scale = (size * leafRatio) / 24;
  const offset = (size - 24 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${FG}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${LEAF}</g>
</svg>`;
}

const rounded = leafSvg({ radius: 112, leafRatio: 0.62 });
const fullBleed = leafSvg({ radius: 0, leafRatio: 0.6 });
const maskable = leafSvg({ radius: 0, leafRatio: 0.48 });
const favicon = leafSvg({ radius: 112, leafRatio: 0.7, strokeWidth: 2.4 });

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

await mkdir("public/icons", { recursive: true });
await writeFile("app/icon.svg", favicon);
await writeFile("app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(favicon, size) })))));
await writeFile("app/apple-icon.png", await png(fullBleed, 180));
await writeFile("public/icons/icon-192.png", await png(rounded, 192));
await writeFile("public/icons/icon-512.png", await png(rounded, 512));
await writeFile("public/icons/maskable-192.png", await png(maskable, 192));
await writeFile("public/icons/maskable-512.png", await png(maskable, 512));
console.log("Icons generated.");
