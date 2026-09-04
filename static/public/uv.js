importScripts('/js/uv/uv.bundle.js');
importScripts('/js/uv/uv.config.js');
importScripts('/js/uv/uv.sw.js');

const sw = new UVServiceWorker();

async function fetchWithRetry(event) {
  const requestUrl = new URL(event.request.url);
  let targetUrl = requestUrl;
  if (requestUrl.href.startsWith(self.location.origin + (__uv$config.prefix || '/service/'))) {
    try {
      const ultraviolet = new UVServiceWorker.Ultraviolet(__uv$config);
      targetUrl = new URL(ultraviolet.sourceUrl(requestUrl.href));
    } catch {
      targetUrl = requestUrl;
    }
  }
  if (targetUrl.origin === self.location.origin && targetUrl.pathname.startsWith('/api/friends')) {
    return new Response(JSON.stringify({
      error: 'Friends requests are unavailable inside proxied pages.',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  try {
    return await sw.fetch(event);
  } catch (error) {
    if (event.request.method !== 'GET') throw error;
    await new Promise(resolve => setTimeout(resolve, 300));
    return sw.fetch(event);
  }
}

self.addEventListener('fetch', (event) => event.respondWith(fetchWithRetry(event)));
