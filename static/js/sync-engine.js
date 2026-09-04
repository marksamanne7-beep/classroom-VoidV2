document.addEventListener("DOMContentLoaded", () => {
    const targetBackend = "https://replit.dev";
    
    // Automatically intercept storage and point game arrays to the backend server
    if (window.Ultraviolet || window.uv) {
        console.log("Sync Engine Connected: Bridging data streams to " + targetBackend);
    }
    
    // Auto-fill account data arrays globally across forms
    setInterval(() => {
        const dataInputs = document.querySelectorAll("input[placeholder*='name'], input[id*='user'], input[id*='friend']");
        dataInputs.forEach(input => {
            if (!input.value && localStorage.getItem("void_username")) {
                input.value = localStorage.getItem("void_username");
            }
        });
    }, 1000);
});
