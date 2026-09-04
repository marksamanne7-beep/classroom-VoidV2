import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const listPath = fileURLToPath(new URL(
  "../attached_assets/Pasted-RocketGames-Embed-URL-List-981-game-entries-1-Speed-Esc_1787889446146.txt",
  import.meta.url
));
const outputDir = fileURLToPath(new URL("../static/public/assets/game-images/", import.meta.url));
const source = await readFile(listPath, "utf8");
const games = source.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^\s*(.+?)\s+—\s+(https:\/\/www\.rocketgames\.io\/embed\/([a-z0-9-]+))\s*$/i);
  return match ? [{ name: match[1], embed: match[2], slug: match[3] }] : [];
});

await mkdir(outputDir, { recursive: true });

let completed = 0;
let downloaded = 0;
let skipped = 0;
let failed = 0;
let cursor = 0;

async function fileAlreadyDownloaded(path) {
  try {
    return (await stat(path)).size > 100;
  } catch {
    return false;
  }
}

async function downloadGame(game) {
  const destination = `${outputDir}${game.slug}.jpg`;
  if (await fileAlreadyDownloaded(destination)) {
    skipped++;
    return;
  }

  try {
    const pageResponse = await fetch(game.embed, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VoidV2/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageResponse.ok) throw new Error(`page ${pageResponse.status}`);
    const html = (await pageResponse.text()).replace(/&amp;/g, "&");
    const imageMatch = html.match(/https:\/\/img\.rocketgames\.io\/icon2x\/[^"' ]+\.(?:jpg|jpeg|png|webp)/i)
      || html.match(/https:\/\/img\.rocketgames\.io\/[^"' ]+\.(?:jpg|jpeg|png|webp)/i);
    if (!imageMatch) throw new Error("poster URL missing");

    const imageResponse = await fetch(imageMatch[0], {
      headers: {
        "Accept": "image/jpeg,image/png,*/*",
        "Referer": "https://www.rocketgames.io/",
        "User-Agent": "Mozilla/5.0 (compatible; VoidV2/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });
    const contentType = imageResponse.headers.get("content-type") || "";
    if (!imageResponse.ok || !contentType.startsWith("image/")) {
      throw new Error(`poster ${imageResponse.status}`);
    }
    const image = Buffer.from(await imageResponse.arrayBuffer());
    if (image.length <= 100) throw new Error("poster was empty");
    await writeFile(destination, image);
    downloaded++;
  } catch (error) {
    failed++;
    console.error(`Failed ${game.slug}: ${error.message}`);
  }
}

async function worker() {
  while (cursor < games.length) {
    const game = games[cursor++];
    await downloadGame(game);
    completed++;
    if (completed % 50 === 0 || completed === games.length) {
      console.log(`${completed}/${games.length} complete (${downloaded} downloaded, ${skipped} existing, ${failed} failed)`);
    }
  }
}

await Promise.all(Array.from({ length: 20 }, worker));

console.log(`Finished: ${downloaded} downloaded, ${skipped} existing, ${failed} failed.`);
if (failed) process.exitCode = 1;