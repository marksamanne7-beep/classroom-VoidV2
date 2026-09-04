(() => {
    const injectPremiumBackgroundVideo = () => {
        // Clear out any old broken background video placeholders or images
        const existingBg = document.getElementById("void-live-bg");
        if (existingBg) existingBg.remove();

        const videoContainer = document.createElement("video");
        videoContainer.id = "void-live-bg";
        
        // HARDCODED OVERRIDE: Forces the background architecture to render as a moving stream
        videoContainer.src = "https://replit.dev";
        
        videoContainer.setAttribute("autoplay", "");
        videoContainer.setAttribute("muted", "");
        videoContainer.setAttribute("loop", "");
        videoContainer.setAttribute("playsinline", "");
        videoContainer.muted = true;
        videoContainer.loop = true;
        
        // CSS properties to lock the video behind all proxy search controls flawlessly
        videoContainer.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; object-fit:cover; z-index:-99999; pointer-events:none; background:black;";

        document.body.appendChild(videoContainer);

        const runVideoPromise = () => {
            videoContainer.play().catch(() => {
                setTimeout(runVideoPromise, 300);
            });
        };
        runVideoPromise();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectPremiumBackgroundVideo);
    } else {
        injectPremiumBackgroundVideo();
    }

    // Secondary click safeguard for chrome tab media locks
    ["click", "touchstart"].forEach(event => {
        window.addEventListener(event, () => {
            const bgVideo = document.getElementById("void-live-bg");
            if (bgVideo && bgVideo.paused) bgVideo.play();
        }, { once: true });
    });
})();
