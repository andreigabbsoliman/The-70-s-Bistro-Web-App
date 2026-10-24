document.addEventListener("DOMContentLoaded", async () => {
    try {
        const { business } = (await Site.load()).settings;
        const digits = business.phone.replace(/\D/g, "");
        const set = (id, text, href) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = text;
            if (href) el.href = href;
            const btn = el.closest(".touch-item")?.querySelector(".copy-btn");
            if (btn) btn.dataset.copy = text;
        };
        set("siteAddress", business.address);
        set("sitePhone", business.phone, "tel:+" + digits);
        set("siteEmail", business.email, "mailto:" + business.email);
        Site.watch();
    } catch { }

    document.querySelectorAll(".copy-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(btn.dataset.copy);
                btn.textContent = "COPIED ✓";
                btn.classList.add("done");
            } catch {
                btn.textContent = "PRESS CTRL+C";
            }
            setTimeout(() => {
                btn.textContent = "COPY";
                btn.classList.remove("done");
            }, 1800);
        });
    });

    window.revealOnScroll(document.querySelectorAll(".touch-item, .touch-map"));
});
