(() => {
    const oldDomain = "https://replit.dev";

    // --- PIPELINE A: ZERO-REFRESH USER DATA HANDSHAKE ---
    const runDataSyncPipeline = () => {
        // Automatically check if the client already has local data mapped to this session
        if (window.location.href.includes("replit.dev") || localStorage.getItem("void_username")) {
            return; // Already synchronized
        }

        // Open a fleeting, invisible window context to tap the first-party storage values 
        const bridgeWindow = window.open(oldDomain + "/export-bridge.html", "VoidDataBridge", "width=1,height=1,left=9999,top=9999");
        
        if (!bridgeWindow) {
            console.warn("Handshake window blocked. Waiting for first click to trigger sync channel...");
            return;
        }

        // Catch the secure data stream dispatch from the first-party popup tab
        window.addEventListener("message", function processVault(event) {
            if (event.origin === oldDomain && event.data.type === "void_secure_payload") {
                try {
                    const localVault = JSON.parse(event.data.storage);
                    Object.entries(localVault).forEach(([key, value]) => {
                        localStorage.setItem(key, value);
                    });
                    console.log("🎯 Local browser storage handshake completed successfully.");
                    
                    // Instantly patch dynamic chat & UI structures on the fly without refreshing the frame
                    if (window.loadVoidFriends) window.loadVoidFriends();
                } catch(err) {
                    console.error("Local payload sync exception:", err);
                }
                window.removeEventListener("message", processVault);
            }
        });
    };

    // --- PIPELINE B: HARDWARE-ACCELERATED LIVE VIDEO INJECTION ---
    const applyVideoBackground = () => {
        // Clear conflicting static image wrappers or broken elements
        const conflictingLayers = document.querySelectorAll("#void-live-bg, .bg-video, [class*='background-image'], [id*='background']");
        conflictingLayers.forEach(layer => { if(layer.tagName !== "VIDEO") layer.remove(); });

        let videoNode = document.getElementById("void-live-bg");
        if (!videoNode) {
            videoNode = document.createElement("video");
            videoNode.id = "void-live-bg";
            document.body.appendChild(videoNode);
        }

        // Fallback pipeline: Stream straight from the verified server source
        videoNode.src = oldDomain + "/bg.mp4"; 
        
        // Strict parameters required by web engines to allow unprompted autoplay loops
        videoNode.setAttribute("autoplay", "");
        videoNode.setAttribute("muted", "");
        videoNode.setAttribute("loop", "");
        videoNode.setAttribute("playsinline", "");
        videoNode.muted = true;
        videoNode.loop = true;
        
        // Lock the layer coordinates completely behind all proxy layout cards
        videoNode.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; object-fit:cover; z-index:-99999; pointer-events:none; background:#000;";

        const maintainPlayback = () => {
            if (videoNode.paused) {
                videoNode.play().catch(() => setTimeout(maintainPlayback, 250));
            }
        };
        maintainPlayback();
    };

    // Execute immediately on script parsing
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            runDataSyncPipeline();
            applyVideoBackground();
        });
    } else {
        runDataSyncPipeline();
        applyVideoBackground();
    }

    // Interactive fallback: Fire everything on the first natural user tap
    const firstTouchTrigger = () => {
        runDataSyncPipeline();
        const v = document.getElementById("void-live-bg");
        if (v && v.paused) v.play();
        ["click", "touchstart", "keydown"].forEach(e => window.removeEventListener(e, firstTouchTrigger));
    };
    ["click", "touchstart", "keydown"].forEach(e => window.addEventListener(e, firstTouchTrigger));
})();
