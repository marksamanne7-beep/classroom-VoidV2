const DEFAULT_BACKGROUND_IMAGE = '/assets/default-background.png';
const DEFAULT_BACKGROUND_VIDEO = '/assets/default-background.mp4';
const BACKGROUND_VIDEO_DISABLED = 'backgroundVideoDisabled';

// ── Interactive background engine ───────────────────────────
(function() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  const styles = new Set(['stars', 'nebula', 'aurora', 'particles', 'grid', 'wormhole', 'storm', 'matrix', 'void']);
  const state = {
    style: styles.has(localStorage.getItem('backgroundStyle'))
      ? localStorage.getItem('backgroundStyle') : 'stars',
    motion: localStorage.getItem('backgroundMotion') !== 'off',
    intensity: Math.max(0.4, Math.min(1.6, Number(localStorage.getItem('backgroundIntensity')) || 0.4)),
    pointer: { x: 0.5, y: 0.5 },
    target: { x: 0.5, y: 0.5 }
  };
  let stars = [];
  let particles = [];
  let backgroundImage = null;
  let backgroundVideoUrl = null;
  let backgroundVideoIsActive = false;
  let backgroundPaused = false;
  let animationFrameId = null;

  function loadBackgroundImage(source) {
    if (!source) {
      backgroundImage = null;
      return;
    }
    const image = new Image();
    image.onload = () => { backgroundImage = image; };
    image.onerror = () => { backgroundImage = null; };
    image.src = source;
  }

  function loadBackgroundVideo(source) {
    const video = document.getElementById('background-video');
    if (!video || !source) return;
    if (backgroundVideoUrl && backgroundVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundVideoUrl);
    }
    backgroundVideoUrl = typeof source === 'string' ? source : URL.createObjectURL(source);
    video.src = backgroundVideoUrl;
    video.classList.add('active');
    backgroundVideoIsActive = true;
    video.load();
    if (!backgroundPaused) video.play().catch(() => {});
  }

  function clearBackgroundVideo() {
    const video = document.getElementById('background-video');
    if (backgroundVideoUrl && backgroundVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundVideoUrl);
    }
    backgroundVideoUrl = null;
    backgroundVideoIsActive = false;
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.classList.remove('active');
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function initParticles() {
    particles = Array.from({ length: 105 }, () => ({
      x: Math.random(), y: Math.random(), radius: Math.random() * 2.2 + 0.5,
      speed: Math.random() * 0.08 + 0.018, phase: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.5 ? 252 : 190
    }));
  }

  function initStars() {
    stars = Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random(), radius: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.00025 + 0.00005,
      opacity: Math.random() * 0.7 + 0.2,
      twinkleSpeed: Math.random() * 0.015 + 0.005,
      twinkleDir: Math.random() > 0.5 ? 1 : -1
    }));
  }

  function hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return match ? match.slice(1).map(value => parseInt(value, 16)) : [0, 0, 0];
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  function fillBase(style, width, height, color) {
    const base = hexToRgb(color);
    const backgrounds = {
      stars: color,
      nebula: '#04030d',
      aurora: '#030817',
      particles: '#020611',
      grid: '#050611',
      wormhole: '#01020b',
      storm: '#06020d',
      matrix: '#010907',
      void: '#010107'
    };
    ctx.fillStyle = backgrounds[style] || color;
    ctx.fillRect(0, 0, width, height);
    return base;
  }

  function drawBackgroundImage(width, height) {
    if (!backgroundImage || !backgroundImage.naturalWidth || !backgroundImage.naturalHeight) return;
    const imageRatio = backgroundImage.naturalWidth / backgroundImage.naturalHeight;
    const canvasRatio = width / height;
    let sourceWidth = backgroundImage.naturalWidth;
    let sourceHeight = backgroundImage.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;
    if (imageRatio > canvasRatio) {
      sourceWidth = backgroundImage.naturalHeight * canvasRatio;
      sourceX = (backgroundImage.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = backgroundImage.naturalWidth / canvasRatio;
      sourceY = (backgroundImage.naturalHeight - sourceHeight) / 2;
    }
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.drawImage(backgroundImage, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    ctx.fillStyle = 'rgba(0,0,8,0.27)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawNebula(width, height, pointer) {
    const clouds = [
      [0.22 + pointer.x * 0.05, 0.28 + pointer.y * 0.04, 0.46, '124,111,255', 0.27],
      [0.76 - pointer.x * 0.04, 0.36 - pointer.y * 0.05, 0.38, '32,190,255', 0.15],
      [0.54 + pointer.x * 0.03, 0.82 + pointer.y * 0.03, 0.52, '218,74,190', 0.13]
    ];
    for (const [x, y, radius, color, alpha] of clouds) {
      const gradient = ctx.createRadialGradient(width * x, height * y, 0, width * x, height * y, width * radius);
      gradient.addColorStop(0, `rgba(${color},${alpha})`);
      gradient.addColorStop(0.45, `rgba(${color},${alpha * 0.32})`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawAurora(width, height, time, pointer) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let band = 0; band < 4; band++) {
      const gradient = ctx.createLinearGradient(0, height * (0.16 + band * 0.18), width, height * (0.5 + band * 0.12));
      gradient.addColorStop(0, `rgba(${band % 2 ? '62,220,190' : '112,91,255'},0)`);
      gradient.addColorStop(0.45, `rgba(${band % 2 ? '62,220,190' : '112,91,255'},${0.11 * state.intensity})`);
      gradient.addColorStop(1, 'rgba(20,130,255,0)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 28 + band * 10;
      ctx.beginPath();
      for (let x = -30; x <= width + 30; x += 18) {
        const wave = height * (0.2 + band * 0.17)
          + Math.sin(x * 0.006 + time * (0.7 + band * 0.12) + pointer.x * 2) * (34 + band * 8)
          + Math.sin(x * 0.002 - time * 0.35 + pointer.y * 3) * 24;
        if (x === -30) ctx.moveTo(x, wave); else ctx.lineTo(x, wave);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrid(width, height, time, pointer) {
    ctx.save();
    ctx.strokeStyle = `rgba(112,100,255,${0.24 * state.intensity})`;
    ctx.lineWidth = 1;
    const horizon = height * (0.52 + (pointer.y - 0.5) * 0.04);
    for (let i = -18; i <= 18; i++) {
      const bottomX = width / 2 + i * width * 0.075 + (pointer.x - 0.5) * 30;
      ctx.beginPath(); ctx.moveTo(width / 2, horizon); ctx.lineTo(bottomX, height + 30); ctx.stroke();
    }
    for (let row = 0; row < 12; row++) {
      const progress = row / 12;
      const y = horizon + Math.pow(progress, 1.8) * (height - horizon + 30);
      const wave = Math.sin(time + row) * 2;
      ctx.beginPath(); ctx.moveTo(0, y + wave); ctx.lineTo(width, y + wave); ctx.stroke();
    }
    ctx.restore();
  }

  function drawWormhole(width, height, time, pointer) {
    ctx.save();
    ctx.translate(width * (0.5 + (pointer.x - 0.5) * 0.12), height * (0.5 + (pointer.y - 0.5) * 0.1));
    ctx.globalCompositeOperation = 'screen';
    for (let ring = 0; ring < 34; ring++) {
      const depth = ring / 34;
      const radius = (1 - depth) * Math.min(width, height) * 0.58 + 14;
      const wobble = Math.sin(time * 1.5 + ring * 0.8) * (8 + depth * 22);
      ctx.save();
      ctx.rotate(time * 0.15 + ring * 0.18 + Math.sin(time + ring) * 0.08);
      ctx.scale(1 + Math.sin(time * 0.8 + ring) * 0.08, 0.42 + depth * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, radius + wobble), 0, Math.PI * 2);
      ctx.strokeStyle = ring % 3 === 0
        ? `rgba(210,105,255,${(0.08 + (1 - depth) * 0.28) * state.intensity})`
        : `rgba(53,182,255,${(0.04 + (1 - depth) * 0.16) * state.intensity})`;
      ctx.lineWidth = 1 + (1 - depth) * 2.5;
      ctx.stroke();
      ctx.restore();
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(width, height) * 0.23);
    core.addColorStop(0, `rgba(0,0,0,${0.98 * state.intensity})`);
    core.addColorStop(0.45, `rgba(7,4,28,${0.75 * state.intensity})`);
    core.addColorStop(1, 'rgba(5,3,18,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, Math.min(width, height) * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawStorm(width, height, time, pointer) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let bolt = 0; bolt < 12; bolt++) {
      const startX = width * (bolt / 11) + Math.sin(time * 1.7 + bolt) * 100;
      ctx.beginPath();
      ctx.moveTo(startX, -20);
      for (let step = 0; step < 8; step++) {
        const x = startX + Math.sin(time * 2 + bolt * 3 + step * 2.1) * (28 + pointer.x * 28) + step * (pointer.x - 0.5) * 12;
        const y = step * height / 7;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = bolt % 3 === 0
        ? `rgba(223,113,255,${0.22 * state.intensity})`
        : `rgba(50,197,255,${0.11 * state.intensity})`;
      ctx.lineWidth = bolt % 3 === 0 ? 1.5 : 0.7;
      ctx.shadowBlur = bolt % 3 === 0 ? 14 : 6;
      ctx.shadowColor = bolt % 3 === 0 ? '#c76cff' : '#31c7ff';
      ctx.stroke();
    }
    const pulse = 0.5 + Math.sin(time * 2.1) * 0.5;
    const glow = ctx.createRadialGradient(width * (0.5 + (pointer.x - 0.5) * 0.18), height * (0.48 + (pointer.y - 0.5) * 0.15), 0, width * 0.5, height * 0.5, width * 0.72);
    glow.addColorStop(0, `rgba(142,65,255,${(0.16 + pulse * 0.1) * state.intensity})`);
    glow.addColorStop(0.35, `rgba(20,161,255,${0.08 * state.intensity})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawMatrix(width, height, time, pointer) {
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    const columns = Math.ceil(width / 22);
    for (let column = 0; column < columns; column++) {
      const speed = 0.04 + (column % 5) * 0.012;
      const head = ((time * speed + column * 0.37) % 1.35) - 0.2;
      const x = column * 22 + (pointer.x - 0.5) * 18;
      for (let row = 0; row < 15; row++) {
        const y = (head + row * 0.075) * height + (pointer.y - 0.5) * 10;
        const distance = row / 15;
        const alpha = Math.max(0, (1 - distance) * 0.24 * state.intensity);
        if (y < -20 || y > height + 20) continue;
        ctx.fillStyle = row === 0
          ? `rgba(170,255,235,${0.8 * state.intensity})`
          : `rgba(61,215,174,${alpha})`;
        ctx.fillText(String.fromCharCode(0x30a0 + ((column * 13 + row * 7 + Math.floor(time * 5)) % 96)), x, y);
      }
    }
    ctx.restore();
  }

  function drawStars(width, height, pointer, time) {
    for (const star of stars) {
      star.opacity += star.twinkleSpeed * star.twinkleDir;
      if (star.opacity >= 1) { star.opacity = 1; star.twinkleDir = -1; }
      if (star.opacity <= 0.1) { star.opacity = 0.1; star.twinkleDir = 1; }
      star.y -= star.speed * (state.motion ? 1 : 0.45);
      if (star.y < -0.01) { star.y = 1.01; star.x = Math.random(); }
      const x = star.x * width + (pointer.x - 0.5) * (state.motion ? 12 : 0);
      const y = star.y * height + (pointer.y - 0.5) * (state.motion ? 8 : 0);
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${star.opacity * 0.72 * state.intensity})`;
      ctx.fill();
    }
  }

  function drawParticles(width, height, time, pointer) {
    for (const particle of particles) {
      const drift = state.motion ? time * particle.speed : 0;
      const x = ((particle.x + Math.sin(drift + particle.phase) * 0.035 + (pointer.x - 0.5) * 0.045) % 1 + 1) % 1;
      const y = ((particle.y - drift * 0.35 + Math.cos(drift + particle.phase) * 0.025 + (pointer.y - 0.5) * 0.035) % 1 + 1) % 1;
      const alpha = (0.25 + Math.sin(time * 1.5 + particle.phase) * 0.16) * state.intensity;
      ctx.beginPath();
      ctx.arc(x * width, y * height, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${particle.hue},90%,72%,${Math.max(0.06, alpha)})`;
      ctx.fill();
    }
  }

  function draw() {
    if (backgroundPaused) {
      animationFrameId = null;
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const time = performance.now() * 0.001;
    if (state.motion) {
      state.pointer.x += (state.target.x - state.pointer.x) * 0.035;
      state.pointer.y += (state.target.y - state.pointer.y) * 0.035;
    } else {
      state.pointer.x = 0.5; state.pointer.y = 0.5;
    }
    const customColor = localStorage.getItem('backgroundColor') || '#000000';
    const base = hexToRgb(customColor);
    if (backgroundVideoIsActive) {
      ctx.clearRect(0, 0, width, height);
    } else {
      fillBase(state.style, width, height, customColor);
      drawBackgroundImage(width, height);
    }
    const pointer = state.pointer;

    if (state.style === 'nebula') drawNebula(width, height, pointer);
    if (state.style === 'aurora') drawAurora(width, height, time, pointer);
    if (state.style === 'grid') drawGrid(width, height, time, pointer);
    if (state.style === 'particles') drawParticles(width, height, time, pointer);
    if (state.style === 'wormhole') drawWormhole(width, height, time, pointer);
    if (state.style === 'storm') drawStorm(width, height, time, pointer);
    if (state.style === 'matrix') drawMatrix(width, height, time, pointer);
    if (state.style === 'void') {
      const glow = ctx.createRadialGradient(width * (0.5 + pointer.x * 0.08), height * (0.48 + pointer.y * 0.06), 0, width * 0.5, height * 0.5, width * 0.7);
      glow.addColorStop(0, `rgba(54,42,130,${0.2 * state.intensity})`);
      glow.addColorStop(1, 'rgba(1,1,7,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    }
    drawStars(width, height, pointer, time);
    if (state.style === 'nebula' || state.style === 'particles' || state.style === 'storm') {
      ctx.fillStyle = rgba(base, 0.04);
      ctx.fillRect(0, 0, width, height);
    }
    animationFrameId = requestAnimationFrame(draw);
  }

  window.addEventListener('pointermove', event => {
    state.target.x = event.clientX / Math.max(window.innerWidth, 1);
    state.target.y = event.clientY / Math.max(window.innerHeight, 1);
  }, { passive: true });
  window.addEventListener('resize', () => { resize(); initStars(); initParticles(); });

  window.VoidBackground = {
    setImage(source) {
      loadBackgroundImage(source);
    },
    clearImage() {
      loadBackgroundImage(DEFAULT_BACKGROUND_IMAGE);
    },
    setVideo(source) {
      loadBackgroundVideo(source);
    },
    clearVideo() {
      clearBackgroundVideo();
    },
    setStyle(style) {
      if (styles.has(style)) {
        state.style = style;
        localStorage.setItem('backgroundStyle', style);
      }
    },
    setMotion(enabled) {
      state.motion = enabled;
      localStorage.setItem('backgroundMotion', enabled ? 'on' : 'off');
    },
    setIntensity(value) {
      state.intensity = Math.max(0.4, Math.min(1.6, Number(value) || 1));
      localStorage.setItem('backgroundIntensity', state.intensity);
    },
    pause() {
      if (backgroundPaused) return;
      backgroundPaused = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      const video = document.getElementById('background-video');
      if (video) video.pause();
    },
    resume() {
      if (!backgroundPaused) return;
      backgroundPaused = false;
      const video = document.getElementById('background-video');
      if (backgroundVideoIsActive && video) video.play().catch(() => {});
      if (animationFrameId === null) animationFrameId = requestAnimationFrame(draw);
    }
  };

  resize();
  initStars();
  initParticles();
  loadBackgroundImage(localStorage.getItem('backgroundImage') || DEFAULT_BACKGROUND_IMAGE);
  if (localStorage.getItem(BACKGROUND_VIDEO_DISABLED) !== 'true') {
    loadBackgroundVideo(DEFAULT_BACKGROUND_VIDEO);
  }
  draw();
})();

// ── Clock ──────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const el = document.getElementById('clock-display');
  if (el) el.textContent = `${h}:${m} ${ampm}`;
}
updateClock();
setInterval(updateClock, 1000);

// ── Weather ────────────────────────────────────────────────
const WMO_CODES = {
  0:'☀️ Clear', 1:'🌤 Mostly Clear', 2:'⛅ Partly Cloudy', 3:'☁️ Overcast',
  45:'🌫 Foggy', 48:'🌫 Icy Fog', 51:'🌦 Light Drizzle', 53:'🌦 Drizzle', 55:'🌧 Heavy Drizzle',
  61:'🌧 Light Rain', 63:'🌧 Rain', 65:'🌧 Heavy Rain',
  71:'🌨 Light Snow', 73:'🌨 Snow', 75:'❄️ Heavy Snow',
  80:'🌦 Showers', 81:'🌧 Heavy Showers', 82:'⛈ Violent Showers',
  95:'⛈ Thunderstorm', 96:'⛈ Hail Storm', 99:'⛈ Heavy Hail'
};

function fetchWeather() {
  const el = document.getElementById('weather-display');
  if (!navigator.geolocation) { if (el) el.textContent = '📍 Location unavailable'; return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`)
      .then(r => r.json())
      .then(data => {
        const cw = data.current_weather;
        const desc = WMO_CODES[cw.weathercode] || '🌡 Unknown';
        const temp = Math.round(cw.temperature);
        if (el) el.textContent = `${desc}  ${temp}°F`;
      })
      .catch(() => { if (el) el.textContent = '🌡 Weather unavailable'; });
  }, () => { if (el) el.textContent = '📍 Allow location for weather'; });
}
fetchWeather();

// ── Password protection ────────────────────────────────────
function getPassword() {
  return localStorage.getItem('password') || null;
}

if (getPassword() != null) {
  openPage('password');
  document.getElementById('sidebar').style.display = 'none';
}

function setPassword() {
  const pw = document.getElementById('password-set').value;
  if (!pw) {
    alert('Password removed.');
    localStorage.removeItem('password');
    return;
  }
  if (confirm('Password-protect Void V2? You must know the password to get back in.')) {
    localStorage.setItem('password', pw);
    alert('Password set!');
  }
}

function checkPassword() {
  const pw = document.getElementById('password-prompt').value;
  if (pw === getPassword()) {
    openPage('search');
    document.getElementById('sidebar').style.display = 'flex';
  } else {
    window.location.href = getSearchEngineURL();
  }
}

// ── URL detection ──────────────────────────────────────────
function isUrl(val = '') {
  return /^http(s?):\/\//.test(val) || (val.includes('.') && !val.startsWith(' '));
}

// ── Browser overlay controls ───────────────────────────────
const _overlay  = () => document.getElementById('browser-overlay');
const _frame    = () => document.getElementById('browser-frame');
const _loading  = () => document.getElementById('browser-loading');
const _urlBar   = () => document.getElementById('browser-url-bar');
const _fullscreenBtn = () => document.getElementById('browser-fullscreen-btn');
const _loadingNotice = () => document.getElementById('amanda-loading-notice');
let _closeBrowserTimer = null;
let _loadingNoticeTimer = null;
let _loadingFadeTimer = null;
const AMANDA_ADVENTURER_URL = 'https://selenite.cc/resources/semag/amanda-the-adventurer/index.html';
const AMANDA_LOADING_NOTICE = "The black screen does not mean it doesn't work. It's just loading.";

function getBrowserFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function updateBrowserFullscreenButton() {
  const button = _fullscreenBtn();
  if (!button) return;
  const isFullscreen = getBrowserFullscreenElement() === _overlay();
  const title = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = isFullscreen
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
}

function exitBrowserFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!exit || !getBrowserFullscreenElement()) return Promise.resolve();
  return Promise.resolve(exit.call(document)).catch(() => {});
}

function toggleBrowserFullscreen() {
  const overlay = _overlay();
  if (!overlay) return;
  if (getBrowserFullscreenElement() === overlay) {
    exitBrowserFullscreen();
    return;
  }

  const request = overlay.requestFullscreen || overlay.webkitRequestFullscreen;
  if (!request) {
    announcement('Fullscreen is not supported in this browser.');
    return;
  }
  Promise.resolve(request.call(overlay)).catch(() => {
    announcement('Fullscreen was blocked. Try pressing the fullscreen button again.');
  });
}

document.addEventListener('fullscreenchange', updateBrowserFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateBrowserFullscreenButton);

function hideLoadingNotice() {
  clearTimeout(_loadingNoticeTimer);
  _loadingNoticeTimer = null;
  const notice = _loadingNotice();
  if (!notice) return;
  notice.classList.remove('visible');
  notice.classList.add('faded');
  notice.textContent = '';
}

function showLoadingNotice(message, duration = 3000) {
  const notice = _loadingNotice();
  if (!notice || !message) {
    hideLoadingNotice();
    return;
  }
  clearTimeout(_loadingNoticeTimer);
  notice.textContent = message;
  notice.classList.remove('faded');
  notice.classList.add('visible');
  _loadingNoticeTimer = setTimeout(() => {
    notice.classList.remove('visible');
    notice.classList.add('faded');
    _loadingNoticeTimer = null;
  }, duration);
}

function autoStartChillflix(frame, attempt = 0) {
  if (!frame || attempt > 20) return;
  try {
    const watchButton = Array.from(frame.contentDocument?.querySelectorAll('button') || [])
      .find(button => button.textContent.trim().toLowerCase() === 'watch');
    if (watchButton) {
      watchButton.click();
      return;
    }
  } catch {}
  setTimeout(() => autoStartChillflix(frame, attempt + 1), 250);
}

function openBrowserOverlay(proxyUrl, displayUrl, loadingNotice = '', options = {}) {
  const overlay = _overlay();
  const frame   = _frame();
  const loading = _loading();

  clearTimeout(_closeBrowserTimer);
  clearTimeout(_loadingFadeTimer);
  hideLoadingNotice();
  overlay.classList.remove('closing');
  overlay.classList.add('open');
  loading.classList.remove('faded');
  _urlBar().textContent = displayUrl || proxyUrl;
  const hasLoadingNotice = Boolean(loadingNotice);
  showLoadingNotice(loadingNotice);

  const isProxiedPage = String(proxyUrl).startsWith(__uv$config.prefix);
  const blockPopups = options.blockPopups === true;
  const allowSameOrigin = options.allowSameOrigin === true;
  if (isProxiedPage) {
    frame.setAttribute(
      'sandbox',
      `allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-modals${blockPopups ? '' : ' allow-popups'} allow-downloads allow-presentation${blockPopups ? '' : ' allow-top-navigation-by-user-activation'}`,
    );
  } else {
    frame.setAttribute(
      'sandbox',
      `${allowSameOrigin ? 'allow-same-origin ' : ''}allow-scripts allow-forms allow-pointer-lock allow-modals${blockPopups ? '' : ' allow-popups'} allow-downloads allow-presentation`,
    );
  }
  frame.onload = function() {
    if (blockPopups) {
      try {
        const currentUrl = frame.contentWindow.location.href;
        const currentPath = new URL(currentUrl).pathname;
        if (currentPath.startsWith(__uv$config.prefix)) {
          const encodedTarget = currentPath.slice(__uv$config.prefix.length);
          const decodedTarget = __uv$config.decodeUrl(encodedTarget);
          const targetHost = new URL(decodedTarget).hostname;
          const remainsOnChillflix = targetHost === 'chillflix.lol' || targetHost.endsWith('.chillflix.lol');
          if (!remainsOnChillflix) {
            frame.src = proxyUrl;
            announcement('Chillflix tried to open another website, so Void blocked it.');
            return;
          }
        }
      } catch {}
    }
    if (blockPopups) autoStartChillflix(frame);
    loading.classList.add('faded');
  };
  frame.src = proxyUrl;
}

function closeBrowser() {
  reportFriendsActivity(null);
  const overlay = _overlay();
  if (!overlay.classList.contains('open') || overlay.classList.contains('closing')) return;
  exitBrowserFullscreen();
  clearTimeout(_loadingFadeTimer);
  _loadingFadeTimer = null;
  overlay.classList.remove('open');
  overlay.classList.add('closing');
  _closeBrowserTimer = setTimeout(() => {
    const frame = _frame();
    overlay.classList.remove('closing');
    frame.src = '';
    _loading().classList.remove('faded');
    hideLoadingNotice();
  }, 340);
}

function browserBack() {
  try { _frame().contentWindow.history.back(); } catch(e) {}
}

function browserForward() {
  try { _frame().contentWindow.history.forward(); } catch(e) {}
}

function browserReload() {
  try { _frame().contentWindow.location.reload(); } catch(e) {
    const f = _frame(); const s = f.src; f.src = ''; f.src = s;
  }
}

// ── Pre-register SW at startup for instant navigation ──────
let _swPromise = null;
function waitForServiceWorker(registration) {
  if (registration.active) return Promise.resolve(registration);

  const worker = registration.installing || registration.waiting;
  if (!worker) return Promise.resolve(registration);

  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      worker.removeEventListener('statechange', onStateChange);
      reject(new Error('Proxy service worker activation timed out'));
    }, 7000);
    const finish = callback => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', onStateChange);
      callback(registration);
    };
    const onStateChange = () => {
      if (worker.state === 'activated') {
        finish(resolve);
      } else if (worker.state === 'redundant') {
        finish(() => reject(new Error('Proxy service worker became redundant')));
      }
    };
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  });
}

