const MUSIC_STORAGE_KEY = 'voidMusicLibrary';
const musicState = {
  loaded: false,
  view: 'discover',
  tracks: [],
  home: [],
  liked: [],
  playlist: [],
  recent: [],
  current: null,
  queue: [],
  showLyrics: false,
  lyrics: null,
  lyricsTrackId: null,
  lyricsLoading: false,
};

function musicArtists(track) {
  return Array.isArray(track?.artists) && track.artists.length
    ? track.artists.map(artist => artist?.name || artist).filter(Boolean).join(', ')
    : 'Unknown artist';
}

function cleanMusicTrack(track) {
  if (!track?.id || !track?.title) return null;
  return {
    id: String(track.id),
    title: String(track.title),
    album: String(track.album || ''),
    artists: Array.isArray(track.artists)
      ? track.artists.map(artist => ({ name: String(artist?.name || artist || '') })).filter(artist => artist.name)
      : [],
    image: String(track.image || track.imageLarge || ''),
    imageLarge: String(track.imageLarge || track.image || ''),
    duration: Math.max(0, Number(track.duration) || 0),
  };
}

function collectMusicTracks(value, output = [], seen = new Set()) {
  if (!value || output.length >= 40) return output;
  if (Array.isArray(value)) {
    value.forEach(item => collectMusicTracks(item, output, seen));
    return output;
  }
  if (typeof value !== 'object') return output;
  const source = value.item?.id ? value.item : value;
  const candidate = cleanMusicTrack(source);
  if (candidate && !seen.has(candidate.id) && (source.streams || source.duration || value.kind === 'song')) {
    seen.add(candidate.id);
    output.push(candidate);
  }
  Object.values(value).forEach(item => collectMusicTracks(item, output, seen));
  return output;
}

function readMusicLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(MUSIC_STORAGE_KEY) || '{}');
    for (const key of ['liked', 'playlist', 'recent']) {
      musicState[key] = Array.isArray(saved[key])
        ? saved[key].map(cleanMusicTrack).filter(Boolean).slice(0, key === 'recent' ? 30 : 200)
        : [];
    }
  } catch {
    musicState.liked = [];
    musicState.playlist = [];
    musicState.recent = [];
  }
}

function saveMusicLibrary() {
  try {
    localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify({
      liked: musicState.liked,
      playlist: musicState.playlist,
      recent: musicState.recent,
    }));
  } catch {
    announcement('Your browser could not save the music library.');
  }
}

function musicHas(collection, id) {
  return collection.some(track => track.id === id);
}

function formatMusicTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function setMusicStatus(message = '', visible = false) {
  const status = document.getElementById('music-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('visible', visible);
}

function makeMusicImage(track, className = '') {
  const image = document.createElement('img');
  image.className = className;
  image.alt = '';
  image.loading = 'lazy';
  image.referrerPolicy = 'no-referrer';
  if (track.image || track.imageLarge) image.src = track.image || track.imageLarge;
  return image;
}

function toggleMusicLike(track) {
  musicState.liked = musicHas(musicState.liked, track.id)
    ? musicState.liked.filter(item => item.id !== track.id)
    : [track, ...musicState.liked];
  saveMusicLibrary();
  renderMusicView();
}

function toggleMusicPlaylist(track) {
  const added = !musicHas(musicState.playlist, track.id);
  musicState.playlist = added
    ? [...musicState.playlist, track]
    : musicState.playlist.filter(item => item.id !== track.id);
  saveMusicLibrary();
  announcement(added ? `Added “${track.title}” to My playlist.` : `Removed “${track.title}” from My playlist.`);
  renderMusicView();
}

function makeMusicTrackRow(track) {
  const row = document.createElement('div');
  row.className = `music-track${musicState.current?.id === track.id ? ' playing' : ''}`;
  const image = makeMusicImage(track, 'music-track-cover');
  image.addEventListener('click', () => playMusicTrack(track));
  const copy = document.createElement('div');
  copy.className = 'music-track-copy';
  const title = document.createElement('div');
  title.className = 'music-track-title';
  title.textContent = track.title;
  const artist = document.createElement('div');
  artist.className = 'music-track-artist';
  artist.textContent = musicArtists(track);
  copy.append(title, artist);
  copy.addEventListener('click', () => playMusicTrack(track));
  const album = document.createElement('div');
  album.className = 'music-track-album';
  album.textContent = track.album || 'Single';
  const like = document.createElement('button');
  like.type = 'button';
  like.className = `music-track-action${musicHas(musicState.liked, track.id) ? ' active' : ''}`;
  like.textContent = musicHas(musicState.liked, track.id) ? '♥' : '♡';
  like.title = 'Like song';
  like.addEventListener('click', () => toggleMusicLike(track));
  const add = document.createElement('button');
  add.type = 'button';
  add.className = `music-track-action${musicHas(musicState.playlist, track.id) ? ' active' : ''}`;
  add.textContent = musicHas(musicState.playlist, track.id) ? '✓' : '+';
  add.title = 'Add to My playlist';
  add.addEventListener('click', () => toggleMusicPlaylist(track));
  row.append(image, copy, album, like, add);
  return row;
}

function makeMusicCard(track) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'music-card';
  const title = document.createElement('div');
  title.className = 'music-card-title';
  title.textContent = track.title;
  const artist = document.createElement('div');
  artist.className = 'music-card-artist';
  artist.textContent = musicArtists(track);
  card.append(makeMusicImage(track), title, artist);
  card.addEventListener('click', () => playMusicTrack(track));
  return card;
}

