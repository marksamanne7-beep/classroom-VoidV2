import createBareServer from "@tomphttp/bare-server-node";
import { fileURLToPath } from "url";
import { createServer as createHttpsServer } from "node:https";
import { createServer as createHttpServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import serveStatic from "serve-static";
import { handleFriendsRequest } from "./friends-store.js";

const bare = createBareServer("/bare/");

const serve = serveStatic(
  fileURLToPath(new URL("../static/public", import.meta.url)),
  { fallthrough: false }
);

let gamesCatalogCache = null;
let gamesCatalogCacheTime = 0;
const gameImageCache = new Map();
const movieUpstream = "https://www.chillflix.lol";
const movieCatalogUpstream = "https://mappl.tv/api/tmdb";
const aiUpstream = "https://chat.motiftech.io/api/v1/instruct/chat";
const imageUpstream = "https://api.freeimggen.com";
const imageAnonymousId = `void-v2-${process.pid}-${Date.now().toString(36)}`;
let movieCategoriesCache = null;
const movieItemsCache = new Map();
const aiRequestHeaders = {
  "Accept": "text/event-stream",
  "Authorization": "Bearer ",
  "Content-Type": "application/json",
  "Origin": "https://chat.motiftech.io",
  "Referer": "https://chat.motiftech.io/chat",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
};
const aiClientLimits = new Map();
let activeAiStreams = 0;
const aiRateWindowMs = 60_000;
const aiRateLimit = 30;
const aiClientConcurrency = 2;
const aiGlobalConcurrency = 32;
const aiClientBucketLimit = 2048;
const aiStreamTimeoutMs = 90_000;
const rocketListPath = fileURLToPath(new URL("../attached_assets/Pasted-RocketGames-Embed-URL-List-981-game-entries-1-Speed-Esc_1787889446146.txt", import.meta.url));
const gameImagesDir = fileURLToPath(new URL("../static/public/assets/game-images/", import.meta.url));
const importedGamesManifestPath = fileURLToPath(new URL("../static/public/assets/semag-images/manifest.json", import.meta.url));
const hbmcGamesManifestPath = fileURLToPath(new URL("../static/public/assets/hbmc-games/manifest.json", import.meta.url));
const mexiGamesManifestPath = fileURLToPath(new URL("../static/public/assets/mexi-games/manifest.json", import.meta.url));
const stashGamesManifestPath = fileURLToPath(new URL("../static/public/assets/ultimate-game-stash/manifest.json", import.meta.url));
const stashLibraryManifestPath = fileURLToPath(new URL("../static/public/assets/ultimate-game-stash-library/manifest.json", import.meta.url));
let stashLibraryManifestCache = null;
let stashLibraryAllowedIds = null;
let mexiGamesManifestCache = null;
let mexiImageBySlug = null;
const featuredGames = [
  { name: "Minecraft", slug: "featured-minecraft", embed: "https://d1tm91r4ytbt54.cloudfront.net/2779cbcb-a02f-48a3-9e2e-95a8d123d165/1685483461665/web/index.html", image: "/assets/featured-images/minecraft.webp", cat: "adventure" },
  { name: "FNAF 1", slug: "featured-fnaf-1", embed: "https://irv77.github.io/hd_fnaf/1/", image: "/assets/semag-images/fnaf1.jpg" },
  { name: "FNAF 2", slug: "featured-fnaf-2", embed: "https://irv77.github.io/hd_fnaf/2/", image: "/assets/semag-images/fnaf2.jpg" },
  { name: "FNAF 3", slug: "featured-fnaf-3", embed: "https://irv77.github.io/hd_fnaf/3/", image: "/assets/semag-images/fnaf3.jpg" },
  { name: "FNAF 4", slug: "featured-fnaf-4", embed: "https://irv77.github.io/hd_fnaf/4/", image: "/assets/semag-images/fnaf4.jpg" },
  { name: "FNAF World", slug: "featured-fnaf-world", embed: "https://irv77.github.io/hd_fnaf/w/", image: null },
  { name: "FNAF Sister Location", slug: "featured-fnaf-sister-location", embed: "https://irv77.github.io/hd_fnaf/sl/", image: null },
  { name: "FNAF Pizzeria Simulator", slug: "featured-fnaf-pizzeria-simulator", embed: "https://irv77.github.io/hd_fnaf/ps/", image: null },
  { name: "FNAF Ultimate Custom Night", slug: "featured-fnaf-ultimate-custom-night", embed: "https://irv77.github.io/hd_fnaf/ucn/", image: null },
].map(game => ({ ...game, source: "featured", new: true, cat: game.cat || "horror" }));

function gameCategory(name) {
  const value = name.toLowerCase();
  if (/racing|car|truck|bike|moto|drift|driving|motor|parking/.test(value)) return "racing";
  if (/puzzle|2048|word|brain|match|mahjong|block| sudoku|memory/.test(value)) return "puzzle";
  if (/shoot|gun|war|battle|zombie|sniper|fire|strike/.test(value)) return "shooter";
  if (/sport|soccer|football|basket|tennis|golf|pool|bowling/.test(value)) return "sports";
  if (/strategy|tower|kingdom|idle|merge|farm|tycoon|defense/.test(value)) return "strategy";
  if (/horror|scary|escape|survive|monster/.test(value)) return "horror";
  if (/adventure|quest|hero|ninja|platform|temple/.test(value)) return "adventure";
  if (/classic|retro|snake|solitaire|chess|checkers/.test(value)) return "classic";
  return "casual";
}

function getStashLibraryManifest() {
  if (stashLibraryManifestCache) return stashLibraryManifestCache;
  stashLibraryManifestCache = existsSync(stashLibraryManifestPath)
    ? JSON.parse(readFileSync(stashLibraryManifestPath, "utf8"))
    : [];
  stashLibraryAllowedIds = new Set(
    stashLibraryManifestCache.map(game => game.driveId).filter(Boolean)
  );
  return stashLibraryManifestCache;
}

function getMexiGamesManifest() {
  if (mexiGamesManifestCache) return mexiGamesManifestCache;
  const manifest = existsSync(mexiGamesManifestPath)
    ? JSON.parse(readFileSync(mexiGamesManifestPath, "utf8"))
    : [];
  mexiImageBySlug = new Map();
  mexiGamesManifestCache = manifest.flatMap(game => {
    if (!game?.name || !game?.embed || !game?.slug) return [];
    let hasApprovedImage = false;
    if (game.imageUrl) {
      try {
        const imageUrl = new URL(game.imageUrl);
        hasApprovedImage = imageUrl.protocol === "https:"
          && imageUrl.hostname === "mexi.rest"
          && imageUrl.pathname.startsWith("/previews/");
        if (hasApprovedImage) mexiImageBySlug.set(game.slug, imageUrl.href);
      } catch {
        hasApprovedImage = false;
      }
    }
    return [{
      name: game.name,
      embed: game.embed,
      slug: game.slug,
      image: hasApprovedImage ? `/api/mexi-image?slug=${encodeURIComponent(game.slug)}` : null,
      source: "mexi",
      new: true,
    }];
  });
  return mexiGamesManifestCache;
}

function spreadEmulatorRows(emulatorGames, regularGames) {
  const ordered = [];
  let emulatorIndex = 0;
  let regularIndex = 0;
  while (emulatorIndex < emulatorGames.length) {
    const emulatorBatch = emulatorGames
      .slice(emulatorIndex, emulatorIndex + 10)
      .map((game, index) => ({ ...game, emulatorGroupStart: index === 0 }));
    ordered.push(...emulatorBatch);
    emulatorIndex += emulatorBatch.length;
    ordered.push(...regularGames.slice(regularIndex, regularIndex + 50));
    regularIndex += 50;
  }
  ordered.push(...regularGames.slice(regularIndex));
  return ordered;
}

function getGamesCatalog() {
  if (gamesCatalogCache && Date.now() - gamesCatalogCacheTime < 15 * 60 * 1000) {
    return gamesCatalogCache;
  }
  const source = readFileSync(rocketListPath, "utf8");
  const rocketGames = source.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*(.+?)\s+—\s+(https:\/\/www\.rocketgames\.io\/embed\/([a-z0-9-]+))\s*$/i);
    if (!match) return [];
    const [, name, embed, slug] = match;
    const localImage = `${gameImagesDir}${slug}.jpg`;
    const image = existsSync(localImage)
      ? `/assets/game-images/${slug}.jpg`
      : `/api/game-image?slug=${slug}`;
    return [{ name, embed, slug, cat: gameCategory(name), image }];
  });
  const importedGames = existsSync(importedGamesManifestPath)
    ? JSON.parse(readFileSync(importedGamesManifestPath, "utf8"))
      .flatMap(game => {
        if (!game?.name || !game?.embed || !game?.slug || !game?.image) return [];
        return [{
          name: game.name,
          embed: game.embed,
          slug: game.slug,
          cat: gameCategory(game.name),
          image: game.image,
          source: "semag",
        }];
      })
    : [];
  const topImportedSlugs = new Set(["gtavc", "badparenting", "escaperoadcity2", "ultrakill"]);
  const topImportedGames = importedGames.filter(game => topImportedSlugs.has(game.slug));
  const remainingImportedGames = importedGames.filter(game => !topImportedSlugs.has(game.slug));
  const mexiGames = getMexiGamesManifest().map(game => ({
    ...game,
    cat: gameCategory(game.name),
  }));
  const hbmcGames = existsSync(hbmcGamesManifestPath)
    ? JSON.parse(readFileSync(hbmcGamesManifestPath, "utf8")).flatMap(game => {
        if (!game?.name || !game?.embed || !game?.slug) return [];
        return [{
          name: game.name,
          embed: game.embed,
          slug: game.slug,
          cat: gameCategory(game.name),
          image: game.image || null,
          source: "hbmc",
        }];
      })
    : [];
  const stashGames = existsSync(stashGamesManifestPath)
    ? JSON.parse(readFileSync(stashGamesManifestPath, "utf8")).flatMap(game => {
        if (!game?.name || !game?.embed || !game?.slug) return [];
        return [{
          name: game.name,
          embed: game.embed,
          slug: game.slug,
          cat: gameCategory(game.name),
          image: game.image || null,
          source: "stash",
          new: true,
        }];
      })
    : [];
  const stashLibraryGames = getStashLibraryManifest().flatMap(game => {
    if (!game?.name || !game?.embed || !game?.slug || !game?.driveId) return [];
    return [{
      name: game.name,
      embed: game.embed,
      slug: game.slug,
      cat: gameCategory(game.name),
      image: game.image || null,
      source: "stash-library",
      new: true,
    }];
  });
  const regularGames = [
    ...featuredGames,
    ...stashLibraryGames,
    ...hbmcGames,
    ...remainingImportedGames,
    ...rocketGames,
  ];
  gamesCatalogCache = [
    ...topImportedGames,
    ...mexiGames,
    ...spreadEmulatorRows(stashGames, regularGames),
  ];
  gamesCatalogCacheTime = Date.now();
  return gamesCatalogCache;
}