function ensureSW(forceRetry = false) {
  if (forceRetry) {
    _swPromise = null;
    window.__voidProxyRegistrationPromise = null;
  }
  if (!_swPromise) {
    if (!('serviceWorker' in navigator)) {
      return Promise.reject(new Error('Service workers are unavailable'));
    }
    const prewarmedRegistration = window.__voidProxyRegistrationPromise;
    const proxyWorkerUrl = window.__voidProxyWorkerUrl || '/uv.js?v=6';
    const registrationPromise = forceRetry
      ? navigator.serviceWorker.getRegistration(__uv$config.prefix)
          .then(registration => registration ? registration.unregister() : undefined)
          .then(() => navigator.serviceWorker.register(proxyWorkerUrl, {
            scope: __uv$config.prefix,
            updateViaCache: 'none',
          }))
      : prewarmedRegistration
        ? prewarmedRegistration.then(registration => registration || navigator.serviceWorker.getRegistration(__uv$config.prefix))
        : navigator.serviceWorker.getRegistration(__uv$config.prefix);
    _swPromise = registrationPromise
      .then(registration => registration || navigator.serviceWorker.register(proxyWorkerUrl, {
        scope: __uv$config.prefix,
        updateViaCache: 'none',
      }))
      .then(waitForServiceWorker)
      .catch(error => {
        _swPromise = null;
        throw error;
      });
  }
  return _swPromise;
}
ensureSW().catch(() => {}); // warm up immediately on page load

async function fixProxy() {
  const button = document.getElementById('proxyFixButton');
  const status = document.getElementById('proxyFixStatus');
  if (button) button.disabled = true;
  if (status) status.textContent = 'Refreshing proxy...';

  try {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are unavailable');
    }
    const registration = await navigator.serviceWorker.getRegistration(__uv$config.prefix);
    if (registration) await registration.unregister();
    _swPromise = null;
    await ensureSW(true);
    if (status) status.textContent = 'Proxy is fixed and ready.';
  } catch (_) {
    _swPromise = null;
    if (status) status.textContent = 'Proxy could not be repaired. Please try again.';
  } finally {
    if (button) button.disabled = false;
  }
}

// ── Open URL through UV proxy ──────────────────────────────
function openURL(url, displayLabel = '', loadingNotice = '') {
  const requestedUrl = String(url || '').trim();
  if (!requestedUrl) {
    announcement('Enter a search or URL first.');
    return;
  }
  reportFriendsActivity(null);
  const launch = (attempt = 0) => ensureSW(attempt > 0).then(() => {
    const displayUrl = displayLabel || url;
    let targetUrl = requestedUrl;
    if (!isUrl(targetUrl)) targetUrl = getSearchEngineURL() + encodeURIComponent(targetUrl);
    else if (!targetUrl.startsWith('https://') && !targetUrl.startsWith('http://')) targetUrl = 'http://' + targetUrl;
    const proxyUrl = __uv$config.prefix + __uv$config.encodeUrl(targetUrl);
    let isChillflixTarget = false;
    try {
      const target = new URL(targetUrl);
      isChillflixTarget = target.hostname === 'chillflix.lol' || target.hostname.endsWith('.chillflix.lol');
    } catch {}
    if (getAboutBlank() === 'on') {
      openAboutBlank(window.location.origin + proxyUrl, { blockPopups: isChillflixTarget });
    } else {
      openBrowserOverlay(proxyUrl, displayUrl, loadingNotice, { blockPopups: isChillflixTarget });
    }
  }).catch(() => {
    if (attempt < 2) {
      setTimeout(() => launch(attempt + 1), 350 * (attempt + 1));
      return;
    }
    announcement('Unable to open this site. Use Settings > Fix Proxy to repair it.');
  });
  launch();
}

// ── Open games through the built-in browser bar ─────────────
function openGameEmbed(embedUrl, gameName = 'Game', gameKey = '') {
  const displayName = String(gameName)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  recordRecentlyPlayed(gameKey, { embed: embedUrl, name: displayName });
  if (String(embedUrl).startsWith('/')) {
    reportFriendsActivity(displayName);
    const localUrl = new URL(embedUrl, window.location.origin).href;
    const isStashGame = embedUrl.startsWith('/api/stash-game');
    if (getAboutBlank() === 'on') {
      openAboutBlank(localUrl, { allowSameOrigin: isStashGame });
    } else {
      openBrowserOverlay(
        embedUrl,
        `${displayName}:VoidV2`,
        displayName === 'Amanda The Adventurer' ? AMANDA_LOADING_NOTICE : '',
        { allowSameOrigin: isStashGame }
      );
    }
    return;
  }
  openURL(
    embedUrl,
    `${displayName}:VoidV2`,
    embedUrl === AMANDA_ADVENTURER_URL ? AMANDA_LOADING_NOTICE : ''
  );
  reportFriendsActivity(displayName);
}

let _gamesCatalogLoaded = false;
let _gamesLoadPromise = null;
let _gamesPageRun = 0;

