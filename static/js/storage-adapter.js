(() => {
    // 1. Identify all common variations of variables used by old proxy iterations
    const mappingRules = {
        "void_user": ["void_username", "username", "user_id"],
        "void_friends": ["friends", "friend_list", "friends_cache"],
        "void_games": ["game_data", "saves", "game_saves", "uv_history"]
    };

    // 2. Loop through and instantly bridge old keys to new keys locally in memory
    Object.entries(mappingRules).forEach(([modernKey, legacyKeys]) => {
        legacyKeys.forEach(oldKey => {
            const dataInOldKey = localStorage.getItem(oldKey);
            const dataInNewKey = localStorage.getItem(modernKey);
            
            // If the old local browser cache has data, but the new location is blank, link them!
            if (dataInOldKey && !dataInNewKey) {
                localStorage.setItem(modernKey, dataInOldKey);
            }
        });
    });

    console.log("🔒 Storage Adapter active: Local browser data states unified successfully.");
})();