function musicViewTracks() {
  if (musicState.view === 'liked') return musicState.liked;
  if (musicState.view === 'playlist') return musicState.playlist;
  if (musicState.view === 'recent') return musicState.recent;
  return musicState.tracks.length ? musicState.tracks : musicState.home;
}

function renderMusicView() {
  const headings = {
    discover: ['Discover', 'Fresh music from the Venom catalog, presented by Void.'],
    search: ['Search results', 'Songs matching your search.'],
    liked: ['Liked songs', 'The tracks you saved on this device.'],
    playlist: ['My playlist', 'Your personal play queue, stored on this device.'],
    recent: ['Recently played', 'Pick up where you left off.'],
  };
  const [heading, subtitle] = headings[musicState.view] || headings.discover;
  document.getElementById('music-heading').textContent = heading;
  document.getElementById('music-subtitle').textContent = subtitle;
  document.querySelectorAll('[data-music-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.musicView === musicState.view);
  });
  const tracks = musicViewTracks();
  musicState.queue = tracks;
  const grid = document.getElementById('music-results');
  const list = document.getElementById('music-tracks');
  grid.replaceChildren();
  list.replaceChildren();
  if (!tracks.length) {
    setMusicStatus(
      musicState.view === 'search'
        ? 'No songs matched that search.'
        : musicState.view === 'discover'
          ? 'Music could not be loaded. Try again in a moment.'
          : 'Nothing here yet. Add songs while you browse.',
      true,
    );
    return;
  }
  setMusicStatus('', false);
  if (musicState.view === 'discover') {
    tracks.slice(0, 6).forEach(track => grid.appendChild(makeMusicCard(track)));
  }
  tracks.forEach(track => list.appendChild(makeMusicTrackRow(track)));
}

async function loadMusicHome() {
  setMusicStatus('Loading music…', true);
  try {
    const response = await fetch('/api/music/home');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Music could not be loaded.');
    musicState.home = collectMusicTracks(data);
    musicState.loaded = true;
    renderMusicView();
  } catch (error) {
    musicState.loaded = false;
    setMusicStatus(error.message, true);
  }
}

async function searchMusic(query) {
  musicState.view = 'search';
  musicState.tracks = [];
  renderMusicView();
  setMusicStatus(`Searching for “${query}”…`, true);
  try {
    const response = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Music search failed.');
    musicState.tracks = collectMusicTracks(data);
    renderMusicView();
  } catch (error) {
    setMusicStatus(error.message, true);
  }
}

function parseMusicLyrics(data) {
  const syncedLyrics = typeof data?.syncedLyrics === 'string' ? data.syncedLyrics.trim() : '';
  const plainLyrics = typeof data?.plainLyrics === 'string' ? data.plainLyrics.trim() : '';
  if (syncedLyrics) {
    const lines = syncedLyrics.split(/\r?\n/).flatMap(line => {
      const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
      if (!match) return [];
      return [{
        time: Number(match[1]) * 60 + Number(match[2]),
        text: match[3].trim(),
      }];
    });
    if (lines.length) return { synced: true, lines };
  }
  const text = plainLyrics || syncedLyrics.replace(/^\[[^\]]+\]\s*/gm, '').trim();
  return text
    ? { synced: false, lines: text.split(/\r?\n/).map(line => ({ time: null, text: line.trim() })) }
    : null;
}