function openGamesPage() {
  selectedIcon('icon-games');
  const gamesPage = document.getElementById('games');
  const pageRun = ++_gamesPageRun;
  openPage('games');
  if (!gamesPage) {
    loadMoreGames();
    return;
  }

  gamesPage.classList.remove('games-page-entering');
  void gamesPage.offsetWidth;
  gamesPage.classList.add('games-page-entering');

  // Let the fade render before the large catalog is inserted.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (pageRun !== _gamesPageRun) return;
      loadMoreGames().finally(() => scheduleGamesViewportFill());
    });
  });
}

const MOVIE_SITE_URL = 'https://www.chillflix.lol/';
const movieState = {
  loaded: false,
  loading: false,
  movies: [],
  total: 0,
  page: 0,
  totalPages: Infinity,
  query: '',
  seen: new Set(),
  requestId: 0,
  controller: null,
};

function openMoviesPage() {
  openPage('movies');
  selectedIcon('icon-movies');
  if (location.hash !== '#movies') history.replaceState(null, '', '#movies');
  if (!movieState.loaded && !movieState.loading) loadMoviePage({ reset: true });
}

function openMovieSite(url = MOVIE_SITE_URL, title = 'Movies') {
  openURL(url, `${title}:VoidV2`);
}

function setMoviesStatus(message = '') {
  const status = document.getElementById('movies-status');
  if (status) status.textContent = message;
}

function renderMovies(movies, reset = false) {
  const grid = document.getElementById('movies-grid');
  if (!grid) return;
  if (reset) grid.replaceChildren();
  if (!movieState.movies.length && !movies.length) {
    setMoviesStatus('No movies were found.');
    return;
  }
  const fragment = document.createDocumentFragment();
  movies.forEach(movie => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'movie-poster-card';
    card.addEventListener('click', () => openMovieSite(movie.watchUrl, movie.title));

    const posterWrap = document.createElement('span');
    posterWrap.className = 'movie-poster-wrap';
    const fallback = document.createElement('span');
    fallback.className = 'movie-poster-fallback';
    fallback.textContent = 'V';
    posterWrap.appendChild(fallback);
    if (movie.poster) {
      const poster = document.createElement('img');
      poster.src = movie.poster;
      poster.alt = '';
      poster.loading = 'lazy';
      poster.decoding = 'async';
      poster.addEventListener('error', () => poster.remove());
      posterWrap.appendChild(poster);
    }
    if (Number.isFinite(movie.rating)) {
      const rating = document.createElement('span');
      rating.className = 'movie-poster-rating';
      rating.textContent = `★ ${movie.rating.toFixed(1)}`;
      posterWrap.appendChild(rating);
    }

    const copy = document.createElement('span');
    copy.className = 'movie-poster-copy';
    const title = document.createElement('span');
    title.className = 'movie-poster-title';
    title.textContent = movie.title;
    const source = document.createElement('span');
    source.className = 'movie-poster-source';
    source.textContent = movie.year || 'Movie';
    copy.append(title, source);
    card.append(posterWrap, copy);
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
}

async function loadMoviePage({ reset = false } = {}) {
  if (movieState.loading && !reset) return;
  if (!reset && movieState.page >= movieState.totalPages) return;
  if (reset) {
    movieState.controller?.abort();
    movieState.requestId += 1;
    movieState.page = 0;
    movieState.totalPages = Infinity;
    movieState.total = 0;
    movieState.movies = [];
    movieState.seen.clear();
    document.getElementById('movies-grid')?.replaceChildren();
  }
  const requestId = ++movieState.requestId;
  const controller = new AbortController();
  movieState.controller = controller;
  movieState.loading = true;
  setMoviesStatus(movieState.page ? 'Loading more movies…' : 'Loading movies…');
  const nextPage = movieState.page + 1;
  const query = movieState.query;
  try {
    const endpoint = query.length >= 2
      ? `/api/movies/search?q=${encodeURIComponent(query)}&page=${nextPage}`
      : `/api/movies/catalog?category=all&page=${nextPage}`;
    const response = await fetch(endpoint, { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Movies could not be loaded.');
    if (requestId !== movieState.requestId || query !== movieState.query) return;
    const incoming = (Array.isArray(data.movies) ? data.movies : []).filter(movie => {
      if (!movie?.id || movieState.seen.has(movie.id)) return false;
      movieState.seen.add(movie.id);
      return true;
    });
    movieState.movies.push(...incoming);
    movieState.total = Number(data.total) || movieState.movies.length;
    movieState.page = Number(data.page) || nextPage;
    movieState.totalPages = Math.min(500, Number(data.totalPages) || movieState.page);
    movieState.loaded = true;
    renderMovies(incoming, reset);
    if (!movieState.movies.length) setMoviesStatus('No movies were found.');
    else if (movieState.page >= movieState.totalPages) {
      setMoviesStatus(`${movieState.movies.length.toLocaleString()} movies loaded.`);
    } else {
      setMoviesStatus('');
    }
  } catch (error) {
    if (error.name !== 'AbortError' && requestId === movieState.requestId) {
      setMoviesStatus(error.message || 'Chillflix is temporarily unavailable.');
    }
  } finally {
    if (requestId === movieState.requestId) movieState.loading = false;
  }
}

function searchMovieCatalog(query) {
  movieState.query = query.trim();
  movieState.loaded = false;
  loadMoviePage({ reset: true });
}

let movieSearchTimer = 0;
function scheduleMovieSearch(immediate = false) {
  clearTimeout(movieSearchTimer);
  const query = document.getElementById('movies-search-input')?.value.trim() || '';
  if (query.length === 1) {
    movieState.controller?.abort();
    setMoviesStatus('Keep typing to search.');
    return;
  }
  movieSearchTimer = setTimeout(() => searchMovieCatalog(query), immediate ? 0 : 280);
}

document.getElementById('movies-search-form')?.addEventListener('submit', event => {
  event.preventDefault();
  scheduleMovieSearch(true);
});
document.getElementById('movies-search-input')?.addEventListener('input', () => scheduleMovieSearch());

const moviesSentinel = document.getElementById('movies-sentinel');
if (moviesSentinel && 'IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    if (entries[0]?.isIntersecting && movieState.loaded && !movieState.loading) {
      loadMoviePage();
    }
  }, {
    root: document.getElementById('movies-content'),
    rootMargin: '900px 0px',
  }).observe(moviesSentinel);
}

// ── Search form ────────────────────────────────────────────
const form = document.getElementById('search-form');
const input = document.getElementById('searchInput');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const url = input.value.trim();
    if (url) openURL(url);
  });
}

// ── Page switching ─────────────────────────────────────────
function openPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(page);
  if (el) el.classList.add('active');
  document.getElementById('music-player')?.classList.toggle('on-music-page', page === 'music');
  window.VoidFriendsCalls?.syncSurface?.();
  if (window.VoidBackground) {
    if (page === 'games') window.VoidBackground.pause();
    else window.VoidBackground.resume();
  }
}

function openHomePage() {
  openPage('search');
  selectedIcon('icon-search');
  if (location.hash) history.replaceState(null, '', '#search');
}

// ── Native Void AI ─────────────────────────────────────────
const AI_STORAGE_KEY = 'voidAIConversation';
const aiState = {
  conversationId: null,
  parentMessageId: null,
  model: 'motif-102b',
  messages: [],
  loading: false,
  controller: null,
  recoveredPending: false,
};

function safeAIImageUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.freeimggen.com' && url.pathname.startsWith('/results/')
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function readAIState() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || '{}');
    aiState.conversationId = typeof saved.conversationId === 'string' ? saved.conversationId : null;
    aiState.parentMessageId = typeof saved.parentMessageId === 'string' ? saved.parentMessageId : null;
    aiState.model = ['motif-102b', 'motif-tiny', 'motif-12-7b-reasoning'].includes(saved.model)
      ? saved.model
      : 'motif-102b';
    aiState.messages = Array.isArray(saved.messages)
      ? saved.messages
        .filter(message => ['user', 'assistant'].includes(message?.role) && typeof message?.text === 'string')
        .slice(-80)
        .map(message => {
          const imageUrl = safeAIImageUrl(message.imageUrl);
          return {
            role: message.role,
            text: message.text.slice(0, 50000),
            ...(imageUrl ? { imageUrl, imagePrompt: String(message.imagePrompt || '').slice(0, 1600) } : {}),
          };
        })
      : [];
    aiState.recoveredPending = saved.pending === true;
    if (aiState.recoveredPending) {
      const last = aiState.messages.at(-1);
      if (last?.role === 'assistant' && last.text.trim()) {
        last.text += '\n\n[The response was interrupted.]';
      }
    }
  } catch {
    aiState.conversationId = null;
    aiState.parentMessageId = null;
    aiState.model = 'motif-102b';
    aiState.messages = [];
    aiState.recoveredPending = false;
  }
}

function saveAIState() {
  try {
    const messages = [];
    let remainingChars = 120000;
    for (const message of aiState.messages.slice(-40).reverse()) {
      const text = String(message.text || '').slice(0, 50000);
      if (!text && message.streaming) continue;
      if (text.length > remainingChars) break;
      const imageUrl = safeAIImageUrl(message.imageUrl);
      messages.unshift({
        role: message.role,
        text,
        ...(imageUrl ? { imageUrl, imagePrompt: String(message.imagePrompt || '').slice(0, 1600) } : {}),
      });
      remainingChars -= text.length;
    }
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({
      conversationId: aiState.conversationId,
      parentMessageId: aiState.parentMessageId,
      model: aiState.model,
      messages,
      pending: aiState.loading,
    }));
  } catch {
    // The active chat continues even when browser storage is unavailable.
  }
}

function aiGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Night';
}

function setAIStatus(message = '') {
  const status = document.getElementById('ai-status');
  if (status) status.textContent = message;
}

function scrollAIToBottom() {
  const conversation = document.getElementById('ai-conversation');
  if (!conversation) return;
  requestAnimationFrame(() => {
    conversation.scrollTop = conversation.scrollHeight;
  });
}

function createAIMessage(message, index) {
  const row = document.createElement('article');
  row.className = `ai-message ${message.role}`;
  row.dataset.messageIndex = String(index);
  const avatar = document.createElement('div');
  avatar.className = 'ai-message-avatar';
  avatar.textContent = message.role === 'user' ? 'YOU' : 'AI';
  const body = document.createElement('div');
  body.className = `ai-message-body${message.streaming ? ' streaming' : ''}`;
  body.textContent = message.text || (message.streaming ? (message.imageLoading ? 'Creating your image' : 'Thinking') : '');
  if (message.imageLoading) {
    const progress = document.createElement('div');
    progress.className = 'ai-image-progress';
    progress.setAttribute('aria-label', 'Image creation progress');
    const stages = [
      ['Analyzing prompt', 'Understanding your request'],
      ['Crafting composition', 'Building the scene'],
      ['Adding details', 'Enhancing textures and lighting'],
      ['Finalizing', 'Putting the finishing touches'],
    ];
    const activeStage = Math.max(1, Math.min(3, Number(message.imageStage) || 1));
    stages.forEach(([title, detail], stageIndex) => {
      const step = document.createElement('div');
      step.className = `ai-image-progress-step ${stageIndex < activeStage ? 'complete' : stageIndex === activeStage ? 'active' : 'pending'}`;
      const icon = document.createElement('span');
      icon.className = 'ai-image-progress-icon';
      icon.innerHTML = stageIndex === 0
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m6.5 17 4-4 2.5 2.5 2-2 2.5 3.5"/></svg>'
        : stageIndex === 1
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 19 5.5-1.4L19 8.1 15.9 5 6.4 14.5 4 19Z"/><path d="m14.8 6.1 3.1 3.1M7 17l-1-1"/></svg>'
          : stageIndex === 2
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 14 4-4 3 3 5-6 4 4"/><path d="M4 19h16"/></svg>';
      const copy = document.createElement('div');
      const stepTitle = document.createElement('div');
      stepTitle.className = 'ai-image-progress-title';
      stepTitle.textContent = title;
      const stepDetail = document.createElement('div');
      stepDetail.className = 'ai-image-progress-detail';
      stepDetail.textContent = `${detail}...`;
      copy.append(stepTitle, stepDetail);
      const state = document.createElement('span');
      state.className = 'ai-image-progress-state';
      step.append(icon, copy, state);
      progress.appendChild(step);
    });
    body.appendChild(progress);
  }
  const imageUrl = safeAIImageUrl(message.imageUrl);
  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'ai-generated-image';
    image.src = imageUrl;
    image.alt = message.imagePrompt ? `AI-generated image: ${message.imagePrompt}` : 'AI-generated image';
    image.loading = 'lazy';
    const caption = document.createElement('span');
    caption.className = 'ai-generated-caption';
    caption.textContent = 'Generated with FreeImgGen';
    body.append(image, caption);
  }
  row.append(avatar, body);
  return row;
}

function renderAIConversation() {
  const empty = document.getElementById('ai-empty');
  const messages = document.getElementById('ai-messages');
  const recent = document.getElementById('ai-recent-list');
  const model = document.getElementById('ai-model');
  const send = document.getElementById('ai-send');
  if (!messages || !empty) return;

  document.getElementById('ai-greeting').textContent = aiGreeting();
  empty.hidden = aiState.messages.length > 0;
  messages.hidden = aiState.messages.length === 0;
  messages.replaceChildren(...aiState.messages.map(createAIMessage));
  if (model) model.value = aiState.model;
  if (send) send.disabled = aiState.loading;

  if (recent) {
    recent.replaceChildren();
    const firstPrompt = aiState.messages.find(message => message.role === 'user')?.text.trim();
    if (!firstPrompt) {
      const emptyRecent = document.createElement('div');
      emptyRecent.className = 'ai-recent-empty';
      emptyRecent.textContent = 'No conversations yet';
      recent.appendChild(emptyRecent);
    } else {
      const current = document.createElement('button');
      current.type = 'button';
      current.className = 'ai-recent-item active';
      current.textContent = firstPrompt;
      current.title = firstPrompt;
      current.addEventListener('click', scrollAIToBottom);
      recent.appendChild(current);
    }
  }
  scrollAIToBottom();
}

