(() => {
    const observer = "IntersectionObserver" in window
        ? new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                obs.unobserve(entry.target);
            });
        }, { threshold: 0.1 })
        : null;

    window.revealOnScroll = (items) => {
        items.forEach((item) => {
            item.classList.add("reveal");
            if (observer) observer.observe(item);
            else item.classList.add("is-visible");
        });
    };

    document.addEventListener("DOMContentLoaded", () => {
        window.revealOnScroll(document.querySelectorAll("[data-reveal]"));
    });
})();
