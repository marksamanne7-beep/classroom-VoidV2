import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dataPath = fileURLToPath(new URL("../data/social.json", import.meta.url));
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const sessionCookieName = "void_friends_session";
const onlineWindowMs = 45_000;
const sessionMaxAge = 60 * 60 * 24 * 365;
// Avatars are capped by decoded size, but base64 and JSON add overhead.
const maxBodyBytes = 320 * 1024;
const maxAvatarBytes = 180 * 1024;
const maxSignalPayloadBytes = 12 * 1024;
const ringingCallLifetimeMs = 45_000;
const activeCallLifetimeMs = 6 * 60 * 60 * 1000;
const terminalCallLifetimeMs = 60_000;
const usernamePattern = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,19}$/;
const avatarPattern = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/;

// Calls deliberately live outside state: they must not be written to social.json.
const calls = new Map();

function emptyState() {
  return {
    version: 1,
    users: {},
    sessions: {},
    requests: [],
    friendships: [],
    messages: [],
  };
}

function loadState() {
  if (!existsSync(dataPath)) return emptyState();
  try {
    const loaded = JSON.parse(readFileSync(dataPath, "utf8"));
    return {
      ...emptyState(),
      ...loaded,
      users: loaded?.users && typeof loaded.users === "object" ? loaded.users : {},
      sessions: loaded?.sessions && typeof loaded.sessions === "object" ? loaded.sessions : {},
      requests: Array.isArray(loaded?.requests) ? loaded.requests : [],
      friendships: Array.isArray(loaded?.friendships) ? loaded.friendships : [],
      messages: Array.isArray(loaded?.messages) ? loaded.messages : [],
    };
  } catch {
    return emptyState();
  }
}

let state = loadState();

function persistState() {
  mkdirSync(dirname(dataPath), { recursive: true });
  const temporaryPath = `${dataPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(state), { mode: 0o600 });
  renameSync(temporaryPath, dataPath);
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function parseCookies(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map(part => part.trim().split("="))
    .filter(parts => parts.length >= 2)
    .reduce((cookies, [name, ...value]) => {
      cookies[name] = value.join("=");
      return cookies;
    }, {});
}

function signSessionId(sessionId) {
  return createHmac("sha256", sessionSecret)
    .update(sessionId)
    .digest("base64url");
}

function validSessionCookie(value) {
  const [sessionId, signature] = String(value || "").split(".");
  if (!sessionId || !signature) return null;
  const expected = signSessionId(sessionId);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(actualBuffer, expectedBuffer)
    || !state.sessions[sessionId]
  ) return null;
  return sessionId;
}

function getSession(request, response) {
  const cookies = parseCookies(request);
  const existingSessionId = validSessionCookie(cookies[sessionCookieName]);
  if (existingSessionId) {
    if (!state.sessions[existingSessionId].csrfToken) {
      state.sessions[existingSessionId].csrfToken = randomBytes(24).toString("base64url");
      persistState();
    }
    return existingSessionId;
  }

  const sessionId = randomUUID();
  state.sessions[sessionId] = {
    usernameKey: null,
    csrfToken: randomBytes(24).toString("base64url"),
    createdAt: Date.now(),
  };
  const isSecure = request.headers["x-forwarded-proto"] === "https"
    || Boolean(request.socket?.encrypted);
  const secureFlag = isSecure ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${sessionId}.${signSessionId(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAge}${secureFlag}`,
  );
  return sessionId;
}

function currentUser(sessionId) {
  const session = state.sessions[sessionId];
  const user = session?.usernameKey ? state.users[session.usernameKey] : null;
  return user ? { key: session.usernameKey, value: user } : null;
}

function setJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function requireUser(sessionId, response) {
  const user = currentUser(sessionId);
  if (!user) {
    setJson(response, 401, { error: "Choose a username first." });
    return null;
  }
  return user;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", chunk => {
      size += chunk.length;
      if (size > maxBodyBytes) {
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

function online(user) {
  return Boolean(user?.lastSeen && Date.now() - user.lastSeen <= onlineWindowMs);
}

function publicUser(key) {
  const user = state.users[key];
  if (!user) return null;
  const isOnline = online(user);
  const game = isOnline && user.activity?.type === "game"
    ? user.activity.name
    : null;
  return {
    username: user.username,
    avatar: validAvatar(user.avatar) || null,
    online: isOnline,
    activity: game ? { type: "game", name: game } : null,
  };
}

function validAvatar(value) {
  if (typeof value !== "string") return null;
  const match = avatarPattern.exec(value);
  if (!match || match[2].length % 4 !== 0 || (match[2].includes("=") && !/=+$/.test(match[2]))) {
    return null;
  }
  let bytes;
  try {
    bytes = Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
  if (!bytes.length || bytes.length > maxAvatarBytes) return null;
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if ((match[1] === "jpeg" && !isJpeg)
    || (match[1] === "png" && !isPng)
    || (match[1] === "webp" && !isWebp)) return null;
  // Buffer accepts some non-canonical base64 forms, so require an exact round trip.
  return bytes.toString("base64") === match[2] ? value : null;
}

function orderedPair(first, second) {
  return [first, second].sort();
}

function samePair(pair, first, second) {
  const [a, b] = orderedPair(first, second);
  const pairA = pair?.a ?? pair?.from;
  const pairB = pair?.b ?? pair?.to;
  return orderedPair(pairA, pairB)[0] === a
    && orderedPair(pairA, pairB)[1] === b;
}

function areFriends(first, second) {
  return state.friendships.some(pair => samePair(pair, first, second));
}

function removeRequest(from, to) {
  state.requests = state.requests.filter(request => !(request.from === from && request.to === to));
}

function relationship(currentKey, targetKey) {
  if (areFriends(currentKey, targetKey)) return "friends";
  if (state.requests.some(request => request.from === currentKey && request.to === targetKey)) {
    return "outgoing";
  }
  if (state.requests.some(request => request.from === targetKey && request.to === currentKey)) {
    return "incoming";
  }
  return "none";
}

function userWithRelationship(currentKey, targetKey) {
  const storedUser = state.users[targetKey];
  if (!storedUser) return null;
  const currentRelationship = relationship(currentKey, targetKey);
  const user = currentRelationship === "friends"
    ? publicUser(targetKey)
    : {
      username: storedUser.username,
      avatar: validAvatar(storedUser.avatar) || null,
      online: false,
      activity: null,
    };
  return {
    ...user,
    relationship: currentRelationship,
  };
}

function friendList(currentKey) {
  const keys = state.friendships.flatMap(pair => {
    if (pair.a === currentKey) return [pair.b];
    if (pair.b === currentKey) return [pair.a];
    return [];
  });
  return keys.map(publicUser).filter(Boolean).sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
}

function incomingRequests(currentKey) {
  return state.requests
    .filter(request => request.to === currentKey)
    .map(request => ({
      username: state.users[request.from]?.username,
      avatar: validAvatar(state.users[request.from]?.avatar) || null,
      online: false,
      activity: null,
      createdAt: request.createdAt,
    }))
    .filter(request => request.username)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function outgoingRequests(currentKey) {
  return state.requests
    .filter(request => request.from === currentKey)
    .map(request => ({
      username: state.users[request.to]?.username,
      avatar: validAvatar(state.users[request.to]?.avatar) || null,
      online: false,
      activity: null,
    }))
    .filter(Boolean);
}

function notificationSummary(currentKey) {
  return {
    messages: state.messages
      .filter(message => message.to === currentKey)
      .slice(-100)
      .map(message => ({
        id: message.id,
        from: state.users[message.from]?.username || message.from,
        body: message.body,
        createdAt: message.createdAt,
      })),
    requests: state.requests
      .filter(request => request.to === currentKey)
      .map(request => ({
        id: `${request.from}:${request.createdAt}`,
        username: state.users[request.from]?.username || request.from,
        createdAt: request.createdAt,
      })),
  };
}

function touchPresence(user, activity) {
  user.value.lastSeen = Date.now();
  if (activity !== undefined) {
    user.value.activity = activity
      ? { type: "game", name: activity }
      : null;
  }
  persistState();
}

function callIsLive(call) {
  return ["ringing", "accepted", "connecting", "active"].includes(call.status);
}

function expireCalls() {
  const now = Date.now();
  for (const [id, call] of calls) {
    if (call.status === "ringing" && now - call.createdAt >= ringingCallLifetimeMs) {
      call.status = "timeout";
      call.updatedAt = now;
    } else if (["accepted", "connecting", "active"].includes(call.status)
      && now - call.updatedAt >= activeCallLifetimeMs) {
      call.status = "timeout";
      call.updatedAt = now;
    }
    if (!callIsLive(call) && now - call.updatedAt >= terminalCallLifetimeMs) calls.delete(id);
  }
}

function callForUser(call, userKey) {
  return call && (call.caller === userKey || call.callee === userKey);
}

function callResponse(call) {
  return {
    id: call.id,
    caller: state.users[call.caller]?.username || call.caller,
    callee: state.users[call.callee]?.username || call.callee,
    mode: call.mode,
    status: call.status,
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
  };
}

function appendCallEvent(call, to, from, type, payload) {
  call.lastSequence += 1;
  call.events.push({
    seq: call.lastSequence,
    to,
    from,
    type,
    payload,
    createdAt: Date.now(),
  });
  if (call.events.length > 200) call.events.splice(0, call.events.length - 200);
}

function hasLiveCall(userKey) {
  return [...calls.values()].some(call => callIsLive(call) && callForUser(call, userKey));
}

async function handleGet(request, response, url, sessionId) {
  if (url.pathname === "/api/friends/me") {
    const user = currentUser(sessionId);
    if (!user) {
      setJson(response, 200, {
        user: null,
        friends: [],
        incomingRequests: [],
        outgoingRequests: [],
        notifications: { messages: [], requests: [] },
        csrfToken: state.sessions[sessionId].csrfToken,
      });
      return true;
    }
    touchPresence(user);
    setJson(response, 200, {
      user: publicUser(user.key),
      friends: friendList(user.key),
      incomingRequests: incomingRequests(user.key),
      outgoingRequests: outgoingRequests(user.key),
      notifications: notificationSummary(user.key),
      csrfToken: state.sessions[sessionId].csrfToken,
    });
    return true;
  }

  if (url.pathname === "/api/friends/search") {
    const user = requireUser(sessionId, response);
    if (!user) return true;
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 40);
    const results = Object.keys(state.users)
      .filter(key => key !== user.key && (!query || state.users[key].username.toLowerCase().includes(query)))
      .sort((a, b) => state.users[a].username.localeCompare(state.users[b].username))
      .slice(0, 30)
      .map(key => userWithRelationship(user.key, key))
      .filter(Boolean);
    setJson(response, 200, { results });
    return true;
  }

  if (url.pathname === "/api/friends/messages") {
    const user = requireUser(sessionId, response);
    if (!user) return true;
    const targetKey = normalizeUsername(url.searchParams.get("with"));
    if (!state.users[targetKey] || !areFriends(user.key, targetKey)) {
      setJson(response, 403, { error: "You can only message accepted friends." });
      return true;
    }
    const messages = state.messages
      .filter(message => samePair(message, user.key, targetKey))
      .slice(-100)
      .map(message => ({
        id: message.id,
        from: state.users[message.from]?.username || message.from,
        body: message.body,
        createdAt: message.createdAt,
        mine: message.from === user.key,
      }));
    setJson(response, 200, { friend: publicUser(targetKey), messages });
    return true;
  }

  if (url.pathname === "/api/friends/call") {
    const user = requireUser(sessionId, response);
    if (!user) return true;
    expireCalls();
    const sinceValue = url.searchParams.get("since");
    const since = sinceValue == null ? 0 : Number(sinceValue);
    if (!Number.isSafeInteger(since) || since < 0) {
      setJson(response, 400, { error: "The call event cursor is invalid." });
      return true;
    }
    const call = [...calls.values()]
      .filter(candidate => callForUser(candidate, user.key))
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!call) {
      setJson(response, 200, { call: null, events: [] });
      return true;
    }
    setJson(response, 200, {
      call: callResponse(call),
      events: call.events
        .filter(event => event.to === user.key && event.seq > since)
        .map(({ seq, from, type, payload, createdAt }) => ({
          seq,
          from: state.users[from]?.username || from,
          type,
          payload,
          createdAt,
        })),
    });
    return true;
  }

  setJson(response, 404, { error: "Friends endpoint not found." });
  return true;
}

async function handlePost(request, response, url, sessionId) {
  let body;
  try {
    body = await readBody(request);
  } catch (error) {
    setJson(response, 400, { error: error.message });
    return true;
  }

  if (url.pathname === "/api/friends/profile") {
    const session = state.sessions[sessionId];
    const username = String(body?.username || "").trim();
    const usernameKey = normalizeUsername(username);
    if (!usernamePattern.test(username)) {
      setJson(response, 400, {
        error: "Usernames must be 3–20 characters using letters, numbers, hyphens, or underscores.",
      });
      return true;
    }
    if (session.usernameKey && session.usernameKey !== usernameKey) {
      setJson(response, 409, { error: "This browser already has a username." });
      return true;
    }
    if (state.users[usernameKey] && session.usernameKey !== usernameKey) {
      setJson(response, 409, { error: "That username is already taken." });
      return true;
    }
    if (!state.users[usernameKey]) {
      state.users[usernameKey] = {
        username,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        activity: null,
      };
    }
    session.usernameKey = usernameKey;
    touchPresence({ key: usernameKey, value: state.users[usernameKey] });
    setJson(response, 200, { user: publicUser(usernameKey) });
    return true;
  }

  const user = requireUser(sessionId, response);
  if (!user) return true;

  if (url.pathname === "/api/friends/avatar") {
    if (body?.avatar === null || body?.avatar === "") {
      user.value.avatar = null;
    } else {
      const avatar = validAvatar(body?.avatar);
      if (!avatar) {
        setJson(response, 400, {
          error: "Avatar must be a valid JPEG, PNG, or WebP data URL no larger than 180 KiB.",
        });
        return true;
      }
      user.value.avatar = avatar;
    }
    user.value.avatarUpdatedAt = Date.now();
    persistState();
    setJson(response, 200, { user: publicUser(user.key) });
    return true;
  }

  if (url.pathname === "/api/friends/presence") {
    const activity = body?.activity == null ? null : String(body.activity).trim();
    if (activity && (activity.length > 80 || /[\u0000-\u001f]/.test(activity))) {
      setJson(response, 400, { error: "That activity is invalid." });
      return true;
    }
    touchPresence(user, activity || null);
    setJson(response, 200, { user: publicUser(user.key) });
    return true;
  }

  if (url.pathname === "/api/friends/call") {
    expireCalls();
    const action = String(body?.action || "").toLowerCase();
    if (action === "start") {
      const callee = normalizeUsername(body?.with);
      const mode = String(body?.mode || "").toLowerCase();
      if (!state.users[callee] || callee === user.key) {
        setJson(response, 404, { error: "Friend not found." });
        return true;
      }
      if (!areFriends(user.key, callee)) {
        setJson(response, 403, { error: "You can only call accepted friends." });
        return true;
      }
      if (!["audio", "video"].includes(mode)) {
        setJson(response, 400, { error: "Call mode must be audio or video." });
        return true;
      }
      if (hasLiveCall(user.key) || hasLiveCall(callee)) {
        setJson(response, 409, { error: "One of the participants is already in a call." });
        return true;
      }
      const now = Date.now();
      const call = {
        id: randomUUID(),
        caller: user.key,
        callee,
        mode,
        status: "ringing",
        offerer: null,
        awaitingAnswer: false,
        createdAt: now,
        updatedAt: now,
        lastSequence: 0,
        events: [],
      };
      appendCallEvent(call, callee, user.key, "ringing", { mode });
      calls.set(call.id, call);
      setJson(response, 201, { call: callResponse(call) });
      return true;
    }

    const callId = String(body?.callId || "");
    const call = calls.get(callId);
    if (!call) {
      setJson(response, 404, { error: "Call not found or no longer available." });
      return true;
    }
    if (!callForUser(call, user.key)) {
      setJson(response, 403, { error: "You are not a participant in this call." });
      return true;
    }

    if (action === "accept") {
      if (call.callee !== user.key) {
        setJson(response, 403, { error: "Only the called friend can accept a call." });
        return true;
      }
      if (call.status !== "ringing") {
        setJson(response, 409, { error: "This call can no longer be accepted." });
        return true;
      }
      call.status = "accepted";
      call.updatedAt = Date.now();
      appendCallEvent(call, call.caller, user.key, "accept", null);
      setJson(response, 200, { call: callResponse(call) });
      return true;
    }

    if (action === "decline") {
      if (call.callee !== user.key) {
        setJson(response, 403, { error: "Only the called friend can decline a call." });
        return true;
      }
      if (call.status !== "ringing") {
        setJson(response, 409, { error: "This call can no longer be declined." });
        return true;
      }
      call.status = "declined";
      call.updatedAt = Date.now();
      appendCallEvent(call, call.caller, user.key, "decline", null);
      setJson(response, 200, { call: callResponse(call) });
      return true;
    }

    if (action === "end") {
      if (!callIsLive(call)) {
        setJson(response, 409, { error: "This call has already ended." });
        return true;
      }
      call.status = "ended";
      call.updatedAt = Date.now();
      appendCallEvent(call, call.caller === user.key ? call.callee : call.caller, user.key, "end", null);
      setJson(response, 200, { call: callResponse(call) });
      return true;
    }

    if (action === "signal") {
      if (!areFriends(call.caller, call.callee)) {
        setJson(response, 403, { error: "Call signaling requires an accepted friendship." });
        return true;
      }
      const type = String(body?.type || "").toLowerCase();
      if (!["offer", "answer", "ice", "media"].includes(type)) {
        setJson(response, 400, { error: "Signal type must be offer, answer, ice, or media." });
        return true;
      }
      let payloadBytes;
      try {
        const serializedPayload = JSON.stringify(body?.payload);
        payloadBytes = serializedPayload === undefined ? -1 : Buffer.byteLength(serializedPayload);
      } catch {
        payloadBytes = -1;
      }
      if (payloadBytes < 0 || payloadBytes > maxSignalPayloadBytes) {
        setJson(response, 400, { error: "Signal payload must be valid JSON and no larger than 12 KiB." });
        return true;
      }
      if (!["accepted", "connecting", "active"].includes(call.status)) {
        setJson(response, 409, { error: "This call is not ready for signaling." });
        return true;
      }
      const payload = body.payload;
      if (type === "offer") {
        if (
          !payload
          || payload.type !== "offer"
          || typeof payload.sdp !== "string"
          || !payload.sdp
          || call.awaitingAnswer
          || (call.status === "accepted" && user.key !== call.caller)
        ) {
          setJson(response, 409, { error: "This offer is out of order or invalid." });
          return true;
        }
        call.offerer = user.key;
        call.awaitingAnswer = true;
        call.status = "connecting";
      } else if (type === "answer") {
        if (
          !payload
          || payload.type !== "answer"
          || typeof payload.sdp !== "string"
          || !payload.sdp
          || call.status !== "connecting"
          || !call.awaitingAnswer
          || user.key === call.offerer
        ) {
          setJson(response, 409, { error: "This answer is out of order or invalid." });
          return true;
        }
        call.awaitingAnswer = false;
        call.status = "active";
      } else if (type === "ice") {
        if (
          !payload
          || typeof payload.candidate !== "string"
          || (!call.awaitingAnswer && call.status !== "active")
        ) {
          setJson(response, 409, { error: "This ICE candidate is out of order or invalid." });
          return true;
        }
      } else if (type === "media") {
        if (!payload || typeof payload.video !== "boolean") {
          setJson(response, 400, { error: "Media updates require a video boolean." });
          return true;
        }
      }
      call.updatedAt = Date.now();
      appendCallEvent(call, call.caller === user.key ? call.callee : call.caller, user.key, type, payload);
      setJson(response, 200, { call: callResponse(call) });
      return true;
    }

    setJson(response, 400, { error: "Call action must be start, accept, decline, end, or signal." });
    return true;
  }

  if (url.pathname === "/api/friends/requests") {
    const targetKey = normalizeUsername(body?.username);
    const target = state.users[targetKey];
    if (!target || targetKey === user.key) {
      setJson(response, 404, { error: "User not found." });
      return true;
    }
    if (areFriends(user.key, targetKey)) {
      setJson(response, 409, { error: "You are already friends." });
      return true;
    }
    if (state.requests.some(request => request.from === user.key && request.to === targetKey)) {
      setJson(response, 409, { error: "Friend request already sent." });
      return true;
    }
    if (state.requests.some(request => request.from === targetKey && request.to === user.key)) {
      setJson(response, 409, { error: "This user already sent you a request." });
      return true;
    }
    state.requests.push({ from: user.key, to: targetKey, createdAt: Date.now() });
    persistState();
    setJson(response, 201, { user: userWithRelationship(user.key, targetKey) });
    return true;
  }

  if (url.pathname === "/api/friends/requests/respond") {
    const targetKey = normalizeUsername(body?.username);
    const action = String(body?.action || "").toLowerCase();
    const requestIndex = state.requests.findIndex(
      request => request.from === targetKey && request.to === user.key,
    );
    if (requestIndex === -1) {
      setJson(response, 404, { error: "Friend request not found." });
      return true;
    }
    if (!["accept", "decline"].includes(action)) {
      setJson(response, 400, { error: "Choose accept or decline." });
      return true;
    }
    state.requests.splice(requestIndex, 1);
    if (action === "accept") {
      const [a, b] = orderedPair(user.key, targetKey);
      if (!areFriends(a, b)) state.friendships.push({ a, b, createdAt: Date.now() });
    }
    persistState();
    setJson(response, 200, { friends: friendList(user.key), incomingRequests: incomingRequests(user.key) });
    return true;
  }

  if (url.pathname === "/api/friends/messages") {
    const targetKey = normalizeUsername(body?.with);
    const messageBody = String(body?.body || "").trim();
    if (!state.users[targetKey] || !areFriends(user.key, targetKey)) {
      setJson(response, 403, { error: "You can only message accepted friends." });
      return true;
    }
    if (!messageBody || messageBody.length > 1000 || /[\u0000]/.test(messageBody)) {
      setJson(response, 400, { error: "Messages must be 1–1,000 characters." });
      return true;
    }
    const message = {
      id: randomUUID(),
      from: user.key,
      to: targetKey,
      body: messageBody,
      createdAt: Date.now(),
    };
    state.messages.push(message);
    if (state.messages.length > 10_000) state.messages = state.messages.slice(-10_000);
    persistState();
    setJson(response, 201, {
      message: {
        ...message,
        from: user.value.username,
        mine: true,
      },
    });
    return true;
  }

  setJson(response, 404, { error: "Friends endpoint not found." });
  return true;
}

export async function handleFriendsRequest(request, response, url) {
  if (!url.pathname.startsWith("/api/friends")) return false;
  const referrer = request.headers.referer;
  let referrerPath = "";
  try {
    referrerPath = referrer ? new URL(referrer).pathname : "";
  } catch {
    referrerPath = "";
  }
  const proxyInitiated = referrerPath.startsWith("/service/")
    || referrerPath.startsWith("/bare/");
  if (proxyInitiated || request.headers["x-void-friends-client"] !== "1") {
    setJson(response, 403, { error: "Friends requests are only available to the Void V2 interface." });
    return true;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return true;
  }

  const sessionId = getSession(request, response);
  if (request.method === "GET") return handleGet(request, response, url, sessionId);
  if (request.method === "POST") {
    const suppliedToken = String(request.headers["x-void-friends-token"] || "");
    const expectedToken = String(state.sessions[sessionId]?.csrfToken || "");
    const suppliedBuffer = Buffer.from(suppliedToken);
    const expectedBuffer = Buffer.from(expectedToken);
    if (
      !suppliedToken
      || suppliedBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      setJson(response, 403, { error: "Friends session check failed. Refresh and try again." });
      return true;
    }
    return handlePost(request, response, url, sessionId);
  }
  setJson(response, 405, { error: "Method not allowed." }, { Allow: "GET, POST, OPTIONS" });
  return true;
}