function autoSizeAIInput() {
  const input = document.getElementById('ai-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 190)}px`;
}

function openVoidAIPage() {
  reportFriendsActivity(null);
  openPage('void-ai');
  selectedIcon('');
  if (location.hash !== '#ai') history.replaceState(null, '', '#ai');
  renderAIConversation();
  setTimeout(() => document.getElementById('ai-input')?.focus(), 80);
}

function startNewAIChat() {
  aiState.controller?.abort();
  aiState.controller = null;
  aiState.conversationId = null;
  aiState.parentMessageId = null;
  aiState.messages = [];
  aiState.loading = false;
  aiState.recoveredPending = false;
  localStorage.removeItem(AI_STORAGE_KEY);
  setAIStatus('');
  const input = document.getElementById('ai-input');
  if (input) {
    input.value = '';
    autoSizeAIInput();
  }
  renderAIConversation();
  input?.focus();
}

function parseAIStreamEvent(block) {
  const data = block
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function boundedAIContext(instruction) {
  const context = [];
  let remainingChars = Math.max(0, Math.min(10000, 22000 - String(instruction || '').length));
  const priorMessages = aiState.messages.slice(0, -2).slice(-12);
  for (const message of priorMessages.reverse()) {
    if (remainingChars <= 0) break;
    const text = String(message.text || '').trim().slice(0, Math.min(4000, remainingChars));
    if (!text) continue;
    context.unshift({ role: message.role, text });
    remainingChars -= text.length;
  }
  return context;
}

function isAIImageRequest(instruction) {
  const text = String(instruction || '').trim();
  return /\b(create|generate|make|draw|render|design|paint|illustrate)\b[\s\S]{0,80}\b(image|picture|photo|illustration|artwork|wallpaper|logo)\b/i.test(text)
    || /\b(image|picture|photo|illustration|artwork|wallpaper|logo)\b[\s\S]{0,50}\b(of|showing|with|for)\b/i.test(text);
}

async function submitAIMessage(instruction) {
  if (aiState.loading) return;
  const text = String(instruction || '').trim();
  if (!text) {
    setAIStatus('Enter a message first.');
    return;
  }

  setAIStatus('');
  aiState.loading = true;
  aiState.messages.push({ role: 'user', text });
  const imageRequest = isAIImageRequest(text);
  const assistant = { role: 'assistant', text: '', streaming: true, imageLoading: imageRequest, imageStage: imageRequest ? 1 : 0 };
  aiState.messages.push(assistant);
  saveAIState();
  renderAIConversation();

  const controller = new AbortController();
  aiState.controller = controller;
  let imageProgressTimer = null;
  if (imageRequest) {
    imageProgressTimer = setInterval(() => {
      if (!aiState.loading || !assistant.imageLoading) return;
      assistant.imageStage = Math.min(3, assistant.imageStage + 1);
      renderAIConversation();
    }, 2800);
  }
  try {
    if (imageRequest) {
      const imageResponse = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, aspectRatio: '1:1' }),
        signal: controller.signal,
      });
      const imageData = await imageResponse.json().catch(() => ({}));
      if (!imageResponse.ok || !safeAIImageUrl(imageData.imageUrl)) {
        throw new Error(imageData.error || 'Void AI could not create that image right now.');
      }
      assistant.text = 'Here is the image I created for you.';
      assistant.imageUrl = imageData.imageUrl;
      assistant.imagePrompt = text;
      assistant.imageLoading = false;
      assistant.streaming = false;
      saveAIState();
      renderAIConversation();
      return;
    }

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: aiState.conversationId,
        parent_message_id: aiState.parentMessageId,
        model: aiState.model,
        instruction: text,
        context: boundedAIContext(text),
        language: navigator.language?.slice(0, 2) || 'en',
      }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Void AI could not answer right now.');
    }

    const row = document.querySelector(`[data-message-index="${aiState.messages.length - 1}"]`);
    const messageBody = row?.querySelector('.ai-message-body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let complete = false;

    const consumeEvent = event => {
      if (!event || typeof event !== 'object') return;
      if (event.type === 'chat.start') {
        if (typeof event.data?.conversation_id === 'string') {
          aiState.conversationId = event.data.conversation_id;
        }
        if (typeof event.data?.response_message_id === 'string') {
          aiState.parentMessageId = event.data.response_message_id;
        }
        saveAIState();
        return;
      }
      if (event.type === 'MESSAGE' && typeof event.data === 'string') {
        assistant.text += event.data;
        if (messageBody) {
          messageBody.textContent = assistant.text;
          messageBody.classList.add('streaming');
        }
        saveAIState();
        scrollAIToBottom();
        return;
      }
      if (event.type === 'chat.blocked') {
        assistant.text = String(event.data?.block_message || 'That request could not be answered.');
        complete = true;
        return;
      }
      if (event.type === 'chat.complete') {
        complete = true;
        return;
      }
      if (event.type === 'SIGN' && String(event.data || '').includes('HUB_ERROR_SIGN')) {
        throw new Error('The AI service ended the response unexpectedly.');
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      events.forEach(block => consumeEvent(parseAIStreamEvent(block)));
      if (done) break;
    }
    if (buffer.trim()) consumeEvent(parseAIStreamEvent(buffer));
    if (!assistant.text.trim() && !complete) {
      throw new Error('The AI service returned an empty response.');
    }
    if (!assistant.text.trim()) assistant.text = 'I could not produce a response. Please try again.';
    assistant.streaming = false;
    if (messageBody) {
      messageBody.textContent = assistant.text;
      messageBody.classList.remove('streaming');
    }
    saveAIState();
  } catch (error) {
    if (error.name === 'AbortError') return;
    assistant.streaming = false;
    assistant.imageLoading = false;
    if (!assistant.text) {
      aiState.messages = aiState.messages.filter(message => message !== assistant);
    }
    setAIStatus(error.message || 'Void AI is temporarily unavailable.');
    renderAIConversation();
  } finally {
    if (imageProgressTimer) clearInterval(imageProgressTimer);
    if (aiState.controller === controller) aiState.controller = null;
    aiState.loading = false;
    document.getElementById('ai-send')?.removeAttribute('disabled');
    saveAIState();
    renderAIConversation();
  }
}

readAIState();
if (aiState.recoveredPending) {
  setAIStatus('The previous response was interrupted. You can continue or start a new chat.');
  aiState.recoveredPending = false;
  saveAIState();
}
document.getElementById('ai-new-chat')?.addEventListener('click', startNewAIChat);
document.getElementById('ai-attach')?.addEventListener('click', () => {
  announcement('Attachments are not supported in the native Void AI view yet.');
});
document.getElementById('ai-image-create')?.addEventListener('click', () => {
  const input = document.getElementById('ai-input');
  if (!input) return;
  const current = input.value.trim();
  if (!current) input.value = 'Create an image of ';
  else if (!isAIImageRequest(current)) input.value = `Create an image of ${current}`;
  autoSizeAIInput();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
});
document.getElementById('ai-model')?.addEventListener('change', event => {
  aiState.model = event.target.value;
  saveAIState();
});
document.getElementById('ai-input')?.addEventListener('input', autoSizeAIInput);
document.getElementById('ai-input')?.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    document.getElementById('ai-form')?.requestSubmit();
  }
});
document.getElementById('ai-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('ai-input');
  const text = input?.value || '';
  if (!text.trim() || aiState.loading) return;
  input.value = '';
  autoSizeAIInput();
  submitAIMessage(text);
});
renderAIConversation();
if (location.hash === '#ai') openVoidAIPage();

// ── Tab Cloaker ────────────────────────────────────────────
const CLOAK_PRESETS = {
  '': {
    title: 'Void V2',
    favicon: 'favicon.ico'
  },
  gdocs: {
    title: 'Untitled document - Google Docs',
    favicon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico'
  },
  gclassroom: {
    title: 'Stream - Google Classroom',
    favicon: 'https://fonts.gstatic.com/s/i/productlogos/classroom/v7/web-32dp/logo_classroom_color_1x_web_32dp.png'
  },
  gforms: {
    title: 'Untitled form - Google Forms',
    favicon: 'https://ssl.gstatic.com/docs/spreadsheets/forms/favicon_qp2.png'
  },
  khan: {
    title: 'Khan Academy | Free Online Courses',
    favicon: 'https://cdn.kastatic.org/images/favicon.ico'
  },
  canvas: {
    title: 'Dashboard | Canvas',
    favicon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico'
  },
  duolingo: {
    title: 'Learn a Language for Free — Duolingo',
    favicon: 'https://d35aaqx5ub95lt.cloudfront.net/vendor/784537b434fcc30f71ed5a6a92c60eba.ico'
  },
  desmos: {
    title: 'Desmos | Graphing Calculator',
    favicon: 'https://www.desmos.com/assets/img/apps/graphing/icon.png'
  },
  wikipedia: {
    title: 'Wikipedia, the free encyclopedia',
    favicon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico'
  },
  schoology: {
    title: 'Schoology',
    favicon: 'https://asset-cdn.schoology.com/sites/all/themes/schoology_theme/favicon.ico'
  }
};

function setupCloak() {
  const preset = localStorage.getItem('cloakPreset') || '';
  const p = CLOAK_PRESETS[preset] || CLOAK_PRESETS[''];
  document.title = p.title;
  let link = document.getElementById('dynamic-favicon');
  if (!link) {
    link = document.createElement('link');
    link.id = 'dynamic-favicon';
    link.rel = 'shortcut icon';
    document.head.appendChild(link);
  }
  link.href = p.favicon;

  const sel = document.getElementById('cloakPreset');
  if (sel) sel.value = preset;
}

function applyCloakPreset() {
  const preset = document.getElementById('cloakPreset').value;
  localStorage.setItem('cloakPreset', preset);
  const p = CLOAK_PRESETS[preset] || CLOAK_PRESETS[''];
  document.title = p.title;
  let link = document.getElementById('dynamic-favicon');
  if (!link) {
    link = document.createElement('link');
    link.id = 'dynamic-favicon';
    link.rel = 'shortcut icon';
    document.head.appendChild(link);
  }
  link.href = p.favicon;
}

// ── Background color ────────────────────────────────────────
function getBackgroundColor() {
  return localStorage.getItem('backgroundColor') || '#000000';
}

function applyBackgroundColor(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  localStorage.setItem('backgroundColor', color);
  document.body.style.backgroundColor = color;
  const picker = document.getElementById('backgroundColor');
  const value = document.getElementById('backgroundColorValue');
  if (picker) picker.value = color;
  if (value) value.value = color;
}

function setBackgroundImage(file) {
  const status = document.getElementById('backgroundImageStatus');
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    if (status) status.textContent = 'Please choose an image file.';
    return;
  }
  backgroundVideoLoadToken++;
  localStorage.setItem(BACKGROUND_VIDEO_DISABLED, 'true');
  removeStoredBackgroundVideo();
  if (window.VoidBackground) window.VoidBackground.clearVideo();
  const videoInput = document.getElementById('backgroundVideoFile');
  const videoStatus = document.getElementById('backgroundVideoStatus');
  if (videoInput) videoInput.value = '';
  if (videoStatus) videoStatus.textContent = 'No live video background selected.';

  const reader = new FileReader();
  reader.onload = () => {
    const source = new Image();
    source.onload = () => {
      const maxDimension = 1920;
      const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
      const output = document.createElement('canvas');
      output.width = Math.max(1, Math.round(source.naturalWidth * scale));
      output.height = Math.max(1, Math.round(source.naturalHeight * scale));
      const outputContext = output.getContext('2d');
      outputContext.drawImage(source, 0, 0, output.width, output.height);
      const compressed = output.toDataURL('image/jpeg', 0.82);
      try {
        localStorage.setItem('backgroundImage', compressed);
        if (window.VoidBackground) window.VoidBackground.setImage(compressed);
        if (status) status.textContent = 'Custom image background is active on this device.';
      } catch (_) {
        if (status) status.textContent = 'That image is too large to save. Try a smaller image.';
      }
    };
    source.onerror = () => {
      if (status) status.textContent = 'That image could not be loaded.';
    };
    source.src = reader.result;
  };
  reader.onerror = () => {
    if (status) status.textContent = 'The image could not be read.';
  };
  reader.readAsDataURL(file);
}

const BACKGROUND_VIDEO_DB = 'void-v2-backgrounds';
const BACKGROUND_VIDEO_STORE = 'media';
let backgroundVideoLoadToken = 0;

function openBackgroundVideoDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Browser storage is unavailable.'));
      return;
    }
    const request = indexedDB.open(BACKGROUND_VIDEO_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(BACKGROUND_VIDEO_STORE)) {
        request.result.createObjectStore(BACKGROUND_VIDEO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser storage.'));
  });
}

async function storeBackgroundVideo(file) {
  const db = await openBackgroundVideoDB();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(BACKGROUND_VIDEO_STORE, 'readwrite');
    transaction.objectStore(BACKGROUND_VIDEO_STORE).put(file, 'video');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save video.'));
  });
  db.close();
}

async function loadStoredBackgroundVideo() {
  const db = await openBackgroundVideoDB();
  const file = await new Promise((resolve, reject) => {
    const transaction = db.transaction(BACKGROUND_VIDEO_STORE, 'readonly');
    const request = transaction.objectStore(BACKGROUND_VIDEO_STORE).get('video');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read video.'));
  });
  db.close();
  return file;
}

async function removeStoredBackgroundVideo() {
  try {
    const db = await openBackgroundVideoDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_VIDEO_STORE, 'readwrite');
      transaction.objectStore(BACKGROUND_VIDEO_STORE).delete('video');
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch (_) {}
}

function setBackgroundVideo(file) {
  const status = document.getElementById('backgroundVideoStatus');
  if (!file) return;
  const looksLikeVideo = file.type.startsWith('video/')
    || /\.(mp4|webm|ogg|mov|m4v)$/i.test(file.name);
  if (!looksLikeVideo) {
    if (status) status.textContent = 'Please choose a video file.';
    return;
  }
  if (file.size > 250 * 1024 * 1024) {
    if (status) status.textContent = 'That video is too large. Choose one under 250 MB.';
    return;
  }

  const token = ++backgroundVideoLoadToken;
  localStorage.removeItem(BACKGROUND_VIDEO_DISABLED);
  if (window.VoidBackground) window.VoidBackground.setVideo(file);
  const imageInput = document.getElementById('backgroundImageFile');
  if (imageInput) imageInput.value = '';
  if (status) status.textContent = 'Live video background is active on this device.';
  storeBackgroundVideo(file).catch(() => {
    if (token === backgroundVideoLoadToken && status) {
      status.textContent = 'Live video is active for this session; browser storage was unavailable.';
    }
  });
}

function clearBackgroundVideo() {
  backgroundVideoLoadToken++;
  localStorage.setItem(BACKGROUND_VIDEO_DISABLED, 'true');
  removeStoredBackgroundVideo();
  if (window.VoidBackground) window.VoidBackground.clearVideo();
  const input = document.getElementById('backgroundVideoFile');
  const status = document.getElementById('backgroundVideoStatus');
  if (input) input.value = '';
  if (status) status.textContent = 'No live video background selected.';
}

function clearBackgroundImage() {
  localStorage.removeItem('backgroundImage');
  localStorage.removeItem(BACKGROUND_VIDEO_DISABLED);
  if (window.VoidBackground) window.VoidBackground.clearImage();
  if (window.VoidBackground) window.VoidBackground.setVideo(DEFAULT_BACKGROUND_VIDEO);
  const input = document.getElementById('backgroundImageFile');
  const status = document.getElementById('backgroundImageStatus');
  if (input) input.value = '';
  if (status) status.textContent = 'Using the default image background.';
}

function setupBackgroundImage() {
  const status = document.getElementById('backgroundImageStatus');
  if (status) {
    status.textContent = localStorage.getItem('backgroundImage')
      ? 'Custom image background is active on this device.'
      : 'Using the default image background.';
  }
}

async function setupBackgroundVideo() {
  const status = document.getElementById('backgroundVideoStatus');
  if (status) {
    status.textContent = localStorage.getItem(BACKGROUND_VIDEO_DISABLED) === 'true'
      ? 'No live video background selected.'
      : 'Using the default video background.';
  }
  const token = backgroundVideoLoadToken;
  try {
    const file = await loadStoredBackgroundVideo();
    if (!file || token !== backgroundVideoLoadToken) return;
    if (window.VoidBackground) window.VoidBackground.setVideo(file);
    if (status) status.textContent = 'Live video background is active on this device.';
  } catch (_) {
    if (status) status.textContent = 'No live video background selected.';
  }
}