async function getRocketGameImage(slug) {
  if (gameImageCache.has(slug)) return gameImageCache.get(slug);
  try {
    const pageResponse = await fetch(`https://www.rocketgames.io/embed/${encodeURIComponent(slug)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VoidV2/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!pageResponse.ok) throw new Error(`Game page returned ${pageResponse.status}`);
    const html = (await pageResponse.text()).replace(/&amp;/g, "&");
    const match = html.match(/https:\/\/img\.rocketgames\.io\/icon2x\/[^"' ]+\.(?:jpg|jpeg|png|webp)/i)
      || html.match(/https:\/\/img\.rocketgames\.io\/[^"' ]+\.(?:jpg|jpeg|png|webp)/i);
    const image = match ? match[0] : null;
    if (image) gameImageCache.set(slug, image);
    return image;
  } catch {
    return null;
  }
}

async function serveGameImage(slug, res) {
  const imageUrl = await getRocketGameImage(slug);
  if (!imageUrl) return false;

  try {
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "Accept": "image/jpeg,image/png,*/*",
        "Referer": "https://www.rocketgames.io/",
        "User-Agent": "Mozilla/5.0 (compatible; VoidV2/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });
    const contentType = imageResponse.headers.get("content-type") || "";
    if (!imageResponse.ok || !contentType.startsWith("image/")) {
      throw new Error(`Image returned ${imageResponse.status}`);
    }
    const image = Buffer.from(await imageResponse.arrayBuffer());
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": image.length,
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(image);
    return true;
  } catch {
    gameImageCache.delete(slug);
    return false;
  }
}

async function serveMexiGameImage(slug, res) {
  getMexiGamesManifest();
  const imageUrl = mexiImageBySlug?.get(slug);
  if (!imageUrl) return false;
  try {
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*",
        "Referer": "https://mexi.rest/",
        "User-Agent": "Mozilla/5.0 (compatible; VoidV2/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });
    const contentType = imageResponse.headers.get("content-type") || "";
    if (!imageResponse.ok || !contentType.startsWith("image/")) {
      throw new Error(`Image returned ${imageResponse.status}`);
    }
    const image = Buffer.from(await imageResponse.arrayBuffer());
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": image.length,
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(image);
    return true;
  } catch {
    return false;
  }
}

async function getMovieCategories() {
  if (movieCategoriesCache) return movieCategoriesCache;
  movieCategoriesCache = [{ id: "all", name: "All movies" }];
  return movieCategoriesCache;
}

async function fetchMovieCatalogPage(pathname) {
  const response = await fetch(`${movieCatalogUpstream}/${pathname}`, {
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; VoidV2/1.0)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Movie catalog returned ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data?.results)) throw new Error("Movie catalog returned invalid data");
  return data;
}

function normalizeMovie(item) {
  const id = String(item?.id || "");
  const title = String(item?.title || "").trim();
  if (!id || !title) return null;
  return {
    id,
    categoryId: "all",
    title,
    category: "Chillflix",
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : String(item.poster || item.backdrop || ""),
    year: String(item.release_date || item.year || item.date || "").slice(0, 4),
    description: String(item.overview || "").slice(0, 320),
    rating: Number.isFinite(Number(item.vote_average ?? item.rating))
      ? Number(item.vote_average ?? item.rating)
      : null,
    watchUrl: `${movieUpstream}/movie/${encodeURIComponent(id)}`,
  };
}

async function getMovieItems(page = 1) {
  const cacheKey = `popular:${page}`;
  const cached = movieItemsCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 10 * 60 * 1000) return cached.payload;
  const data = await fetchMovieCatalogPage(`movie/popular?page=${page}`);
  const items = data.results.map(normalizeMovie).filter(Boolean);
  const payload = {
    items,
    total: Number(data.total_results) || items.length,
    page: Number(data.page) || page,
    totalPages: Number(data.total_pages) || page,
  };
  movieItemsCache.set(cacheKey, { payload, time: Date.now() });
  return payload;
}

async function searchMovies(query, page = 1) {
  const data = await fetchMovieCatalogPage(
    `search/movie?query=${encodeURIComponent(query)}&include_adult=false&page=${page}`,
  );
  const movies = data.results.map(normalizeMovie).filter(Boolean);
  return {
    movies,
    total: Number(data.total_results) || movies.length,
    page: Number(data.page) || page,
    totalPages: Number(data.total_pages) || page,
  };
}

function readJsonBody(request, maxBytes = 128 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function normalizedAiRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be an object.");
  }
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  if (!instruction) throw new Error("Enter a message first.");
  if (instruction.length > 12000) throw new Error("That message is too long.");

  const conversationId = body.conversation_id == null ? null : String(body.conversation_id).trim();
  const parentMessageId = body.parent_message_id == null ? null : String(body.parent_message_id).trim();
  if (conversationId && !/^[A-Za-z0-9_-]{10,80}$/.test(conversationId)) {
    throw new Error("Invalid conversation.");
  }
  if (parentMessageId && !/^[A-Za-z0-9_-]{2,80}$/.test(parentMessageId)) {
    throw new Error("Invalid conversation message.");
  }

  const models = new Set(["motif-102b", "motif-tiny", "motif-12-7b-reasoning"]);
  const model = models.has(body.model) ? body.model : "motif-102b";
  const language = typeof body.language === "string" && /^[a-z]{2}$/i.test(body.language)
    ? body.language.toLowerCase()
    : "en";
  const context = Array.isArray(body.context)
    ? body.context
      .filter(message => message && ["user", "assistant"].includes(message.role) && typeof message.text === "string")
      .slice(-12)
      .map(message => ({
        role: message.role,
        text: message.text.trim().slice(0, 4000),
      }))
      .filter(message => message.text)
    : [];
  const contextText = context.length
    ? `${context.map(message => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`).join("\n\n")}\n\nUser: ${instruction}`
    : instruction;
  if (contextText.length > 24000) throw new Error("This conversation is too long. Start a new chat.");
  return {
    conversation_id: conversationId,
    ...(parentMessageId ? { parent_message_id: parentMessageId } : {}),
    model,
    instruction: contextText,
    files: [],
    metadata: {
      reasoning: model === "motif-12-7b-reasoning",
      enable_prompt_rewrite: true,
      language,
    },
    service_name: "motif",
  };
}

function setJsonError(response, status, error, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify({ error }));
}

function aiClientId(request) {
  return request.socket.remoteAddress || "unknown";
}

function isAllowedAiOrigin(request) {
  const fetchSite = String(request.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = String(request.headers.host || "").toLowerCase();
    const forwardedHost = String(request.headers["x-forwarded-host"] || "")
      .split(",")[0].trim().toLowerCase();
    if (originHost.toLowerCase() === requestHost || originHost.toLowerCase() === forwardedHost) return true;
    // Replit's preview proxy can keep the browser's same-origin headers while
    // forwarding the request to the app with an internal Host value.
    return fetchSite === "same-origin" || fetchSite === "same-site";
  } catch {
    return false;
  }
}

function acquireAiCapacity(request) {
  const now = Date.now();
  const clientId = aiClientId(request);
  const current = aiClientLimits.get(clientId) || { attempts: [], active: 0, seenAt: now };
  current.attempts = current.attempts.filter(timestamp => now - timestamp < aiRateWindowMs);
  current.seenAt = now;
  if (current.attempts.length >= aiRateLimit) {
    aiClientLimits.set(clientId, current);
    return { allowed: false, status: 429, error: "Too many AI requests. Try again in a minute." };
  }
  if (current.active >= aiClientConcurrency || activeAiStreams >= aiGlobalConcurrency) {
    aiClientLimits.set(clientId, current);
    return { allowed: false, status: 429, error: "Void AI is busy. Wait for the current response to finish." };
  }
  current.attempts.push(now);
  current.active += 1;
  activeAiStreams += 1;
  aiClientLimits.set(clientId, current);
  if (aiClientLimits.size > aiClientBucketLimit) {
    const inactive = [...aiClientLimits.entries()]
      .filter(([, state]) => state.active === 0)
      .sort((left, right) => left[1].seenAt - right[1].seenAt);
    for (const [staleClientId] of inactive.slice(0, aiClientLimits.size - aiClientBucketLimit)) {
      aiClientLimits.delete(staleClientId);
    }
  }
  return {
    allowed: true,
    release() {
      const latest = aiClientLimits.get(clientId);
      if (latest) {
        latest.active = Math.max(0, latest.active - 1);
        latest.seenAt = Date.now();
        aiClientLimits.set(clientId, latest);
      }
      activeAiStreams = Math.max(0, activeAiStreams - 1);
    },
  };
}

setInterval(() => {
  const staleBefore = Date.now() - (aiRateWindowMs * 3);
  for (const [clientId, state] of aiClientLimits) {
    if (!state.active && state.seenAt < staleBefore) aiClientLimits.delete(clientId);
  }
}, aiRateWindowMs).unref();

async function proxyAiChat(request, response) {
  let payload;
  try {
    payload = normalizedAiRequest(await readJsonBody(request));
  } catch (error) {
    response.writeHead(400, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ error: error.message || "Invalid AI request." }));
    return;
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), aiStreamTimeoutMs);
  const abortUpstream = () => {
    if (!response.writableEnded) controller.abort();
  };
  response.on("close", abortUpstream);

  try {
    const upstreamResponse = await fetch(aiUpstream, {
      method: "POST",
      headers: aiRequestHeaders,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const detail = (await upstreamResponse.text()).trim().slice(0, 300);
      throw new Error(detail || `AI service returned ${upstreamResponse.status}.`);
    }
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    });
    await pipeline(Readable.fromWeb(upstreamResponse.body), response);
  } catch (error) {
    if (!response.headersSent) {
      setJsonError(
        response,
        error.name === "AbortError" ? 504 : 502,
        error.name === "AbortError" ? "Void AI took too long to respond." : "Void AI is temporarily unavailable.",
      );
    } else if (!response.destroyed && !controller.signal.aborted) {
      response.destroy();
    }
  } finally {
    clearTimeout(deadline);
    response.off("close", abortUpstream);
  }
}

