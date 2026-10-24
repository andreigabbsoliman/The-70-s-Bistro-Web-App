document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const mobileMenu = document.getElementById("mobileMenu");
    const navLinks = document.getElementById("navLinks");

    body.classList.add("js-enabled");

    const closeMobileMenu = () => {
        if (!mobileMenu || !navLinks) return;
        navLinks.classList.remove("mobile-open");
        mobileMenu.setAttribute("aria-expanded", "false");
    };

    if (mobileMenu && navLinks) {
        mobileMenu.addEventListener("click", () => {
            const isOpen = navLinks.classList.toggle("mobile-open");
            mobileMenu.setAttribute("aria-expanded", String(isOpen));
        });

        navLinks.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMobileMenu);
        });

        document.addEventListener("click", (event) => {
            if (!navLinks.contains(event.target) && !mobileMenu.contains(event.target)) {
                closeMobileMenu();
            }
        });
    }

    const revealItems = document.querySelectorAll(
        ".intro, .image-break, .quick-links, .quick-link-card, .statement, footer"
    );

    revealItems.forEach((item, index) => {
        item.classList.add("reveal");
        if (item.classList.contains("quick-link-card")) {
            item.style.transitionDelay = `${(index % 4) * 80}ms`;
        }
    });

    if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12 });

        revealItems.forEach((item) => revealObserver.observe(item));
    } else {
        revealItems.forEach((item) => item.classList.add("is-visible"));
    }

    document.querySelectorAll(".quick-link-card").forEach((card) => {
        card.addEventListener("pointerdown", () => card.classList.add("is-pressed"));
        card.addEventListener("pointerup", () => card.classList.remove("is-pressed"));
        card.addEventListener("pointerleave", () => card.classList.remove("is-pressed"));
    });

    document.querySelectorAll(".nav-links a:not(.nav-reserve)").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-links a").forEach((item) => item.classList.remove("active"));
            link.classList.add("active");
        });
    });

    const modal = document.getElementById("reservationModal");
    const closeButton = document.getElementById("reservationClose");
    const reservationForm = document.getElementById("reservationForm");
    const reservationMessage = document.getElementById("reservationMessage");

    if (modal) {
        const openModal = (event) => {
            event.preventDefault();
            modal.classList.add("is-open");
            modal.setAttribute("aria-hidden", "false");
            body.style.overflow = "hidden";
            modal.querySelector("input")?.focus();
        };

        const closeModal = () => {
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            body.style.overflow = "";
        };

        document.querySelectorAll('a[href$="reservation.html"]').forEach((link) => {
            link.addEventListener("click", openModal);
        });

        closeButton?.addEventListener("click", closeModal);
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeModal();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMobileMenu();
                closeModal();
            }
        });

        const dateInput = reservationForm?.elements.date;
        if (dateInput) dateInput.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

        reservationForm?.addEventListener("submit", async (event) => {
            event.preventDefault();
            reservationMessage.textContent = "SENDING…";
            try {
                const res = await fetch("/api/reservations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: reservationForm.elements.name.value.trim(),
                        date: reservationForm.elements.date.value,
                        guests: reservationForm.elements.guests.value
                    })
                });
                if (!res.ok) throw new Error((await res.json()).error);
                reservationMessage.textContent = "REQUEST RECEIVED — WE'LL CONFIRM SOON.";
                reservationForm.reset();
            } catch (error) {
                reservationMessage.textContent = (error.message || "COULD NOT SEND. PLEASE TRY AGAIN.").toUpperCase();
            }
        });
    }
});