function updateMusicLyricsActive() {
  if (!musicState.showLyrics || !musicState.lyrics?.synced) return;
  let activeIndex = -1;
  musicState.lyrics.lines.forEach((line, index) => {
    if (line.time <= (musicAudio?.currentTime || 0)) activeIndex = index;
  });
  document.querySelectorAll('.music-player-lyrics-line').forEach((line, index) => {
    line.classList.toggle('active', index === activeIndex);
  });
  const active = document.querySelector('.music-player-lyrics-line.active');
  if (active?.parentElement) {
    active.parentElement.scrollTop = Math.max(0, active.offsetTop - active.parentElement.clientHeight / 2);
  }
}

function renderMusicLyrics() {
  const player = document.getElementById('music-player');
  const container = document.getElementById('music-player-lyrics');
  const toggle = document.getElementById('music-lyrics-toggle');
  if (!player || !container || !toggle) return;
  player.classList.toggle('showing-lyrics', musicState.showLyrics);
  toggle.classList.toggle('active', musicState.showLyrics);
  toggle.textContent = musicState.showLyrics ? 'Hide lyrics' : 'Lyrics';
  toggle.setAttribute('aria-label', musicState.showLyrics ? 'Hide lyrics' : 'Show lyrics');
  container.replaceChildren();
  if (!musicState.showLyrics) return;

  if (musicState.lyricsLoading) {
    const loading = document.createElement('div');
    loading.className = 'music-player-lyrics-empty';
    loading.textContent = 'Loading lyrics…';
    container.appendChild(loading);
    return;
  }
  if (musicState.lyrics?.error || !musicState.lyrics?.lines?.length) {
    const empty = document.createElement('div');
    empty.className = 'music-player-lyrics-empty';
    empty.textContent = musicState.lyrics?.error || 'Lyrics are not available for this song.';
    container.appendChild(empty);
    return;
  }
  musicState.lyrics.lines.forEach((line, index) => {
    const lyricLine = document.createElement('div');
    lyricLine.className = 'music-player-lyrics-line';
    lyricLine.dataset.lyricsIndex = String(index);
    lyricLine.textContent = line.text || ' ';
    container.appendChild(lyricLine);
  });
  updateMusicLyricsActive();
}

async function loadMusicLyrics(track) {
  if (!track) return;
  const trackId = track.id;
  musicState.lyricsLoading = true;
  musicState.lyrics = null;
  musicState.lyricsTrackId = trackId;
  renderMusicLyrics();
  try {
    const response = await fetch(
      `/api/music/lyrics?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(musicArtists(track))}`,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Lyrics could not be loaded.');
    if (musicState.current?.id !== trackId) return;
    musicState.lyrics = parseMusicLyrics(data) || { error: 'Lyrics are not available for this song.' };
  } catch (error) {
    if (musicState.current?.id !== trackId) return;
    musicState.lyrics = { error: error.message || 'Lyrics could not be loaded.' };
  } finally {
    if (musicState.current?.id === trackId) {
      musicState.lyricsLoading = false;
      renderMusicLyrics();
    }
  }
}

function toggleMusicLyrics() {
  if (!musicState.current) {
    announcement('Play a song first to view its lyrics.');
    return;
  }
  musicState.showLyrics = !musicState.showLyrics;
  renderMusicLyrics();
  if (musicState.showLyrics && musicState.lyricsTrackId !== musicState.current.id) {
    loadMusicLyrics(musicState.current);
  }
}

function updateMusicPlayer() {
  const track = musicState.current;
  if (!track) return;
  showMusicPlayer();
  document.getElementById('music-player-cover').src = track.imageLarge || track.image || '';
  document.getElementById('music-player-title').textContent = track.title;
  document.getElementById('music-player-artist').textContent = musicArtists(track);
  renderMusicView();
  renderMusicLyrics();
}

function showMusicPlayer() {
  const player = document.getElementById('music-player');
  if (!player) return;
  player.classList.remove('is-closing');
  player.classList.add('visible');
}

function hideMusicPlayer() {
  const player = document.getElementById('music-player');
  if (!player) return;
  const audio = document.getElementById('music-audio');
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  player.classList.remove('visible');
  player.classList.add('is-closing');
  setTimeout(() => player.classList.remove('is-closing'), 420);
}

function playMusicTrack(track) {
  const audio = document.getElementById('music-audio');
  if (!audio || !track) return;
  const changedTrack = musicState.current?.id !== track.id;
  musicState.current = track;
  if (changedTrack) {
    musicState.lyrics = null;
    musicState.lyricsTrackId = null;
    musicState.lyricsLoading = false;
  }
  musicState.recent = [track, ...musicState.recent.filter(item => item.id !== track.id)].slice(0, 30);
  saveMusicLibrary();
  audio.src = `/api/music/stream?id=${encodeURIComponent(track.id)}&q=160`;
  audio.play().catch(() => announcement('Playback was blocked. Press Play to start the song.'));
  updateMusicPlayer();
  if (musicState.showLyrics) loadMusicLyrics(track);
}

function stepMusicQueue(direction) {
  const queue = musicState.queue.length ? musicState.queue : musicState.home;
  if (!queue.length) return;
  const currentIndex = queue.findIndex(track => track.id === musicState.current?.id);
  playMusicTrack(queue[currentIndex < 0 ? 0 : (currentIndex + direction + queue.length) % queue.length]);
}

function openMusicPage() {
  reportFriendsActivity(null);
  openPage('music');
  selectedIcon('icon-music');
  if (location.hash !== '#music') history.replaceState(null, '', '#music');
  if (!musicState.loaded) loadMusicHome();
}

readMusicLibrary();
document.querySelectorAll('[data-music-view]').forEach(button => {
  button.addEventListener('click', () => {
    musicState.view = button.dataset.musicView;
    musicState.tracks = [];
    renderMusicView();
  });
});
document.getElementById('music-search-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const query = document.getElementById('music-search-input')?.value.trim();
  if (!query || query.length < 2) {
    setMusicStatus('Enter at least two characters to search.', true);
    return;
  }
  searchMusic(query);
});

