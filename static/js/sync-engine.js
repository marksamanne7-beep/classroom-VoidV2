document.addEventListener("DOMContentLoaded", () => {
    const oldSite = "https://replit.dev";
    const currentUrl = window.location.origin;

    // --- PHASE 1: IF USER IS ON THE NEW VERCEL SITE ---
    if (!window.location.href.includes("replit.dev")) {
        // Check URL parameters to see if the automated pipeline just brought data back
        const urlParams = new URLSearchParams(window.location.search);
        const dataPayload = urlParams.get("void_data_payload");

        if (dataPayload) {
            try {
                const parsedData = JSON.parse(decodeURIComponent(dataPayload));
                Object.entries(parsedData).forEach(([key, value]) => {
                    localStorage.setItem(key, value);
                });
                // Clean up the URL bar immediately so the screen looks flawless
                window.history.replaceState({}, document.title, window.location.pathname);
                alert("🎯 Spot-on! All game saves, profiles, and lists synchronized perfectly.");
                window.location.reload();
            } catch (e) {
                console.error("Pipeline unpacking error:", e);
            }
            return;
        }

        // Show a premium automated prompt overlay if their data is currently blank
        if (!localStorage.getItem("void_username")) {
            const syncUi = document.createElement("div");
            syncUi.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:999999; background:#0a0a0c; border:1px solid #27272a; padding:16px; border-radius:12px; width:290px; box-shadow:0 10px 40px rgba(0,0,0,0.8); font-family:sans-serif; color:#fff;";
            syncUi.innerHTML = `
                <h4 style="margin:0 0 6px 0; font-size:13px; font-weight:bold; letter-spacing:0.5px;">🔄 AUTOMATED SYSTEM RESYNC</h4>
                <p style="margin:0 0 12px 0; font-size:11px; color:#a1a1aa; line-height:1.4;">Click below to automatically restore your custom friend networks, chat history, and game progression from the old server setup.</p>
                <button id="trigger-pipeline" style="width:100%; padding:10px; background:#0070f3; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold; transition:0.2s;">Sync Legacy Data Now</button>
            `;
            document.body.appendChild(syncUi);

            document.getElementById("trigger-pipeline").onclick = () => {
                // Route them to the old site's automated exporter loop
                window.location.href = `${oldSite}/?request_extraction=true&return_to=${encodeURIComponent(currentUrl)}`;
            };
        }
    } 
    
    // --- PHASE 2: IF THE SCRIPT FIRES BACK ON THE OLD REPLIT SERVER LINK ---
    else {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("request_extraction") === "true") {
            const returnTarget = urlParams.get("return_to");
            if (returnTarget) {
                // Instantly package every piece of game data from the browser cache
                const dataArchive = encodeURIComponent(JSON.stringify(localStorage));
                // Automatically blast back down the pipeline to Vercel without manual inputs
                window.location.href = `${returnTarget}/?void_data_payload=${dataArchive}`;
            }
        }
    }
});