const $backgroundColor = document.getElementById('backgroundColor');
const $backgroundColorValue = document.getElementById('backgroundColorValue');
if ($backgroundColor) {
  $backgroundColor.addEventListener('input', () => applyBackgroundColor($backgroundColor.value));
}
if ($backgroundColorValue) {
  $backgroundColorValue.addEventListener('change', () => applyBackgroundColor($backgroundColorValue.value.trim()));
}

function getBackgroundStyle() {
  return localStorage.getItem('backgroundStyle') || 'stars';
}

function setBackgroundStyle() {
  const select = document.getElementById('backgroundStyle');
  if (select && window.VoidBackground) window.VoidBackground.setStyle(select.value);
}

function setBackgroundMotion() {
  const toggle = document.getElementById('backgroundMotion');
  if (toggle && window.VoidBackground) window.VoidBackground.setMotion(toggle.checked);
}

function setBackgroundIntensity() {
  const slider = document.getElementById('backgroundIntensity');
  const value = document.getElementById('backgroundIntensityValue');
  if (!slider) return;
  if (window.VoidBackground) window.VoidBackground.setIntensity(slider.value);
  if (value) value.textContent = `${Number(slider.value).toFixed(1)}x`;
}

const $backgroundStyle = document.getElementById('backgroundStyle');
const $backgroundMotion = document.getElementById('backgroundMotion');
const $backgroundIntensity = document.getElementById('backgroundIntensity');
if ($backgroundStyle) $backgroundStyle.value = getBackgroundStyle();
if ($backgroundMotion) $backgroundMotion.checked = localStorage.getItem('backgroundMotion') !== 'off';
if ($backgroundIntensity) {
  $backgroundIntensity.value = localStorage.getItem('backgroundIntensity') || '0.4';
  const intensityValue = document.getElementById('backgroundIntensityValue');
  if (intensityValue) intensityValue.textContent = `${Number($backgroundIntensity.value).toFixed(1)}x`;
}
setupBackgroundImage();
setupBackgroundVideo();

// ── Sidebar icon highlight ─────────────────────────────────
function selectedIcon(icon) {
  document.querySelectorAll('[id^="icon"]').forEach(el => el.classList.remove('sidebar-icon-selected'));
  const el = document.getElementById(icon);
  if (el) el.classList.add('sidebar-icon-selected');
}

function setupAppsDirectory() {
  const iconSources = {
    youtube: 'shortcut-youtube',
    discord: 'shortcut-discord',
    tiktok: 'shortcut-tiktok',
    spotify: 'shortcut-spotify',
    reddit: 'shortcut-reddit',
    twitch: 'shortcut-twitch',
    netflix: 'shortcut-netflix',
    geforce: 'shortcut-geforce'
  };
  document.querySelectorAll('.apps-card[data-app]').forEach(card => {
    const source = document.querySelector(`#${iconSources[card.dataset.app]} .app-icon-circle`);
    const target = card.querySelector('.apps-card-icon');
    if (source && target) target.appendChild(source.cloneNode(true));
  });
  Object.values(iconSources).forEach(id => document.getElementById(id)?.remove());
}

selectedIcon('icon-search');
setupCloak();
setupAppsDirectory();

// ── Search engine ──────────────────────────────────────────
function getSearchEngine() {
  return localStorage.getItem('searchEngine') || 'DuckDuckGo';
}

function getSearchEngineURL() {
  return localStorage.getItem('searchEngineURL') || 'https://duckduckgo.com/?q=';
}

function setSearchEngine() {
  const engine = document.getElementById('searchSelect').value;
  const urls = {
    'Bing':        'https://www.bing.com/search?q=',
    'Google':      'https://google.com/search?q=',
    'DuckDuckGo':  'https://duckduckgo.com/?q=',
    'Brave Search':'https://search.brave.com/search?q='
  };
  localStorage.setItem('searchEngine', engine);
  localStorage.setItem('searchEngineURL', urls[engine] || urls['Bing']);
}

// ── Analytics ──────────────────────────────────────────────
function getAnalytics() {
  return localStorage.getItem('analytics') || 'on';
}

function setAnalytics() {
  const val = document.getElementById('analyticsSelect').value;
  localStorage.setItem('analytics', val);
  location.reload();
}

if (localStorage.getItem('analytics') !== 'off') {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-CX3B4NHEG0';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-CX3B4NHEG0');
}

// ── About:blank ────────────────────────────────────────────
function getAboutBlank() {
  return localStorage.getItem('aboutBlank') === 'on' ? 'on' : 'off';
}

function setAboutBlank() {
  const val = document.getElementById('aboutBlankSelect').value;
  localStorage.setItem('aboutBlank', val);
  if (val === 'on') openAboutBlank();
}

function openAboutBlank(url, options = {}) {
  const src = url || window.location.origin;
  const w = window.open('about:blank', '_blank');
  if (!w) { alert('Please allow pop-ups and try again.'); return; }
  w.document.body.style.margin = '0';
  const frame = w.document.createElement('iframe');
  frame.style.cssText = 'height:100vh;width:100%;border:none;display:block;';
  frame.allow = 'fullscreen';
  frame.allowFullscreen = true;
  const blockPopups = options.blockPopups === true;
  const allowSameOrigin = options.allowSameOrigin === true;
  if (url) {
    const isProxiedPage = String(url).startsWith(`${window.location.origin}${__uv$config.prefix}`);
    frame.sandbox = `${isProxiedPage || allowSameOrigin ? 'allow-same-origin ' : ''}allow-scripts allow-forms allow-pointer-lock allow-modals${blockPopups ? '' : ' allow-popups'} allow-downloads allow-presentation${blockPopups ? '' : ' allow-top-navigation-by-user-activation'}`;
  }
  frame.src = src;
  w.document.body.appendChild(frame);
  if (blockPopups) {
    frame.addEventListener('load', () => autoStartChillflix(frame));
  }
  window.location.replace(getSearchEngineURL());
}

// ── Custom shortcut ────────────────────────────────────────
function setCustomShortcut() {
  const url = document.getElementById('shortcutURL').value;
  const logo = document.getElementById('shortcutLogo').value;
  if (!url && !logo) {
    alert('Custom shortcut cleared.');
    localStorage.removeItem('shortcutURL');
    localStorage.removeItem('shortcutLogo');
    setupCustomShortcut();
    return;
  }
  if (!url || !logo) { alert('Fill in both fields.'); return; }
  if (!url.match(/https?:\/\/.+/)) { alert('Enter a valid URL starting with https://'); return; }
  localStorage.setItem('shortcutURL', url);
  localStorage.setItem('shortcutLogo', logo.charAt(0));
  alert('Shortcut saved!');
  setupCustomShortcut();
}

function setupCustomShortcut() {
  const url = localStorage.getItem('shortcutURL');
  const logo = localStorage.getItem('shortcutLogo');
  if (url) {
    document.getElementById('customShortcutIcon').textContent = logo || '★';
    document.getElementById('customShortcutDiv').onclick = () => openURL(url);
  }
}
setupCustomShortcut();

// ── Populate settings selects ──────────────────────────────
const $searchSelect = document.getElementById('searchSelect');
if ($searchSelect) $searchSelect.value = getSearchEngine();

const $analyticsSelect = document.getElementById('analyticsSelect');
if ($analyticsSelect) $analyticsSelect.value = getAnalytics();

const $aboutBlankSelect = document.getElementById('aboutBlankSelect');
if ($aboutBlankSelect) $aboutBlankSelect.value = getAboutBlank();
applyBackgroundColor(getBackgroundColor());

// ── Service worker ─────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(window.location.origin + '/js/sw.js');
}

// ── Announcements ──────────────────────────────────────────
let notificationChatUsername = null;
let announcementHideTimer = null;
let announcementCloseTimer = null;

function announcement(text, options = {}) {
  const toast = document.getElementById('announcement');
  if (!toast) return;
  clearTimeout(announcementHideTimer);
  clearTimeout(announcementCloseTimer);
  toast.classList.remove('is-hiding');
  toast.classList.remove('is-visible');
  toast.style.display = 'block';
  // Restart the entrance transition when several notifications arrive together.
  void toast.offsetWidth;
  toast.classList.add('is-visible');
  document.getElementById('notification-text').textContent = text;
  notificationChatUsername = options.chatUsername || null;
  const actions = document.getElementById('toast-actions');
  if (actions) actions.classList.toggle('visible', Boolean(options.showActions));
  announcementHideTimer = setTimeout(closeAnnouncement, 3000);
}

function closeAnnouncement() {
  const toast = document.getElementById('announcement');
  if (!toast) return;
  clearTimeout(announcementHideTimer);
  clearTimeout(announcementCloseTimer);
  toast.classList.remove('is-visible');
  toast.classList.add('is-hiding');
  document.getElementById('toast-actions')?.classList.remove('visible');
  notificationChatUsername = null;
  announcementCloseTimer = setTimeout(() => {
    toast.classList.remove('is-hiding');
    toast.style.display = 'none';
    localStorage.setItem('announcement', Date.now());
  }, 340);
}

function openNotificationChat() {
  const username = notificationChatUsername;
  closeAnnouncement();
  openFriendsPage();
  if (!username) {
    announcement('Open Friends to accept the request before starting a chat.');
    return;
  }
  const friend = friendsState.friends.find(
    item => item.username.toLowerCase() === username.toLowerCase(),
  );
  if (!friend) {
    announcement('This chat is not available yet. Accept the friend request first.');
    return;
  }
  openFriendConversation(friend.username);
}

function fetchAnnouncement() {
  fetch('./assets/announcement.json')
    .then(r => r.json())
    .then(data => {
      const sup = data.super && data.super[0];
      if (sup) { announcement(sup); return; }
      const imp = data.important && data.important[0];
      const norm = data.announcements && data.announcements[Math.floor(Math.random() * data.announcements.length)];
      const pick = Math.random() > 0.5 ? imp : norm;
      if (pick) announcement(pick);
    })
    .catch(() => {});
}

(function showAnnouncement() {
  const last = localStorage.getItem('announcement');
  if (!last || (Date.now() - last) > 2 * 60 * 60 * 1000) fetchAnnouncement();
})();

// ── Games ──────────────────────────────────────────────────
const CAT_COLORS = {
  io: '#9b59b6', action: '#e74c3c', racing: '#f39c12',
  puzzle: '#3498db', classic: '#2ecc71', casual: '#1abc9c',
  strategy: '#e67e22', sports: '#2980b9', shooter: '#c0392b',
  horror: '#8e44ad', adventure: '#16a085'
};

const RECENT_GAMES_STORAGE_KEY = 'voidRecentlyPlayed';
const LIKED_GAMES_STORAGE_KEY = 'voidLikedGames';
const MAX_RECENT_GAMES = 12;
const CLOUD_GAMES = Object.freeze([
  {
    slug: 'void-cloud-nowgg',
    embed: 'https://nowgg.fun/',
    name: 'Cloud Gaming',
    cat: 'cloud',
    source: 'cloud',
    cloud: true,
  },
  {
    slug: 'cloud-windows-11',
    embed: 'https://selenite.cc/resources/sppa/11/index.html',
    name: 'Windows 11',
    cat: 'cloud',
    source: 'cloud',
    image: '/assets/game-images/windows-11.webp',
    cloud: true,
  },
]);
let _likedGameKeys = null;

function getGameKey(game) {
  return String(game?.slug || game?.embed || '').trim();
}

function getStoredGameRecords(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(game => game && typeof game === 'object' && getGameKey(game))
      : [];
  } catch (_) {
    return [];
  }
}

function saveStoredGameRecords(storageKey, records) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(records));
    if (storageKey === LIKED_GAMES_STORAGE_KEY) {
      _likedGameKeys = new Set(records.map(game => getGameKey(game)).filter(Boolean));
    }
  } catch (_) {
    // A full or disabled browser store should not prevent games from launching.
  }
}

function findGameByKey(key) {
  const target = String(key || '');
  const cloudGame = CLOUD_GAMES.find(game => getGameKey(game) === target);
  if (cloudGame) return cloudGame;
  return (window.VOID_GAMES || []).find(game => getGameKey(game) === target) || null;
}

function toStoredGameRecord(game, fallback = {}) {
  const source = game || fallback;
  const key = getGameKey(source) || String(fallback.key || '');
  if (!key) return null;
  return {
    slug: source.slug || fallback.slug || '',
    embed: source.embed || fallback.embed || '',
    name: source.name || fallback.name || 'Game',
    cat: source.cat || fallback.cat || 'casual',
    image: source.image || fallback.image || null,
    source: source.source || fallback.source || '',
    new: Boolean(source.new || fallback.new),
  };
}

function recordRecentlyPlayed(gameKey, fallback = {}) {
  const game = findGameByKey(gameKey);
  const record = toStoredGameRecord(game, { ...fallback, key: gameKey });
  if (!record) return;
  const key = getGameKey(record);
  const records = getStoredGameRecords(RECENT_GAMES_STORAGE_KEY)
    .filter(item => getGameKey(item) !== key);
  records.unshift(record);
  saveStoredGameRecords(RECENT_GAMES_STORAGE_KEY, records.slice(0, MAX_RECENT_GAMES));
  renderGames();
}

function isGameLiked(game) {
  const key = getGameKey(game);
  if (!_likedGameKeys) {
    _likedGameKeys = new Set(
      getStoredGameRecords(LIKED_GAMES_STORAGE_KEY).map(item => getGameKey(item)).filter(Boolean)
    );
  }
  return Boolean(key && _likedGameKeys.has(key));
}

function toggleGameLike(event, button) {
  event.preventDefault();
  event.stopPropagation();
  const key = button?.dataset.gameKey || '';
  const game = findGameByKey(key);
  if (!game) return;
  const records = getStoredGameRecords(LIKED_GAMES_STORAGE_KEY);
  const alreadyLiked = records.some(item => getGameKey(item) === key);
  const nextRecords = alreadyLiked
    ? records.filter(item => getGameKey(item) !== key)
    : [toStoredGameRecord(game), ...records].filter(Boolean);
  saveStoredGameRecords(LIKED_GAMES_STORAGE_KEY, nextRecords);
  _cardCache = new Map();
  renderGames();
}

// ── Debounce helper ────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Incremental game card rendering ─────────────────────────
const GAMES_BATCH_SIZE = 40;
const GAMES_LOAD_ROOT_MARGIN = '600px 0px';
let _cardCache = new Map();
let _gamesLoadObserver = null;
let _gamesScrollTarget = null;
let _gamesScrollHandler = null;
let _gamesFillFrameId = null;
let _gamesRenderGeneration = 0;
let _gamesRenderState = { games: [], rendered: 0, sentinel: null, generation: 0 };

function getGamesCatalog() {
  return [...CLOUD_GAMES, ...(window.VOID_GAMES || [])];
}

function getGameCardHTML(game) {
  const key = getGameKey(game);
  if (!key) return gameCardHTML(game);
  if (!_cardCache.has(key)) _cardCache.set(key, gameCardHTML(game));
  return _cardCache.get(key);
}

