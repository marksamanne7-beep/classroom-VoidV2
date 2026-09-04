// Universal Browser Persistence Script
document.addEventListener("DOMContentLoaded", () => {
    // 1. Check if a username or session already exists in the local browser memory
    let savedUser = localStorage.getItem("void_username");

    if (!savedUser) {
        // If they are new, ask for their nickname/profile name
        savedUser = prompt("Enter a username to remember you on this browser:");
        if (savedUser) {
            localStorage.setItem("void_username", savedUser);
        }
    }

    console.log("Welcome back, " + savedUser + "! Your local browser session is active.");
    
    // Automatically apply the saved profile to any chat username inputs on the page
    const usernameFields = document.querySelectorAll("input[placeholder*='name'], input[id*='user'], input[class*='user']");
    usernameFields.forEach(field => {
        if (savedUser) field.value = savedUser;
    });
});
