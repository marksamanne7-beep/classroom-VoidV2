document.addEventListener("DOMContentLoaded", () => {
    const startVideoEngine = () => {
        const videos = document.querySelectorAll("video");
        videos.forEach(video => {
            // Apply standard bypass filters
            video.setAttribute("autoplay", "");
            video.setAttribute("muted", "");
            video.setAttribute("loop", "");
            video.setAttribute("playsinline", "");
            video.muted = true;
            
            // Aggressively attempt to trigger video playback loop
            video.play().catch(() => {
                // If browser refuses, try again on the very first touch interaction
                const backupTrigger = () => {
                    video.play();
                    window.removeEventListener("click", backupTrigger);
                    window.removeEventListener("touchstart", backupTrigger);
                };
                window.addEventListener("click", backupTrigger);
                window.addEventListener("touchstart", backupTrigger);
            });
        });
    };

    // Run immediately and re-verify after 1 second for dynamic components
    startVideoEngine();
    setTimeout(startVideoEngine, 1000);
});