function disconnectGamesLoadObserver() {
  if (_gamesLoadObserver) {
    _gamesLoadObserver.disconnect();
    _gamesLoadObserver = null;
  }
  if (_gamesScrollTarget && _gamesScrollHandler) {
    _gamesScrollTarget.removeEventListener('scroll', _gamesScrollHandler);
  }
  _gamesScrollTarget = null;
  _gamesScrollHandler = null;
  if (_gamesFillFrameId !== null) {
    cancelAnimationFrame(_gamesFillFrameId);
    _gamesFillFrameId = null;
  }
  if (_gamesRenderState.sentinel) {
    _gamesRenderState.sentinel.remove();
    _gamesRenderState.sentinel = null;
  }
}

function scheduleGamesViewportFill(generation = _gamesRenderState.generation) {
  if (_gamesFillFrameId !== null) return;
  _gamesFillFrameId = requestAnimationFrame(() => {
    _gamesFillFrameId = null;
    if (generation !== _gamesRenderState.generation) return;
    const gamesPage = document.getElementById('games');
    const sentinel = _gamesRenderState.sentinel;
    if (!gamesPage?.classList.contains('active') || !sentinel?.isConnected) return;
    const rootBottom = gamesPage.getBoundingClientRect().bottom;
    if (sentinel.getBoundingClientRect().top <= rootBottom + 600) {
      appendGamesBatch(generation);
    }
  });
}

function appendGamesBatch(generation = _gamesRenderState.generation) {
  if (generation !== _gamesRenderState.generation) return;
  const grid = document.getElementById('games-grid');
  if (!grid) return;
  const { games } = _gamesRenderState;
  if (_gamesRenderState.rendered >= games.length) {
    disconnectGamesLoadObserver();
    return;
  }

  const start = _gamesRenderState.rendered;
  const end = Math.min(start + GAMES_BATCH_SIZE, games.length);
  const html = games.slice(start, end).map(getGameCardHTML).join('');
  if (_gamesRenderState.sentinel && _gamesRenderState.sentinel.isConnected) {
    _gamesRenderState.sentinel.insertAdjacentHTML('beforebegin', html);
  } else {
    grid.insertAdjacentHTML('beforeend', html);
  }
  _gamesRenderState.rendered = end;

  if (end >= games.length) {
    disconnectGamesLoadObserver();
    return;
  }

  if (!_gamesRenderState.sentinel) {
    const sentinel = document.createElement('div');
    sentinel.id = 'games-load-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'grid-column: 1 / -1; height: 1px; pointer-events: none;';
    grid.appendChild(sentinel);
    _gamesRenderState.sentinel = sentinel;
  }

  if (!_gamesLoadObserver && 'IntersectionObserver' in window) {
    const gamesPage = document.getElementById('games');
    const sentinel = _gamesRenderState.sentinel;
    _gamesLoadObserver = new IntersectionObserver(entries => {
      if (generation !== _gamesRenderState.generation || sentinel !== _gamesRenderState.sentinel) return;
      if (entries.some(entry => entry.target === sentinel && entry.isIntersecting)) {
        appendGamesBatch(generation);
      }
    }, { root: gamesPage || null, rootMargin: GAMES_LOAD_ROOT_MARGIN });
    _gamesLoadObserver.observe(sentinel);
  } else if (!_gamesLoadObserver && !_gamesScrollHandler) {
    const scrollTarget = document.getElementById('games') || window;
    _gamesScrollTarget = scrollTarget;
    _gamesScrollHandler = () => {
      if (generation !== _gamesRenderState.generation) return;
      const sentinelRect = _gamesRenderState.sentinel?.getBoundingClientRect();
      if (sentinelRect && sentinelRect.top <= window.innerHeight + 600) {
        appendGamesBatch(generation);
      }
    };
    scrollTarget.addEventListener('scroll', _gamesScrollHandler, { passive: true });
  }
  scheduleGamesViewportFill(generation);
}

function renderGamesGrid(games) {
  const grid = document.getElementById('games-grid');
  if (!grid) return;
  disconnectGamesLoadObserver();
  grid.innerHTML = '';
  const generation = ++_gamesRenderGeneration;
  _gamesRenderState = { games, rendered: 0, sentinel: null, generation };
  appendGamesBatch(generation);
}

async function loadMoreGames(attempt = 0) {
  if (attempt === 0) {
    if (_gamesCatalogLoaded) return true;
    if (_gamesLoadPromise) return _gamesLoadPromise;
    _gamesLoadPromise = loadMoreGames(1).finally(() => {
      _gamesLoadPromise = null;
    });
    return _gamesLoadPromise;
  }
  try {
    const response = await fetch('/api/games?v=4');
    if (!response.ok) throw new Error(`Game catalog returned ${response.status}`);
    const remoteGames = await response.json();
    const remoteEmbeds = new Set(remoteGames.map(game => game.embed));
    const localOnly = (window.VOID_GAMES || []).filter(game => game.embed && !remoteEmbeds.has(game.embed));
    window.VOID_GAMES = [...remoteGames, ...localOnly];
    _cardCache = new Map();
    _gamesCatalogLoaded = true;
    renderGames();
    return true;
  } catch (_) {
    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 350 * attempt));
      return loadMoreGames(attempt + 1);
    }
    return false;
  }
}

// Build a poster-style game card (image only; name slides up on hover)
function escapeGameHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function gameCardHTML(g) {
  if (g.cloud) return cloudGameCardHTML(g);

  const c = CAT_COLORS[g.cat] || '#7c6fff';
  const cardClass = `game-card${g.emulatorGroupStart ? ' emulator-group-start' : ''}`;
  const safeName = escapeGameHTML(g.name);
  const gameKey = String(g.slug || g.embed || '');
  const safeGameKey = escapeGameHTML(gameKey);
  const safeEmbed = escapeGameHTML(g.embed);

  const gameSlug = (g.embed.match(/en_US\/([^/]+)/) || [])[1];
  const imgSrc = gameSlug ? `/api/game-image?slug=${encodeURIComponent(gameSlug)}` : g.image;
  const onclick = 'openGameEmbed(this.dataset.gameEmbed, this.dataset.gameName, this.dataset.gameKey)';
  const liked = isGameLiked(g);

  const badges = [
    g.new ? '<span class="game-card-badge">NEW</span>' : '',
    g.source === 'stash' ? '<span class="game-card-badge game-card-emulator-badge">Emulator</span>' : '',
  ].filter(Boolean).join('');
  const badge = badges ? `<div class="game-card-badges">${badges}</div>` : '';
  const likeButton = `<button class="game-like-btn${liked ? ' liked' : ''}" type="button"
    data-game-key="${safeGameKey}" aria-label="${liked ? 'Unlike' : 'Like'} ${safeName}"
    aria-pressed="${liked}" title="${liked ? 'Remove from liked games' : 'Like this game'}"
    onclick="toggleGameLike(event, this)"><span aria-hidden="true">${liked ? '♥' : '♡'}</span></button>`;
  const fallback = `<div class="game-card-fallback" style="--game-accent:${c}"><span>${safeName}</span></div>`;
  const poster = imgSrc
    ? `${fallback}<img src="${imgSrc}" alt="${safeName}" loading="lazy" decoding="async" fetchpriority="low" onerror="this.remove()">`
    : fallback;

  return `<div class="${cardClass}" data-game-embed="${safeEmbed}" data-game-name="${safeName}" data-game-key="${safeGameKey}" onclick="${onclick}" title="${safeName}">
    <div class="game-card-poster" style="background:${c}14;">
      ${poster}
      ${badge}
       ${likeButton}
    </div>
    <div class="game-card-info">
      <div class="game-card-name">${safeName}</div>
      <div class="game-card-cat">${g.cat}</div>
    </div>
  </div>`;
}

function cloudGameCardHTML(g) {
  const safeName = escapeGameHTML(g.name);
  const safeGameKey = escapeGameHTML(getGameKey(g));
  const safeEmbed = escapeGameHTML(g.embed);
  const onclick = 'openGameEmbed(this.dataset.gameEmbed, this.dataset.gameName, this.dataset.gameKey)';
  const safeImage = escapeGameHTML(g.image);
  const posterContent = safeImage
    ? `<img class="cloud-game-image" src="${safeImage}" alt="${safeName}" loading="lazy" decoding="async">`
    : `<svg class="cloud-game-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M19 49h29a12 12 0 0 0 1.82-23.86A16.5 16.5 0 0 0 18.3 21.5 13.75 13.75 0 0 0 19 49Z"></path>
      </svg>
      <div class="cloud-game-wordmark">CLOUD</div>`;

  return `<div class="game-card cloud-game-card" data-game-embed="${safeEmbed}" data-game-name="${safeName}" data-game-key="${safeGameKey}" onclick="${onclick}" title="Open ${safeName}">
    <div class="game-card-poster cloud-game-poster${safeImage ? ' has-image' : ''}">
      ${posterContent}
    </div>
    <div class="game-card-info">
      <div class="game-card-name">${safeName}</div>
      <div class="game-card-cat">Cloud</div>
    </div>
  </div>`;
}

// ── Games page ─────────────────────────────────────────────
let _gamesCat = 'all';
let _gamesSearch = '';

function gameMatchesFilters(g, query) {
  return (_gamesCat === 'all' || (_gamesCat === 'imported'
    ? ['hbmc', 'semag'].includes(g.source)
    : g.cat === _gamesCat))
    && (!query || g.name.toLowerCase().includes(query));
}

function renderPersonalGames(sectionId, gridId, countId, storageKey, games, query, showPersonal) {
  const section = document.getElementById(sectionId);
  const grid = document.getElementById(gridId);
  const count = document.getElementById(countId);
  if (!section || !grid) return;
  const gamesByKey = new Map(games.map(game => [getGameKey(game), game]));
  const savedGames = getStoredGameRecords(storageKey)
    .map(record => gamesByKey.get(getGameKey(record)) || record)
    .filter(game => gameMatchesFilters(game, query));
  section.hidden = !showPersonal || savedGames.length === 0;
  if (count) count.textContent = `${savedGames.length} ${savedGames.length === 1 ? 'game' : 'games'}`;
  grid.innerHTML = savedGames.map(getGameCardHTML).join('');
}

function renderGames() {
  const grid = document.getElementById('games-grid');
  const countEl = document.getElementById('games-count');
  if (!grid) return;
  const q = _gamesSearch.toLowerCase().trim();
  const games = getGamesCatalog();
  const filtered = games.filter(game => gameMatchesFilters(game, q));
  if (countEl) countEl.textContent = `${filtered.length} games`;
  const showPersonal = !q;
  renderPersonalGames('recently-played-section', 'recently-played-grid', 'recently-played-count', RECENT_GAMES_STORAGE_KEY, games, q, showPersonal);
  renderPersonalGames('liked-games-section', 'liked-games-grid', 'liked-games-count', LIKED_GAMES_STORAGE_KEY, games, q, showPersonal);
  const personalSections = document.querySelectorAll('.games-shelf');
  const hasVisiblePersonalSection = [...personalSections].some(section => !section.hidden);
  grid.classList.toggle('games-grid-separated', hasVisiblePersonalSection);
  renderGamesGrid(filtered);
}

const $catContainer = document.getElementById('games-cats');
if ($catContainer) {
  $catContainer.addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    $catContainer.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _gamesCat = btn.dataset.cat;
    renderGames();
  });
}

const $gamesSearch = document.getElementById('games-search');
if ($gamesSearch) {
  $gamesSearch.addEventListener('input', debounce(() => {
    _gamesSearch = $gamesSearch.value;
    renderGames();
  }, 80));
}

// Initial render
renderGames();
if (location.hash === '#games') openGamesPage();
if (location.hash === '#movies') openMoviesPage();

// ── Friends ────────────────────────────────────────────────
const friendsState = {
  user: null,
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  searchResults: [],
  activeUsername: null,
  activeFriend: null,
  csrfToken: null,
  notificationUsername: null,
  notificationReady: false,
  notificationHasHistory: false,
  seenMessageIds: new Set(),
  seenRequestIds: new Set(),
  unreadMessageIds: new Set(),
  unreadRequestIds: new Set(),
  notificationMessages: new Map(),
  notificationRequests: new Map(),
};
let friendsCurrentActivity = null;
let friendsActivitySequence = 0;
const friendsNotificationStoragePrefix = 'voidFriendsNotifications:';

function readFriendsNotificationStorage(username) {
  try {
    const raw = localStorage.getItem(
      `${friendsNotificationStoragePrefix}${username.toLowerCase()}`,
    );
    const stored = JSON.parse(raw || '{}');
    return {
      hasHistory: Boolean(raw),
      seenMessages: new Set(Array.isArray(stored.seenMessages) ? stored.seenMessages : []),
      seenRequests: new Set(Array.isArray(stored.seenRequests) ? stored.seenRequests : []),
      unreadMessages: new Set(Array.isArray(stored.unreadMessages) ? stored.unreadMessages : []),
      unreadRequests: new Set(Array.isArray(stored.unreadRequests) ? stored.unreadRequests : []),
    };
  } catch {
    return {
      hasHistory: false,
      seenMessages: new Set(),
      seenRequests: new Set(),
      unreadMessages: new Set(),
      unreadRequests: new Set(),
    };
  }
}

function saveFriendsNotificationStorage() {
  if (!friendsState.notificationUsername) return;
  try {
    localStorage.setItem(
      `${friendsNotificationStoragePrefix}${friendsState.notificationUsername.toLowerCase()}`,
      JSON.stringify({
        seenMessages: [...friendsState.seenMessageIds].slice(-300),
        seenRequests: [...friendsState.seenRequestIds].slice(-100),
        unreadMessages: [...friendsState.unreadMessageIds].slice(-100),
        unreadRequests: [...friendsState.unreadRequestIds].slice(-100),
      }),
    );
  } catch {
    // Notifications still work for this visit if storage is unavailable.
  }
}

function updateFriendsUnreadBadge() {
  const count = friendsState.unreadMessageIds.size + friendsState.unreadRequestIds.size;
  ['friends-unread-badge-sidebar', 'friends-unread-badge-home'].forEach(id => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('visible', count > 0);
  });
  document.title = count > 0 ? `(${count > 99 ? '99+' : count}) Void V2` : 'Void V2';
}

function showFriendsSystemNotification(text, chatUsername = null) {
  announcement(text, { showActions: true, chatUsername });
  if (window.Notification && Notification.permission === 'granted') {
    try { new Notification('Void V2 Friends', { body: text, tag: 'void-friends' }); } catch {}
  }
}

