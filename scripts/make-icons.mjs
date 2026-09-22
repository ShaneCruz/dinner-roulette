// Renders assets/app-icon.svg into the PNGs phones and browsers look for.
// Run after changing the icon: node scripts/make-icons.mjs
import { readFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync(new URL("../assets/app-icon.svg", import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

const sizes = [
  ["apple-touch-icon.png", 180],
  ["apple-touch-icon-precomposed.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["favicon-32.png", 32],
];
for (const [name, size] of sizes) {
  await sharp(svg, { density: 1200 }).resize(size, size).png().toFile(out(name));
}

// Android "maskable" icon: the design shrunk into the safe zone on the same background.
const inner = await sharp(svg, { density: 1200 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#f0ad2b" } })
  .composite([{ input: inner, left: 56, top: 56 }])
  .png()
  .toFile(out("icon-maskable-512.png"));
console.log("Icons written to public/.");
