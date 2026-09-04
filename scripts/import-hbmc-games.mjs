import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = path.join(
  projectRoot,
  "attached_assets/Pasted--git-https-assets-hbmc-net-git-1-https-assets-hbmc-net-_1787975401796.txt"
);
const outputPath = path.join(projectRoot, "static/public/assets/hbmc-games/manifest.json");
const imageDir = path.join(projectRoot, "static/public/assets/hbmc-games/images");
const imagePublicPath = "/assets/hbmc-games/images";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const source = await readFile(sourcePath, "utf8");
const entries = source
  .split(/\r?\n/)
  .map(line => {
    const match = line.match(/^(.+?)\s+—\s+(https:\/\/assets\.hbmc\.net\/[^/]+\/?)\s*$/);
    return match ? { name: match[1].trim(), url: match[2] } : null;
  })
  .filter(entry => entry && entry.name !== ".git");

function slugFor(entry, usedSlugs) {
  const folder = decodeURIComponent(new URL(entry.url).pathname.split("/").filter(Boolean).pop() || entry.name);
  const base = folder.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game";
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  const suffix = createHash("sha1").update(entry.url).digest("hex").slice(0, 6);
  const slug = `${base}-${suffix}`;
  usedSlugs.add(slug);
  return slug;
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function existingPosterMap() {
  const locations = [
    ["static/public/assets/game-images", "/assets/game-images"],
    ["static/public/assets/semag-images", "/assets/semag-images"]
  ];
  const posters = new Map();
  for (const [directory, publicPath] of locations) {
    const files = await readdir(path.join(projectRoot, directory));
    for (const file of files) {
      if (!/\.(?:png|jpe?g|webp|gif|ico)$/i.test(file)) continue;
      posters.set(normalize(path.parse(file).name), `${publicPath}/${file}`);
    }
  }
  return posters;
}

function imageCandidates(html, directoryUrl) {
  const links = [...html.matchAll(/(?:href|src)=["']([^"']+\.(?:png|jpe?g|webp|gif|ico)(?:\?[^"']*)?)["']/ig)]
    .map(match => match[1])
    .filter(link => !link.startsWith("#"));
  return [...new Set(links)]
    .map(link => {
      try { return new URL(link, directoryUrl).href; } catch { return null; }
    })
    .filter(url => url && new URL(url).hostname === "assets.hbmc.net");
}

function extensionFor(contentType, imageUrl) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("icon")) return "ico";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return path.extname(new URL(imageUrl).pathname).slice(1).toLowerCase() || "jpg";
}

async function importImage(entry, imageUrl, slug) {
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    const extension = extensionFor(contentType, imageUrl);
    const fileName = `${slug}.${extension}`;
    await writeFile(path.join(imageDir, fileName), bytes);
    return { image: `${imagePublicPath}/${fileName}`, sourceImage: imageUrl };
  } catch {
    return null;
  }
}

const usedSlugs = new Set();
const results = [];
let cursor = 0;
let imageCount = 0;

async function worker() {
  while (cursor < entries.length) {
    const entry = entries[cursor++];
    const slug = slugFor(entry, usedSlugs);
    let image = null;
    try {
      const response = await fetch(entry.url, { signal: AbortSignal.timeout(20000) });
      const html = await response.text();
      const candidates = imageCandidates(html, entry.url);
      for (const imageUrl of candidates) {
        image = await importImage(entry, imageUrl, slug);
        if (image) break;
      }
    } catch {
      // Keep the game entry even when its optional artwork is unavailable.
    }
    if (image) imageCount++;
    results.push({
      name: entry.name,
      embed: entry.url,
      slug,
      image: image?.image || null,
      sourceImage: image?.sourceImage || null,
      source: "hbmc"
    });
    if (results.length % 25 === 0) {
      console.log(`Processed ${results.length}/${entries.length} games (${imageCount} local images)`);
    }
  }
}

await mkdir(imageDir, { recursive: true });
await Promise.all(Array.from({ length: 16 }, worker));
results.sort((a, b) => entries.findIndex(entry => entry.url === a.embed) - entries.findIndex(entry => entry.url === b.embed));
const existingPosters = await existingPosterMap();
let reusedImageCount = 0;
for (const game of results) {
  if (game.image) continue;
  const existingImage = existingPosters.get(normalize(game.slug)) || existingPosters.get(normalize(game.name));
  if (!existingImage) continue;
  game.image = existingImage;
  reusedImageCount++;
}
await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(`Imported ${results.length} games with ${imageCount} new images and ${reusedImageCount} reused local posters.`);