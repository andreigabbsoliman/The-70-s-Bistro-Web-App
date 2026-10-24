document.addEventListener("DOMContentLoaded", async () => {
    const body = document.getElementById("galleryBody");
    const count = document.getElementById("galleryCount");

    let gallery;
    try {
        gallery = (await Site.load()).gallery;
    } catch (error) {
        count.textContent = error.message;
        return;
    }
    Site.watch();

    const rollCount = Math.min(3, gallery.length);
    const perRoll = Math.ceil(gallery.length / Math.max(rollCount, 1));
    count.innerHTML = gallery.length ? `<b>${gallery.length}</b> FRAME${gallery.length === 1 ? "" : "S"} • ${rollCount} ROLL${rollCount === 1 ? "" : "S"}` : "";
    document.getElementById("galleryEmpty").hidden = gallery.length > 0;
    document.getElementById("filmRolls").innerHTML = Array.from({ length: rollCount }, (_, r) => `
            <section class="film">
                <div class="film-head">
                    <span class="mono-label accent">ROLL ${String(r + 1).padStart(2, "0")}</span>
                    <div class="film-arrows">
                        <button class="film-prev" type="button" aria-label="Scroll back"><i class="fa-solid fa-arrow-left"></i></button>
                        <button class="film-next" type="button" aria-label="Scroll forward"><i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                </div>
                <div class="film-scroller">
                    <div class="film-track">${gallery.slice(r * perRoll, (r + 1) * perRoll).map((photo, i) => {
                        const no = String(r * perRoll + i + 1).padStart(2, "0");
                        return `
                        <figure class="film-frame">
                            <button class="film-photo" type="button" aria-label="Open photo ${no}">
                                <img src="${Site.escape(photo.image)}" alt="${Site.escape(photo.caption)}" loading="lazy" draggable="false">
                            </button>
                            <figcaption class="film-no">${no}</figcaption>
                        </figure>`;
                    }).join("")}
                    </div>
                </div>
            </section>`).join("");

    const photos = [...document.querySelectorAll(".film-photo")];
    const lightbox = document.getElementById("lightbox");
    const lbImage = document.getElementById("lightboxImage");
    const lbNumber = document.getElementById("lightboxNumber");
    const lbTotal = document.getElementById("lightboxTotal");

    let index = 0;

    document.querySelectorAll(".film").forEach((film) => {
        const scroller = film.querySelector(".film-scroller");
        const step = () => scroller.querySelector(".film-frame").offsetWidth + 22;

        film.querySelector(".film-prev").addEventListener("click", () => scroller.scrollBy({ left: -step(), behavior: "smooth" }));
        film.querySelector(".film-next").addEventListener("click", () => scroller.scrollBy({ left: step(), behavior: "smooth" }));

        let startX = 0;
        let startScroll = 0;
        let pressed = false;
        let moved = false;

        scroller.addEventListener("pointerdown", (event) => {
            if (event.pointerType !== "mouse") return;
            pressed = true;
            moved = false;
            startX = event.clientX;
            startScroll = scroller.scrollLeft;
        });

        window.addEventListener("pointermove", (event) => {
            if (!pressed) return;
            const dx = event.clientX - startX;
            if (Math.abs(dx) > 5) {
                moved = true;
                scroller.classList.add("dragging");
            }
            if (moved) scroller.scrollLeft = startScroll - dx;
        });

        window.addEventListener("pointerup", () => {
            if (!pressed) return;
            pressed = false;
            scroller.classList.remove("dragging");
        });

        scroller.addEventListener("click", (event) => {
            if (moved) {
                event.stopPropagation();
                event.preventDefault();
                moved = false;
            }
        }, true);
    });

    document.querySelectorAll("[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const grid = btn.dataset.view === "grid";
            body.classList.toggle("is-grid", grid);
            document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b === btn));
        });
    });

    const show = (i) => {
        index = (i + photos.length) % photos.length;
        const photo = photos[index];
        const img = photo.querySelector("img");
        lbImage.src = img.currentSrc || img.src;
        lbImage.alt = img.alt;
        lbNumber.textContent = String(index + 1).padStart(2, "0");
    };

    const open = (i) => {
        show(i);
        lightbox.classList.add("is-open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        document.getElementById("lightboxClose").focus();
    };

    const close = () => {
        lightbox.classList.remove("is-open");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        photos[index]?.focus({ preventScroll: true });
    };

    lbTotal.textContent = String(photos.length).padStart(2, "0");
    photos.forEach((photo, i) => photo.addEventListener("click", () => open(i)));

    document.getElementById("lightboxClose").addEventListener("click", close);
    document.getElementById("lightboxPrev").addEventListener("click", () => show(index - 1));
    document.getElementById("lightboxNext").addEventListener("click", () => show(index + 1));
    lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) close();
    });

    document.addEventListener("keydown", (event) => {
        if (!lightbox.classList.contains("is-open")) return;
        if (event.key === "Escape") close();
        if (event.key === "ArrowLeft") show(index - 1);
        if (event.key === "ArrowRight") show(index + 1);
    });

    let touchX = null;
    lightbox.addEventListener("touchstart", (event) => { touchX = event.changedTouches[0].clientX; }, { passive: true });
    lightbox.addEventListener("touchend", (event) => {
        if (touchX === null) return;
        const dx = event.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
        touchX = null;
    });

    window.revealOnScroll(document.querySelectorAll(".film"));
});
