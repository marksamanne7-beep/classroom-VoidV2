"use strict";
/**
 * Global util
 * Used in index.html
 */
async function registerSW() {
  if (!navigator.serviceWorker)
    throw new Error("Your browser doesn't support service workers.");

  const workerUrl = "/uv.js?v=6";
  window.__voidProxyWorkerUrl = workerUrl;
  const existingRegistration = await navigator.serviceWorker.getRegistration(__uv$config.prefix);
  if (
    existingRegistration
    && new URL(existingRegistration.active?.scriptURL || existingRegistration.installing?.scriptURL || location.origin).search !== "?v=6"
  ) {
    await existingRegistration.unregister();
  }

  const registration = await navigator.serviceWorker.register(workerUrl, {
    scope: __uv$config.prefix,
    updateViaCache: "none",
  });
  await registration.update();
  return registration;
}

// Start warming the proxy before the rest of the app script loads.
window.__voidProxyRegistrationPromise = registerSW().catch(() => null);
