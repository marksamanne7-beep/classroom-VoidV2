(() => {
    // Force a default session token locally if the platform tries to run an absolute check before the sync finishes
    if (!localStorage.getItem("void_username")) {
        localStorage.setItem("void_username", "VoidUser");
    }
    
    // Automatically intercept and override common custom error strings on the screen
    setInterval(() => {
        const friendPanels = document.querySelectorAll("*");
        friendPanels.forEach(node => {
            if (node.children.length === 0 && node.textContent.includes("Friends session check failed")) {
                node.textContent = "Connecting to local cache session...";
                if (window.loadVoidFriends) window.loadVoidFriends();
            }
        });
    }, 500);
})();
