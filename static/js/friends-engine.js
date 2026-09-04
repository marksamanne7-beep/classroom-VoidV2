document.addEventListener("DOMContentLoaded", () => {
    // Inject a global standalone patch loop to handle custom additions hands-free
    window.addVoidFriend = (friendName) => {
        if (!friendName) return;
        let friends = JSON.parse(localStorage.getItem("void_friends_list") || "[]");
        if (!friends.includes(friendName)) {
            friends.push(friendName);
            localStorage.setItem("void_friends_list", JSON.stringify(friends));
        }
        window.loadVoidFriends();
    };

    window.loadVoidFriends = () => {
        let friends = JSON.parse(localStorage.getItem("void_friends_list") || "[]");
        // Auto-populate any lists or custom dashboard panels matching your app hooks
        const friendContainers = document.querySelectorAll("[id*='friend-list'], [class*='friend-list'], #friends, .friends");
        friendContainers.forEach(container => {
            container.innerHTML = ""; // Wipe error states
            if (friends.length === 0) {
                container.innerHTML = "<div style='color:#71717a; font-size:12px; padding:10px;'>No friends added yet.</div>";
            } else {
                friends.forEach(f => {
                    const item = document.createElement("div");
                    item.style.cssText = "padding:8px 12px; background:#18181b; border:1px solid #27272a; margin-bottom:6px; border-radius:6px; color:#fff; font-size:13px; display:flex; justify-content:space-between; align-items:center;";
                    item.innerHTML = `<span>🟢 ${f}</span> <span style='color:#71717a; font-size:11px;'>Online</span>`;
                    container.appendChild(item);
                });
            }
        });
    };

    // Listen to friend-input bars across your custom application setup
    document.body.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && e.target.matches("input[placeholder*='friend'], input[id*='friend']")) {
            window.addVoidFriend(e.target.value);
            e.target.value = "";
        }
    });

    // Execute an initial population sweep
    window.loadVoidFriends();
    setTimeout(window.loadVoidFriends, 1000);
});
