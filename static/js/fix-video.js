document.addEventListener("DOMContentLoaded", () => {
    // Locate any background video tags on the platform
    const videos = document.querySelectorAll("video");
    
    videos.forEach(video => {
        // Force the absolute requirements needed to bypass browser media locks
        video.setAttribute("autoplay", "");
        video.setAttribute("muted", "");
        video.setAttribute("loop", "");
        video.setAttribute("playsinline", "");
        video.muted = true; // Hardcode the mute bridge state
        
        // Attempt an immediate forced play thread
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Browser blocked video auto-start. Retrying on first user click input...");
                // Backup option: Play the live background the split second they tap anywhere
                document.body.addEventListener("click", () => {
                    video.play();
                }, { once: true });
            });
        }
    });
});
