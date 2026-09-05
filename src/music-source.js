// Native music backend for Void Music.
// Catalog, search and streams come straight from JioSaavn's public web API;
// lyrics come from lrclib.net. This replaces the venom-music.vercel.app proxy,
// whose deployment was disabled upstream (402 DEPLOYMENT_DISABLED).

const SAAVN_API = "https://www.jiosaavn.com/api.php";
const LYRICS_API = "https://lrclib.net/api/get";
const HOME_CACHE_MS = 10 * 60 * 1000;
const STREAM_CACHE_MS = 30 * 60 * 1000;
const MAX_HOME_TRACKS = 40;

const requestHeaders = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.jiosaavn.com/",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
};

let homeCache = null;
let homeCacheTime = 0;
const streamUrlCache = new Map();

// --- DES-ECB (pure JS) -------------------------------------------------------
// JioSaavn encrypts media URLs with single DES using a well-known static key.
// OpenSSL 3 (Node 17+) disables single DES in its default provider, so the
// primitive is implemented here instead of relying on node:crypto.

const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const SBOX = [
  [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
  [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
  [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
  [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
  [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
  [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
  [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
  [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11],
];

function bytesToBits(bytes) {
  const bits = [];
  for (const byte of bytes) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  return bits;
}

function bitsToBytes(bits) {
  const bytes = Buffer.alloc(bits.length / 8);
  for (let i = 0; i < bits.length; i++) bytes[i >> 3] |= bits[i] << (7 - (i & 7));
  return bytes;
}

function permute(bits, table) {
  return table.map(position => bits[position - 1]);
}

function desSubkeys(keyBytes) {
  const permuted = permute(bytesToBits(keyBytes), PC1);
  let c = permuted.slice(0, 28);
  let d = permuted.slice(28);
  return SHIFTS.map(shift => {
    c = [...c.slice(shift), ...c.slice(0, shift)];
    d = [...d.slice(shift), ...d.slice(0, shift)];
    return permute([...c, ...d], PC2);
  });
}

function feistel(right, subkey) {
  const expanded = permute(right, E).map((bit, index) => bit ^ subkey[index]);
  const output = [];
  for (let box = 0; box < 8; box++) {
    const chunk = expanded.slice(box * 6, box * 6 + 6);
    const row = (chunk[0] << 1) | chunk[5];
    const column = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
    const value = SBOX[box][row * 16 + column];
    output.push((value >> 3) & 1, (value >> 2) & 1, (value >> 1) & 1, value & 1);
  }
  return permute(output, P);
}

function desDecryptBlock(block, subkeys) {
  const bits = permute(bytesToBits(block), IP);
  let left = bits.slice(0, 32);
  let right = bits.slice(32);
  for (let round = 15; round >= 0; round--) {
    const next = feistel(right, subkeys[round]).map((bit, index) => bit ^ left[index]);
    left = right;
    right = next;
  }
  return bitsToBytes(permute([...right, ...left], FP));
}

function desEcbDecrypt(cipherText, key) {
  const subkeys = desSubkeys(key);
  const blocks = [];
  for (let offset = 0; offset + 8 <= cipherText.length; offset += 8) {
    blocks.push(desDecryptBlock(cipherText.subarray(offset, offset + 8), subkeys));
  }
  const plain = Buffer.concat(blocks);
  const pad = plain[plain.length - 1];
  return pad >= 1 && pad <= 8 ? plain.subarray(0, plain.length - pad) : plain;
}

function decryptMediaUrl(encrypted) {
  if (!encrypted) return "";
  const url = desEcbDecrypt(Buffer.from(encrypted, "base64"), Buffer.from("38346591")).toString("utf8");
  return /^https?:\/\//.test(url) ? url : "";
}

// --- Catalog helpers ---------------------------------------------------------

function decodeHtml(text) {
  return String(text ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function upscaleImage(url) {
  return String(url || "").replace(/-\d+x\d+\.(jpe?g|png|webp)$/i, "-500x500.$1");
}

function normalizeTrack(song) {
  if (!song || song.type !== "song" || !song.id) return null;
  const info = song.more_info || {};
  const artistMap = info.artistMap || {};
  const primary = Array.isArray(artistMap.primary_artists) && artistMap.primary_artists.length
    ? artistMap.primary_artists
    : Array.isArray(artistMap.artists) ? artistMap.artists : [];
  const artists = primary.map(artist => ({ name: decodeHtml(artist?.name) })).filter(artist => artist.name);
  if (!artists.length && song.subtitle) {
    artists.push({ name: decodeHtml(String(song.subtitle).split(" - ")[0]) });
  }
  const image = String(song.image || "");
  return {
    id: String(song.id),
    title: decodeHtml(song.title || song.song),
    album: decodeHtml(info.album || song.album || ""),
    artists,
    image,
    imageLarge: upscaleImage(image),
    duration: Number(info.duration || song.duration) || 0,
    streams: Boolean(info.encrypted_media_url),
  };
}

async function saavnRequest(params) {
  const url = new URL(SAAVN_API);
  url.search = new URLSearchParams({
    _format: "json",
    _marker: "0",
    api_version: "4",
    ctx: "web6dot0",
    ...params,
  }).toString();
  const response = await fetch(url, { headers: requestHeaders, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Music source returned ${response.status}`);
  // JioSaavn occasionally prefixes JSON with stray HTML; trim to the first brace.
  const text = await response.text();
  const start = text.search(/[[{]/);
  if (start < 0) throw new Error("Music source returned an unreadable response.");
  return JSON.parse(text.slice(start));
}

function collectSongs(value, output = [], seen = new Set()) {
  if (!value || output.length >= MAX_HOME_TRACKS) return output;
  if (Array.isArray(value)) {
    for (const item of value) collectSongs(item, output, seen);
    return output;
  }
  if (typeof value !== "object") return output;
  const track = normalizeTrack(value);
  if (track && !seen.has(track.id)) {
    seen.add(track.id);
    output.push(track);
    return output;
  }
  for (const item of Object.values(value)) collectSongs(item, output, seen);
  return output;
}

async function getPlaylistSongs(listId) {
  try {
    const data = await saavnRequest({ __call: "playlist.getDetails", listid: String(listId), p: "1", n: "25" });
    return Array.isArray(data?.list) ? data.list.map(normalizeTrack).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function getMusicHome() {
  if (homeCache && Date.now() - homeCacheTime < HOME_CACHE_MS) return homeCache;
  const launch = await saavnRequest({ __call: "webapi.getLaunchData" });
  const tracks = collectSongs(launch.new_trending);
  const seen = new Set(tracks.map(track => track.id));

  const charts = Array.isArray(launch.charts) ? launch.charts.filter(chart => chart?.type === "playlist").slice(0, 2) : [];
  const chartSongs = await Promise.all(charts.map(chart => getPlaylistSongs(chart.id)));
  for (const track of chartSongs.flat()) {
    if (tracks.length >= MAX_HOME_TRACKS) break;
    if (!seen.has(track.id)) {
      seen.add(track.id);
      tracks.push(track);
    }
  }
  if (!tracks.length) throw new Error("No music available right now.");
  homeCache = { tracks };
  homeCacheTime = Date.now();
  return homeCache;
}

export async function searchMusic(query, page = 1) {
  const data = await saavnRequest({ __call: "search.getResults", q: query, p: String(page), n: "30" });
  const tracks = Array.isArray(data?.results) ? data.results.map(normalizeTrack).filter(Boolean) : [];
  return { tracks, total: Number(data?.total) || tracks.length };
}

async function resolveStreamUrl(id, quality) {
  const cacheKey = `${id}:${quality}`;
  const cached = streamUrlCache.get(cacheKey);
  if (cached && Date.now() - cached.time < STREAM_CACHE_MS) return cached.url;

  const data = await saavnRequest({ __call: "song.getDetails", pids: id });
  const song = data?.songs?.[0] || data?.[id];
  const encrypted = song?.more_info?.encrypted_media_url || song?.encrypted_media_url;
  const baseUrl = decryptMediaUrl(encrypted);
  if (!baseUrl) throw new Error("Stream is unavailable for this track.");
  const has320 = String(song?.more_info?.["320kbps"] ?? song?.["320kbps"]) === "true";
  const bitrate = quality === "320" && !has320 ? "160" : quality;
  const url = baseUrl.replace(/_\d+\.(mp4|m4a|mp3)(\?|$)/, `_${bitrate}.$1$2`);
  streamUrlCache.set(cacheKey, { url, time: Date.now() });
  if (streamUrlCache.size > 500) streamUrlCache.delete(streamUrlCache.keys().next().value);
  return url;
}

export async function fetchMusicStream(id, quality, rangeHeader) {
  const url = await resolveStreamUrl(id, quality);
  const headers = {
    "User-Agent": requestHeaders["User-Agent"],
    "Accept": "audio/*,*/*",
    ...(rangeHeader ? { Range: rangeHeader } : {}),
  };
  return fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
}

export async function getMusicLyrics(title, artist) {
  const url = new URL(LYRICS_API);
  url.searchParams.set("track_name", title);
  if (artist) url.searchParams.set("artist_name", artist);
  const response = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "VoidMusic/2.0 (https://github.com/marksamanne7-beep/classroom-VoidV2)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return { syncedLyrics: "", plainLyrics: "" };
  if (!response.ok) throw new Error(`Lyrics source returned ${response.status}`);
  const data = await response.json();
  return {
    syncedLyrics: typeof data?.syncedLyrics === "string" ? data.syncedLyrics : "",
    plainLyrics: typeof data?.plainLyrics === "string" ? data.plainLyrics : "",
  };
}
