(() => {
    const WATCH_INTERVAL = 4000;
    let version = null;

    const request = async (url, options) => {
        let res;
        try {
            res = await fetch(url, { cache: "no-store", ...options });
        } catch {
            throw new Error("Can't reach the server. Please try again in a moment.");
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
        return body;
    };

    window.Site = {
        async load() {
            const data = await request("/api/public");
            version = data.version;
            return data;
        },

        post: (path, payload) => request("/api" + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }),

        watch() {
            setInterval(async () => {
                if (document.hidden || document.querySelector(".is-open")) return;
                try {
                    const latest = (await request("/api/version")).version;
                    if (version !== null && latest !== version) location.reload();
                } catch { }
            }, WATCH_INTERVAL);
        },

        peso: (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        escape: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
        slug: (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        categories: ["Appetizers", "Seafoods", "Vegetables", "Meat", "Others", "Meal Treats", "Pizza", "Pasta"]
    };
})();