function processFriendsNotifications(data) {
  if (!friendsState.user) {
    friendsState.notificationUsername = null;
    friendsState.notificationReady = false;
    friendsState.notificationHasHistory = false;
    friendsState.seenMessageIds.clear();
    friendsState.seenRequestIds.clear();
    friendsState.unreadMessageIds.clear();
    friendsState.unreadRequestIds.clear();
    updateFriendsUnreadBadge();
    return;
  }

  const username = friendsState.user.username.toLowerCase();
  if (friendsState.notificationUsername !== username) {
    const stored = readFriendsNotificationStorage(username);
    friendsState.notificationUsername = username;
    friendsState.notificationReady = stored.hasHistory;
    friendsState.notificationHasHistory = stored.hasHistory;
    friendsState.seenMessageIds = stored.seenMessages;
    friendsState.seenRequestIds = stored.seenRequests;
    friendsState.unreadMessageIds = stored.unreadMessages;
    friendsState.unreadRequestIds = stored.unreadRequests;
  }

  const messages = data.notifications?.messages || [];
  const requests = data.notifications?.requests || [];
  friendsState.notificationMessages = new Map(
    messages.map(message => [message.id, message]),
  );
  friendsState.notificationRequests = new Map(
    requests.map(request => [request.id, request]),
  );
  const currentMessageIds = new Set(messages.map(message => message.id));
  const currentRequestIds = new Set(requests.map(request => request.id));
  friendsState.unreadMessageIds = new Set(
    [...friendsState.unreadMessageIds].filter(id => currentMessageIds.has(id)),
  );
  friendsState.unreadRequestIds = new Set(
    [...friendsState.unreadRequestIds].filter(id => currentRequestIds.has(id)),
  );
  const newEvents = [];

  if (!friendsState.notificationReady) {
    messages.forEach(message => friendsState.seenMessageIds.add(message.id));
    requests.forEach(request => friendsState.seenRequestIds.add(request.id));
    friendsState.notificationReady = true;
    friendsState.notificationHasHistory = true;
  } else {
    messages.forEach(message => {
      if (friendsState.seenMessageIds.has(message.id)) return;
      friendsState.seenMessageIds.add(message.id);
      friendsState.unreadMessageIds.add(message.id);
      newEvents.push({
        createdAt: message.createdAt,
        text: `${message.from}: ${String(message.body).slice(0, 120)}`,
        chatUsername: message.from,
      });
    });
    requests.forEach(request => {
      if (friendsState.seenRequestIds.has(request.id)) return;
      friendsState.seenRequestIds.add(request.id);
      friendsState.unreadRequestIds.add(request.id);
      newEvents.push({
        createdAt: request.createdAt,
        text: `${request.username} sent you a friend request.`,
        chatUsername: null,
      });
    });
  }

  saveFriendsNotificationStorage();
  updateFriendsUnreadBadge();
  if (!newEvents.length) return;
  newEvents.sort((a, b) => b.createdAt - a.createdAt);
  if (newEvents.length === 1) {
    showFriendsSystemNotification(newEvents[0].text, newEvents[0].chatUsername);
  } else {
    showFriendsSystemNotification(`${newEvents.length} new Friends notifications.`);
  }
}

async function friendsApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'X-Void-Friends-Client': '1',
      ...(options.method && options.method !== 'GET' && friendsState.csrfToken
        ? { 'X-Void-Friends-Token': friendsState.csrfToken }
        : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Friends could not be loaded.');
  return payload;
}

function friendStatusText(user) {
  if (user?.activity?.name) return `Playing ${user.activity.name}`;
  if (user?.relationship === 'outgoing') return 'Friend request sent';
  if (user?.relationship === 'incoming') return 'Sent you a friend request';
  if (user?.relationship === 'none') return 'Not friends yet';
  return user?.online ? 'Online' : 'Offline';
}

function makeFriendAvatar(user) {
  const avatar = document.createElement('div');
  avatar.className = 'friend-avatar';
  if (user?.avatar) {
    const image = document.createElement('img');
    image.src = user.avatar; image.alt = `${user.username || 'Friend'} avatar`;
    avatar.appendChild(image);
  } else avatar.textContent = String(user?.username || '?').charAt(0).toUpperCase();
  const presence = document.createElement('span');
  presence.className = `friend-presence${user?.online ? ' online' : ''}`;
  avatar.appendChild(presence);
  return avatar;
}

function makeFriendRow(user, onSelect = null) {
  const row = document.createElement(onSelect ? 'button' : 'div');
  row.className = 'friend-row';
  if (onSelect) {
    row.type = 'button';
    row.addEventListener('click', onSelect);
  }
  row.appendChild(makeFriendAvatar(user));
  const main = document.createElement('div');
  main.className = 'friend-row-main';
  const name = document.createElement('div');
  name.className = 'friend-name';
  name.textContent = user.username;
  const status = document.createElement('div');
  status.className = `friend-status${user.activity?.name ? ' playing' : ''}`;
  status.textContent = friendStatusText(user);
  main.append(name, status);
  row.appendChild(main);
  return row;
}

function showFriendsEmpty(container, message) {
  const empty = document.createElement('div');
  empty.className = 'friends-empty';
  empty.textContent = message;
  container.replaceChildren(empty);
}

function renderFriendRequests() {
  const section = document.getElementById('friend-requests-section');
  const list = document.getElementById('friend-requests-list');
  if (!section || !list) return;
  section.classList.toggle('friends-hidden', !friendsState.incomingRequests.length);
  list.replaceChildren();
  friendsState.incomingRequests.forEach(user => {
    const row = makeFriendRow(user);
    const actions = document.createElement('div');
    actions.className = 'friend-row-actions';
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'friend-mini-button accept';
    accept.textContent = 'Accept';
    accept.addEventListener('click', () => respondToFriendRequest(user.username, 'accept'));
    const decline = document.createElement('button');
    decline.type = 'button';
    decline.className = 'friend-mini-button';
    decline.textContent = '×';
    decline.title = 'Decline';
    decline.addEventListener('click', () => respondToFriendRequest(user.username, 'decline'));
    actions.append(accept, decline);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

function renderFriendsList() {
  const list = document.getElementById('friends-list');
  if (!list) return;
  list.replaceChildren();
  if (!friendsState.user) {
    showFriendsEmpty(list, 'Choose a username to start adding friends.');
    return;
  }
  if (!friendsState.friends.length) {
    showFriendsEmpty(list, 'No friends yet. Search for a username above.');
    return;
  }
  friendsState.friends.forEach(user => {
    const row = makeFriendRow(user, () => openFriendConversation(user.username));
    row.classList.toggle('active', user.username === friendsState.activeUsername);
    list.appendChild(row);
  });
}

function searchActionFor(user) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'friend-mini-button accept';
  if (user.relationship === 'friends') {
    button.textContent = 'Chat';
    button.addEventListener('click', () => openFriendConversation(user.username));
  } else if (user.relationship === 'outgoing') {
    button.textContent = 'Sent';
    button.disabled = true;
  } else if (user.relationship === 'incoming') {
    button.textContent = 'Accept';
    button.addEventListener('click', () => respondToFriendRequest(user.username, 'accept'));
  } else {
    button.textContent = 'Add';
    button.addEventListener('click', () => sendFriendRequest(user.username));
  }
  return button;
}

function renderSearchResults() {
  const section = document.getElementById('friends-results-section');
  const list = document.getElementById('friends-results');
  if (!section || !list) return;
  const hasSearch = document.getElementById('friends-search-input')?.value.trim();
  section.classList.toggle('friends-hidden', !hasSearch);
  list.replaceChildren();
  if (hasSearch && !friendsState.searchResults.length) {
    showFriendsEmpty(list, 'No matching usernames found.');
    return;
  }
  friendsState.searchResults.forEach(user => {
    const row = makeFriendRow(user);
    const actions = document.createElement('div');
    actions.className = 'friend-row-actions';
    actions.appendChild(searchActionFor(user));
    row.appendChild(actions);
    list.appendChild(row);
  });
}

function renderConversationHeader(friend = friendsState.activeFriend) {
  if (!friend) return;
  const avatar = document.getElementById('conversation-avatar');
  const name = document.getElementById('conversation-name');
  const status = document.getElementById('conversation-status');
  if (avatar) {
    avatar.replaceChildren();
    if (friend.avatar) { const image = document.createElement('img'); image.src = friend.avatar; image.alt = `${friend.username} avatar`; avatar.appendChild(image); }
    else avatar.textContent = String(friend.username).charAt(0).toUpperCase();
    const dot = document.createElement('span');
    dot.className = `friend-presence${friend.online ? ' online' : ''}`;
    avatar.appendChild(dot);
  }
  if (name) name.textContent = friend.username;
  if (status) {
    status.textContent = friendStatusText(friend);
    status.classList.toggle('playing', Boolean(friend.activity?.name));
  }
}

function renderFriendsState() {
  const onboarding = document.getElementById('friends-onboarding');
  const welcome = document.getElementById('friends-welcome');
  const conversation = document.getElementById('friends-conversation');
  const main = document.getElementById('friends-main');
  const shell = document.getElementById('friends-shell');
  const searchInput = document.getElementById('friends-search-input');
  const userLabel = document.getElementById('friends-user-label');
  const needsUsername = !friendsState.user;

  onboarding?.classList.toggle('friends-hidden', !needsUsername);
  main?.classList.toggle('show-onboarding', needsUsername);
  document.querySelector('.friends-profile')?.classList.toggle('friends-hidden', needsUsername);
  searchInput && (searchInput.disabled = needsUsername);
  if (userLabel) {
    userLabel.textContent = friendsState.user
      ? `${friendsState.user.username} · Online`
      : 'Connect with people on Void V2';
  }
  const ownAvatar = document.getElementById('friends-own-avatar');
  if (ownAvatar) {
    ownAvatar.replaceChildren();
    if (friendsState.user?.avatar) {
      const image = document.createElement('img');
      image.src = friendsState.user.avatar; image.alt = 'Your avatar'; ownAvatar.appendChild(image);
    } else ownAvatar.textContent = String(friendsState.user?.username || '?').charAt(0).toUpperCase();
  }
  const removeAvatar = document.getElementById('friends-avatar-remove');
  if (removeAvatar) removeAvatar.disabled = !friendsState.user?.avatar;

  if (needsUsername) {
    friendsState.activeUsername = null;
    welcome?.classList.add('friends-hidden');
    conversation?.classList.add('friends-hidden');
    shell?.classList.remove('chat-open');
  } else if (friendsState.activeUsername) {
    onboarding?.classList.add('friends-hidden');
    welcome?.classList.add('friends-hidden');
    conversation?.classList.remove('friends-hidden');
    shell?.classList.add('chat-open');
    renderConversationHeader();
  } else {
    onboarding?.classList.add('friends-hidden');
    welcome?.classList.remove('friends-hidden');
    conversation?.classList.add('friends-hidden');
    shell?.classList.remove('chat-open');
  }
  renderFriendRequests();
  renderFriendsList();
  renderSearchResults();
}

async function loadFriendsState() {
  try {
    const data = await friendsApi('/api/friends/me');
    friendsState.user = data.user;
    friendsState.friends = data.friends || [];
    friendsState.incomingRequests = data.incomingRequests || [];
    friendsState.outgoingRequests = data.outgoingRequests || [];
    friendsState.csrfToken = data.csrfToken || friendsState.csrfToken;
    processFriendsNotifications(data);
    if (
      friendsState.activeUsername
      && !friendsState.friends.some(friend => friend.username === friendsState.activeUsername)
    ) {
      friendsState.activeUsername = null;
      friendsState.activeFriend = null;
    } else if (friendsState.activeUsername) {
      friendsState.activeFriend = friendsState.friends.find(
        friend => friend.username === friendsState.activeUsername,
      ) || friendsState.activeFriend;
    }
    renderFriendsState();
  } catch (error) {
    if (document.getElementById('friends')?.classList.contains('active')) {
      announcement(error.message);
    }
  }
}

function openFriendsPage() {
  openPage('friends');
  selectedIcon('icon-friends');
  loadFriendsState();
}

async function reportFriendsActivity(gameName) {
  friendsCurrentActivity = gameName ? String(gameName).slice(0, 80) : null;
  if (!friendsState.user) return;
  const sequence = ++friendsActivitySequence;
  try {
    await friendsApi('/api/friends/presence', {
      method: 'POST',
      body: JSON.stringify({ activity: friendsCurrentActivity }),
    });
    if (sequence !== friendsActivitySequence) {
      reportFriendsActivity(friendsCurrentActivity);
    }
  } catch {
    // The next heartbeat retries presence without interrupting browsing.
  }
}

async function sendFriendRequest(username) {
  try {
    await friendsApi('/api/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    announcement(`Friend request sent to ${username}.`);
    await Promise.all([loadFriendsState(), runFriendsSearch()]);
  } catch (error) {
    announcement(error.message);
  }
}

async function respondToFriendRequest(username, action) {
  try {
    await friendsApi('/api/friends/requests/respond', {
      method: 'POST',
      body: JSON.stringify({ username, action }),
    });
    for (const [id, request] of friendsState.notificationRequests) {
      if (request.username.toLowerCase() === username.toLowerCase()) {
        friendsState.unreadRequestIds.delete(id);
      }
    }
    saveFriendsNotificationStorage();
    updateFriendsUnreadBadge();
    await Promise.all([loadFriendsState(), runFriendsSearch()]);
  } catch (error) {
    announcement(error.message);
  }
}

async function runFriendsSearch() {
  const input = document.getElementById('friends-search-input');
  if (!friendsState.user || !input) return;
  const query = input.value.trim();
  if (!query) {
    friendsState.searchResults = [];
    renderSearchResults();
    return;
  }
  try {
    const data = await friendsApi(`/api/friends/search?q=${encodeURIComponent(query)}`);
    friendsState.searchResults = data.results || [];
    renderSearchResults();
  } catch (error) {
    announcement(error.message);
  }
}

function renderMessages(messages) {
  const container = document.getElementById('conversation-messages');
  if (!container) return;
  const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  container.replaceChildren();
  if (!messages.length) {
    showFriendsEmpty(container, 'No messages yet. Say hello.');
    return;
  }
  messages.forEach(message => {
    const row = document.createElement('div');
    row.className = `message-row${message.mine ? ' mine' : ''}`;
    if (!message.mine) {
      const avatar = makeFriendAvatar({
        ...friendsState.activeFriend,
        avatar: message.avatar || friendsState.activeFriend?.avatar || null,
      });
      avatar.className = 'friend-avatar message-avatar';
      avatar.querySelector('.friend-presence')?.remove();
      row.appendChild(avatar);
    }
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const body = document.createElement('div');
    body.textContent = message.body;
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date(message.createdAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    bubble.append(body, time);
    row.appendChild(bubble);
    container.appendChild(row);
  });
  if (nearBottom || !container.dataset.loaded) {
    container.scrollTop = container.scrollHeight;
  }
  container.dataset.loaded = 'true';
}

async function loadFriendConversation(silent = false) {
  if (!friendsState.activeUsername) return;
  try {
    const data = await friendsApi(
      `/api/friends/messages?with=${encodeURIComponent(friendsState.activeUsername)}`,
    );
    friendsState.activeFriend = data.friend;
    renderConversationHeader(data.friend);
    renderMessages(data.messages || []);
  } catch (error) {
    if (!silent) announcement(error.message);
  }
}

function openFriendConversation(username) {
  friendsState.activeUsername = username;
  friendsState.activeFriend = friendsState.friends.find(friend => friend.username === username) || null;
  for (const [id, message] of friendsState.notificationMessages) {
    if (message.from.toLowerCase() === username.toLowerCase()) {
      friendsState.unreadMessageIds.delete(id);
    }
  }
  saveFriendsNotificationStorage();
  updateFriendsUnreadBadge();
  const messages = document.getElementById('conversation-messages');
  if (messages) {
    messages.replaceChildren();
    delete messages.dataset.loaded;
  }
  renderFriendsState();
  loadFriendConversation();
}

function closeFriendConversation() {
  friendsState.activeUsername = null;
  friendsState.activeFriend = null;
  renderFriendsState();
}

document.getElementById('friends-username-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.getElementById('friends-username-input');
  const error = document.getElementById('friends-username-error');
  if (error) error.textContent = '';
  try {
    await friendsApi('/api/friends/profile', {
      method: 'POST',
      body: JSON.stringify({ username: input?.value || '' }),
    });
    if (input) input.value = '';
    await loadFriendsState();
    reportFriendsActivity(friendsCurrentActivity);
  } catch (requestError) {
    if (error) error.textContent = requestError.message;
  }
});

document.getElementById('friends-search-form')?.addEventListener('submit', event => {
  event.preventDefault();
  runFriendsSearch();
});

document.getElementById('friends-search-input')?.addEventListener('input', debounce(() => {
  runFriendsSearch();
}, 220));

document.getElementById('conversation-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.getElementById('conversation-input');
  const body = input?.value.trim();
  if (!body || !friendsState.activeUsername) return;
  try {
    await friendsApi('/api/friends/messages', {
      method: 'POST',
      body: JSON.stringify({ with: friendsState.activeUsername, body }),
    });
    input.value = '';
    await loadFriendConversation(true);
  } catch (error) {
    announcement(error.message);
  }
});

setInterval(() => {
  if (friendsState.user) reportFriendsActivity(friendsCurrentActivity);
}, 20_000);

setInterval(() => {
  if (friendsState.user || document.getElementById('friends')?.classList.contains('active')) {
    loadFriendsState();
    if (document.getElementById('friends')?.classList.contains('active') && friendsState.activeUsername) {
      loadFriendConversation(true);
    }
  }
}, 4_000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && friendsState.user) reportFriendsActivity(friendsCurrentActivity);
});