async function proxyAiImage(request, response) {
  let body;
  try {
    body = await readJsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Request body must be an object.");
    }
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) throw new Error("Describe the image you want to create.");
    if (prompt.length > 1600) throw new Error("That image request is too long.");
    const aspectRatio = ["1:1", "4:3", "3:4", "16:9", "9:16"].includes(body.aspectRatio)
      ? body.aspectRatio
      : "1:1";
    body = { prompt, aspectRatio };
  } catch (error) {
    setJsonError(response, 400, error.message || "Invalid image request.");
    return;
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 90_000);
  const abortUpstream = () => {
    if (!response.writableEnded) controller.abort();
  };
  response.on("close", abortUpstream);

  try {
    const generateResponse = await fetch(`${imageUpstream}/api/generate`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Anon-Id": imageAnonymousId,
        "User-Agent": "VoidV2/1.0",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!generateResponse.ok) {
      const detail = (await generateResponse.text()).trim().slice(0, 300);
      throw new Error(detail || `Image service returned ${generateResponse.status}.`);
    }
    const task = await generateResponse.json();
    if (!task?.taskId) throw new Error("Image service did not return a task.");

    let result = task;
    while (!["done", "failed", "expired"].includes(result.status)) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusResponse = await fetch(
        `${imageUpstream}/api/tasks/${encodeURIComponent(task.taskId)}`,
        { headers: { "Accept": "application/json", "User-Agent": "VoidV2/1.0" }, signal: controller.signal },
      );
      if (!statusResponse.ok) throw new Error(`Image status returned ${statusResponse.status}.`);
      result = await statusResponse.json();
    }
    if (result.status !== "done" || typeof result.resultUrl !== "string") {
      throw new Error(result.error || "The image could not be created.");
    }

    const imageUrl = new URL(result.resultUrl, imageUpstream);
    if (imageUrl.origin !== imageUpstream || !imageUrl.pathname.startsWith("/results/")) {
      throw new Error("Image service returned an invalid result.");
    }
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({
      imageUrl: imageUrl.href,
      prompt: body.prompt,
      aspectRatio: body.aspectRatio,
    }));
  } catch (error) {
    if (!response.headersSent) {
      setJsonError(
        response,
        error.name === "AbortError" ? 504 : 502,
        error.name === "AbortError" ? "Image generation took too long." : "The image generator is temporarily unavailable.",
      );
    }
  } finally {
    clearTimeout(deadline);
    response.off("close", abortUpstream);
  }
}