const musicAudio = document.getElementById('music-audio');
musicAudio?.addEventListener('play', () => {
  const button = document.getElementById('music-play-toggle');
  button.textContent = 'Ⅱ';
  button.setAttribute('aria-label', 'Pause');
});
musicAudio?.addEventListener('pause', () => {
  const button = document.getElementById('music-play-toggle');
  button.textContent = '▶';
  button.setAttribute('aria-label', 'Play');
});
musicAudio?.addEventListener('timeupdate', () => {
  const progress = document.getElementById('music-progress');
  if (Number.isFinite(musicAudio.duration) && musicAudio.duration > 0) {
    progress.value = String((musicAudio.currentTime / musicAudio.duration) * 100);
  }
  document.getElementById('music-current-time').textContent = formatMusicTime(musicAudio.currentTime);
  document.getElementById('music-duration').textContent = formatMusicTime(musicAudio.duration);
  updateMusicLyricsActive();
});
musicAudio?.addEventListener('loadedmetadata', () => {
  document.getElementById('music-duration').textContent = formatMusicTime(musicAudio.duration);
});
musicAudio?.addEventListener('ended', () => stepMusicQueue(1));
musicAudio?.addEventListener('error', () => {
  if (musicState.current) announcement('This song could not be played. Try another track.');
});
document.getElementById('music-play-toggle')?.addEventListener('click', () => {
  if (!musicState.current) {
    const first = musicViewTracks()[0] || musicState.home[0];
    if (first) playMusicTrack(first);
    return;
  }
  if (musicAudio.paused) {
    showMusicPlayer();
    musicAudio.play().catch(() => {});
  } else musicAudio.pause();
});
document.getElementById('music-prev')?.addEventListener('click', () => stepMusicQueue(-1));
document.getElementById('music-next')?.addEventListener('click', () => stepMusicQueue(1));
document.getElementById('music-lyrics-toggle')?.addEventListener('click', toggleMusicLyrics);
document.getElementById('music-player-close')?.addEventListener('click', hideMusicPlayer);
document.getElementById('music-progress')?.addEventListener('input', event => {
  if (Number.isFinite(musicAudio?.duration)) {
    musicAudio.currentTime = musicAudio.duration * (Number(event.target.value) / 100);
  }
});
document.getElementById('music-volume')?.addEventListener('input', event => {
  if (musicAudio) musicAudio.volume = Number(event.target.value);
});
if (musicAudio) musicAudio.volume = 0.8;

if (location.hash === '#music') openMusicPage();