loadFriendsState();
if (location.hash === '#friends') openFriendsPage();

// ── Void Friends avatar + calls ─────────────────────────────
(function initFriendsCalls() {
  const $ = id => document.getElementById(id);
  const blankCall = () => ({
    id: null, with: null, mode: null, role: null, pc: null, stream: null,
    muted: false, started: 0, incoming: null, minimized: false,
    offerSent: false, makingOffer: false, pendingIce: [], pendingLocalIce: [],
  });
  let call = blankCall();
  let callCursor = 0;
  let callPollBusy = false;
  const peerConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  };
  const sameUsername = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  const friendByName = name => friendsState.friends.find(friend => sameUsername(friend.username, name))
    || (sameUsername(friendsState.activeFriend?.username, name) ? friendsState.activeFriend : null)
    || { username: name };

  function drawAvatar(element, user) {
    if (!element) return;
    element.replaceChildren();
    if (user?.avatar) {
      const image = document.createElement('img');
      image.src = user.avatar;
      image.alt = `${user.username || 'Friend'} avatar`;
      element.appendChild(image);
    } else {
      element.textContent = String(user?.username || '?').charAt(0).toUpperCase();
    }
  }

  function renderCallAvatar(username) {
    const stage = $('call-avatar-stage');
    if (!stage) return;
    const avatar = document.createElement('div');
    avatar.className = 'friend-avatar';
    drawAvatar(avatar, friendByName(username));
    stage.replaceChildren(avatar);
  }

  function callStatus(text) {
    if ($('call-status')) $('call-status').textContent = text;
  }

  function syncSurface() {
    const inFriends = document.getElementById('friends')?.classList.contains('active');
    const active = Boolean(call.id);
    $('active-call')?.classList.toggle('visible', active && inFriends && !call.minimized);
    $('call-pill')?.classList.toggle('visible', active && (!inFriends || call.minimized));
  }
  window.VoidFriendsCalls = { syncSurface };

  function showIncoming(item) {
    const id = item.callId || item.id;
    if (call.incoming?.callId === id) return;
    callCursor = 0;
    call.incoming = { ...item, callId: id };
    const user = friendByName(item.from || item.caller || item.username || item.with);
    drawAvatar($('incoming-call-avatar'), user);
    $('incoming-call-title').textContent = `${user.username || 'Friend'} is calling`;
    $('incoming-call-sub').textContent = item.mode === 'video' ? 'Incoming video call' : 'Incoming audio call';
    $('incoming-call').classList.add('visible');
  }

  async function signal(type, payload) {
    if (!call.id) return;
    await friendsApi('/api/friends/call', {
      method: 'POST',
      body: JSON.stringify({ action: 'signal', callId: call.id, type, payload }),
    });
  }

  async function drainPendingIce() {
    if (!call.pc?.remoteDescription) return;
    const candidates = call.pendingIce.splice(0);
    for (const candidate of candidates) {
      await call.pc.addIceCandidate(candidate).catch(() => {});
    }
  }

  function makePeer() {
    if (call.pc) return call.pc;
    const peer = new RTCPeerConnection(peerConfig);
    call.pc = peer;
    peer.onicecandidate = event => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (call.makingOffer) call.pendingLocalIce.push(candidate);
      else signal('ice', candidate).catch(() => {});
    };
    peer.ontrack = event => {
      const remoteVideo = $('remote-video');
      if (remoteVideo && event.streams[0]) remoteVideo.srcObject = event.streams[0];
      if (event.track.kind === 'video') {
        $('call-avatar-stage')?.replaceChildren();
        remoteVideo?.classList.add('has-video');
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') callStatus('Connected');
      if (peer.connectionState === 'failed') finishCall(false, 'Call disconnected.');
    };
    call.stream?.getTracks().forEach(track => peer.addTrack(track, call.stream));
    return peer;
  }

  async function beginMedia(mode) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera and microphone are not available in this browser.');
    }
    call.stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === 'video',
    });
    const localVideo = $('local-video');
    if (localVideo) {
      localVideo.srcObject = call.stream;
      localVideo.style.display = mode === 'video' ? 'block' : 'none';
    }
    $('toggle-camera').textContent = mode === 'video' ? 'Camera off' : 'Camera on';
  }

  function showActive(withName, status = 'Connecting') {
    call.with = withName;
    call.started ||= Date.now();
    call.minimized = false;
    $('call-name').textContent = withName;
    $('call-pill-text').textContent = `In call with ${withName}`;
    callStatus(status);
    renderCallAvatar(withName);
    syncSurface();
  }

  async function createAndSendOffer(force = false) {
    if (!call.id || call.makingOffer || (call.offerSent && !force)) return;
    call.makingOffer = true;
    try {
      const peer = makePeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await signal('offer', peer.localDescription);
      call.offerSent = true;
    } finally {
      call.makingOffer = false;
    }
    const candidates = call.pendingLocalIce.splice(0);
    for (const candidate of candidates) {
      await signal('ice', candidate).catch(() => {});
    }
  }

  async function startCall(mode) {
    if (!friendsState.activeUsername || call.id || call.incoming) return;
    try {
      call.mode = mode;
      call.role = 'caller';
      call.with = friendsState.activeUsername;
      await beginMedia(mode);
      const data = await friendsApi('/api/friends/call', {
        method: 'POST',
        body: JSON.stringify({ action: 'start', with: call.with, mode }),
      });
      call.id = data.call?.id;
      callCursor = 0;
      showActive(call.with, 'Ringing');
      makePeer();
    } catch (error) {
      finishCall(false);
      announcement(error.message || 'Unable to start call.');
    }
  }

  async function acceptCall(mode) {
    const item = call.incoming;
    if (!item) return;
    try {
      call.id = item.callId;
      call.with = item.from || item.caller || item.username || item.with;
      call.mode = mode;
      call.role = 'callee';
      callCursor = 0;
      await beginMedia(mode);
      await friendsApi('/api/friends/call', {
        method: 'POST',
        body: JSON.stringify({ action: 'accept', callId: call.id }),
      });
      call.incoming = null;
      $('incoming-call').classList.remove('visible');
      showActive(call.with);
      makePeer();
    } catch (error) {
      const callId = call.id;
      finishCall(false);
      if (callId) {
        friendsApi('/api/friends/call', {
          method: 'POST',
          body: JSON.stringify({ action: 'decline', callId }),
        }).catch(() => {});
      }
      announcement(error.message || 'Unable to join call.');
    }
  }

  async function declineCall() {
    const id = call.incoming?.callId;
    $('incoming-call').classList.remove('visible');
    call.incoming = null;
    callCursor = 0;
    if (id) {
      await friendsApi('/api/friends/call', {
        method: 'POST',
        body: JSON.stringify({ action: 'decline', callId: id }),
      }).catch(() => {});
    }
  }

  function finishCall(notify = true, message = '') {
    const id = call.id;
    if (notify && id) {
      friendsApi('/api/friends/call', {
        method: 'POST',
        body: JSON.stringify({ action: 'end', callId: id }),
      }).catch(() => {});
    }
    call.stream?.getTracks().forEach(track => track.stop());
    call.pc?.close();
    call = blankCall();
    callCursor = 0;
    if ($('remote-video')) $('remote-video').srcObject = null;
    if ($('local-video')) $('local-video').srcObject = null;
    $('active-call')?.classList.remove('visible');
    $('call-pill')?.classList.remove('visible');
    $('incoming-call')?.classList.remove('visible');
    if (message) announcement(message);
  }

  async function handleCallEvent(item) {
    if (item.type === 'ringing') {
      if (!call.id && !call.incoming) showIncoming({ ...item, callId: item.callId });
      return;
    }
    if (!call.id) return;
    if (item.type === 'accept' && call.role === 'caller') {
      callStatus('Connecting');
      await createAndSendOffer();
      return;
    }
    if (item.type === 'offer') {
      const peer = makePeer();
      await peer.setRemoteDescription(item.payload);
      await drainPendingIce();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await signal('answer', peer.localDescription);
      return;
    }
    if (item.type === 'answer') {
      await call.pc?.setRemoteDescription(item.payload);
      await drainPendingIce();
      return;
    }
    if (item.type === 'ice') {
      if (call.pc?.remoteDescription) await call.pc.addIceCandidate(item.payload).catch(() => {});
      else call.pendingIce.push(item.payload);
      return;
    }
    if (['end', 'ended', 'decline', 'declined', 'timeout'].includes(item.type)) {
      finishCall(false, item.type.startsWith('declin') ? 'Call declined.' : 'Call ended.');
    }
  }

  async function pollCalls() {
    if (callPollBusy || !friendsState.user) return;
    callPollBusy = true;
    try {
      const data = await friendsApi(`/api/friends/call?since=${callCursor}`);
      const serverCall = data.call;
      if (call.incoming?.callId === serverCall?.id
        && ['declined', 'ended', 'timeout'].includes(serverCall.status)) {
        finishCall(false, serverCall.status === 'timeout' ? 'The call timed out.' : 'Call ended.');
        return;
      }
      if (serverCall && !call.id && serverCall.status === 'ringing'
        && sameUsername(serverCall.callee, friendsState.user.username)) {
        showIncoming({ ...serverCall, callId: serverCall.id, from: serverCall.caller });
      }
      if (call.id && serverCall?.id === call.id) {
        if (['declined', 'ended', 'timeout'].includes(serverCall.status)) {
          finishCall(false, serverCall.status === 'declined' ? 'Call declined.' : 'Call ended.');
          return;
        }
        if (serverCall.status === 'accepted' && call.role === 'caller' && !call.offerSent) {
          callStatus('Connecting');
          await createAndSendOffer();
        }
      }
      for (const item of data.events || []) {
        callCursor = Math.max(callCursor, Number(item.seq) || 0);
        await handleCallEvent({ ...item, callId: serverCall?.id });
      }
    } catch {
      // Presence polling retries automatically; transient network failures must not end calls.
    } finally {
      callPollBusy = false;
    }
  }

  async function toggleCamera(button) {
    let track = call.stream?.getVideoTracks()[0];
    if (!track) {
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        track = cameraStream.getVideoTracks()[0];
        call.stream.addTrack(track);
        makePeer().addTrack(track, call.stream);
        $('local-video').srcObject = call.stream;
        $('local-video').style.display = 'block';
        button.textContent = 'Camera off';
        await signal('media', { video: true });
        await createAndSendOffer(true);
      } catch (error) {
        announcement(error.message || 'Camera could not be enabled.');
      }
      return;
    }
    track.enabled = !track.enabled;
    $('local-video').style.display = track.enabled ? 'block' : 'none';
    button.textContent = track.enabled ? 'Camera off' : 'Camera on';
    signal('media', { video: track.enabled }).catch(() => {});
  }

  $('friends-avatar-upload')?.addEventListener('click', () => $('friends-avatar-input')?.click());
  $('friends-avatar-input')?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
      announcement('Choose an image smaller than 8 MB.');
      event.target.value = '';
      return;
    }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(image.width, image.height);
      canvas.width = canvas.height = 256;
      canvas.getContext('2d').drawImage(
        image,
        (image.width - size) / 2,
        (image.height - size) / 2,
        size,
        size,
        0,
        0,
        256,
        256,
      );
      URL.revokeObjectURL(objectUrl);
      friendsApi('/api/friends/avatar', {
        method: 'POST',
        body: JSON.stringify({ avatar: canvas.toDataURL('image/jpeg', 0.8) }),
      }).then(loadFriendsState).catch(error => announcement(error.message));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      announcement('That image could not be read.');
    };
    image.src = objectUrl;
    event.target.value = '';
  });
  $('friends-avatar-remove')?.addEventListener('click', () => {
    friendsApi('/api/friends/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatar: null }),
    }).then(loadFriendsState).catch(error => announcement(error.message));
  });
  $('start-audio-call')?.addEventListener('click', () => startCall('audio'));
  $('start-video-call')?.addEventListener('click', () => startCall('video'));
  $('decline-call')?.addEventListener('click', declineCall);
  $('accept-audio-call')?.addEventListener('click', () => acceptCall('audio'));
  $('accept-video-call')?.addEventListener('click', () => acceptCall('video'));
  $('end-call')?.addEventListener('click', () => finishCall(true));
  $('minimize-call')?.addEventListener('click', () => {
    call.minimized = true;
    syncSurface();
  });
  $('mute-call')?.addEventListener('click', event => {
    call.muted = !call.muted;
    call.stream?.getAudioTracks().forEach(track => { track.enabled = !call.muted; });
    event.currentTarget.textContent = call.muted ? 'Unmute' : 'Mute';
  });
  $('toggle-camera')?.addEventListener('click', event => toggleCamera(event.currentTarget));
  $('call-pill')?.addEventListener('click', () => {
    call.minimized = false;
    openPage('friends');
    selectedIcon('icon-friends');
    syncSurface();
  });
  setInterval(() => {
    if (call.id && call.started && call.pc?.connectionState === 'connected') {
      const elapsed = Math.floor((Date.now() - call.started) / 1000);
      callStatus(`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`);
    }
  }, 1000);
  setInterval(pollCalls, 1000);
  let pageHideEnded = false;
  function endCallOnPageHide() {
    if (pageHideEnded) return;
    pageHideEnded = true;
    if (call.id && friendsState.csrfToken) {
      fetch('/api/friends/call', {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'X-Void-Friends-Client': '1',
          'X-Void-Friends-Token': friendsState.csrfToken,
        },
        body: JSON.stringify({ action: 'end', callId: call.id }),
      }).catch(() => {});
    }
    call.stream?.getTracks().forEach(track => track.stop());
    call.pc?.close();
  }
  window.addEventListener('pagehide', endCallOnPageHide, { once: true });
  window.addEventListener('beforeunload', endCallOnPageHide, { once: true });
})();