var server;
if (existsSync("../ssl/key.pem") && existsSync("../ssl/cert.pem")) {
  server = createHttpsServer({
    key: readFileSync("../ssl/key.pem"),
    cert: readFileSync("../ssl/cert.pem"),
  });
} else server = createHttpServer();

server.on("request", async (req, res) => {
  if (bare.shouldRoute(req)) { bare.routeRequest(req, res); return; }

  const urlObj = new URL(req.url, "http://localhost");

  if (await handleFriendsRequest(req, res, urlObj)) return;

  if (urlObj.pathname === "/api/ai/chat") {
    if (req.method !== "POST") {
      setJsonError(res, 405, "Method not allowed.", { "Allow": "POST" });
      return;
    }
    if (!isAllowedAiOrigin(req)) {
      setJsonError(res, 403, "Cross-site AI requests are not allowed.");
      return;
    }
    if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      setJsonError(res, 415, "Content-Type must be application/json.");
      return;
    }
    const capacity = acquireAiCapacity(req);
    if (!capacity.allowed) {
      setJsonError(res, capacity.status, capacity.error, { "Retry-After": "60" });
      return;
    }
    try {
      await proxyAiChat(req, res);
    } finally {
      capacity.release();
    }
    return;
  }

  if (urlObj.pathname === "/api/ai/image") {
    if (req.method !== "POST") {
      setJsonError(res, 405, "Method not allowed.", { "Allow": "POST" });
      return;
    }
    if (!isAllowedAiOrigin(req)) {
      setJsonError(res, 403, "Cross-site AI requests are not allowed.");
      return;
    }
    if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      setJsonError(res, 415, "Content-Type must be application/json.");
      return;
    }
    const capacity = acquireAiCapacity(req);
    if (!capacity.allowed) {
      setJsonError(res, capacity.status, capacity.error, { "Retry-After": "60" });
      return;
    }
    try {
      await proxyAiImage(req, res);
    } finally {
      capacity.release();
    }
    return;
  }

  if (urlObj.pathname === "/api/movies/categories") {
    try {
      const categories = await getMovieCategories();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" });
      res.end(JSON.stringify({ categories }));
    } catch {
      setJsonError(res, 502, "The Chillflix movie catalog is temporarily unavailable.");
    }
    return;
  }

  if (urlObj.pathname === "/api/movies/catalog") {
    const categoryId = String(urlObj.searchParams.get("category") || "");
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(categoryId)) {
      setJsonError(res, 400, "Choose a movie category.");
      return;
    }
    try {
      const page = Math.max(1, Math.min(500, Number(urlObj.searchParams.get("page")) || 1));
      const result = await getMovieItems(page);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" });
      res.end(JSON.stringify({
        movies: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      }));
    } catch {
      setJsonError(res, 502, "The Chillflix movie catalog could not be loaded.");
    }
    return;
  }

  if (urlObj.pathname === "/api/movies/search") {
    const query = String(urlObj.searchParams.get("q") || "").trim().slice(0, 100);
    if (query.length < 2) {
      setJsonError(res, 400, "Enter at least two characters.");
      return;
    }
    try {
      const page = Math.max(1, Math.min(500, Number(urlObj.searchParams.get("page")) || 1));
      const result = await searchMovies(query, page);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(result));
    } catch {
      setJsonError(res, 502, "Chillflix search is temporarily unavailable.");
    }
    return;
  }

  if (urlObj.pathname === "/api/games") {
    try {
      const games = await getGamesCatalog();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=900" });
      res.end(JSON.stringify(games));
    } catch {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Game catalog unavailable" }));
    }
    return;
  }

  if (urlObj.pathname === "/api/mexi-image") {
    const slug = urlObj.searchParams.get("slug");
    if (!slug || !(await serveMexiGameImage(slug, res))) {
      res.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      res.end("Image not found");
    }
    return;
  }

  if (urlObj.pathname === "/api/stash-game") {
    const id = urlObj.searchParams.get("id");
    getStashLibraryManifest();
    if (!id || !stashLibraryAllowedIds?.has(id)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Game not found");
      return;
    }
    try {
      const gameResponse = await fetch(
        `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; VoidV2/1.0)" },
          signal: AbortSignal.timeout(45000),
        }
      );
      if (!gameResponse.ok) throw new Error(`Game file returned ${gameResponse.status}`);
       let gameHtml = Buffer.from(await gameResponse.arrayBuffer())
         .toString("utf8")
         .replace(
           /window\.addEventListener\("load",\s*function\s*\(\)\s*\{\s*if\s*\("serviceWorker"\s+in\s+navigator\)\s*\{\s*navigator\.serviceWorker\.register\("ServiceWorker\.js"\);\s*\}\s*\}\);/s,
           "",
         );
       if (id === "1ACModt_bmoVL-P1QrLGPFP_TuWYby9Nw") {
         gameHtml = gameHtml
           .replace(
             /(<body[^>]*>)/i,
             `$1
    <div id="void-hypper-loader" style="position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#050509;color:#fff;font-family:Arial,sans-serif;text-align:center">
      <div>
        <div style="font-size:clamp(28px,5vw,54px);font-weight:800">Hypper Sandbox</div>
        <div id="void-hypper-status" style="margin-top:16px;color:#aaa;font-size:15px">Downloading game files…</div>
        <div style="width:min(420px,72vw);height:6px;margin:20px auto 0;overflow:hidden;border-radius:999px;background:#24242d">
          <div id="void-hypper-progress" style="width:12%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#796cff,#b4aaff);transition:width .2s"></div>
        </div>
      </div>
    </div>`,
           )
           .replace(
             "const bytes = await fetchAndCombineZip(binUrls);",
             `const bytes = await fetchAndCombineZip(binUrls);
    document.getElementById("void-hypper-status").textContent = "Unpacking game…";
    document.getElementById("void-hypper-progress").style.width = "38%";`,
           )
           .replace(
             /createUnityInstance\(canvas,\s*config,\s*\(progress\)\s*=>\s*\{\s*\}\)/,
             `createUnityInstance(canvas, config, (progress) => {
        document.getElementById("void-hypper-status").textContent = "Starting game… " + Math.round(progress * 100) + "%";
        document.getElementById("void-hypper-progress").style.width = (38 + progress * 62) + "%";
      })`,
           )
           .replace(
             "gameInstance = unityInstance;",
             `gameInstance = unityInstance;
        document.getElementById("void-hypper-loader")?.remove();`,
           );
       }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
         "Cache-Control": "public, max-age=3600",
         "Content-Length": Buffer.byteLength(gameHtml),
      });
      res.end(gameHtml);
    } catch {
      res.writeHead(502, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      res.end("Game file is temporarily unavailable");
    }
    return;
  }

  if (urlObj.pathname === "/api/rocket-game-image" || urlObj.pathname === "/api/game-image") {
    const slug = urlObj.searchParams.get("slug");
    if (!slug) { res.writeHead(400); res.end(); return; }
    const served = await serveGameImage(slug, res);
    if (!served) { res.writeHead(404, { "Cache-Control": "no-store" }); res.end(); }
    return;
  }

  // ── CORS preflight ────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");

  // ── Static files ──────────────────────────────────────────
  serve(req, res, (err) => {
    res.writeHead(err?.statusCode || 500, null, { "Content-Type": "text/plain" });
    res.end("Error");
  });
});

server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req, socket, head)) bare.routeUpgrade(req, socket, head);
  else socket.end();
});

server.on("listening", () => {
  const addr = server.address();
  console.log(`Elixir running on port ${addr.port}`);
  console.log("");
  console.log("You may now access it using your browser!");
  console.log(
    `Local: http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`
  );
  if (process.env.REPL_SLUG && process.env.REPL_OWNER)
    console.log(`Replit: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
});

server.listen({ port: process.env.PORT || 5000 });
