document.addEventListener("DOMContentLoaded", async () => {
    const body = document.body;
    const list = document.getElementById("gigList");
    const empty = document.getElementById("gigEmpty");

    const modal = document.getElementById("ticketModal");
    const form = document.getElementById("ticketForm");
    const done = document.getElementById("ticketDone");
    const summary = document.getElementById("ticketSummary");
    const qtyOut = document.getElementById("ticketQty");
    const totalOut = document.getElementById("ticketTotal");

    const peso = Site.peso;
    const showTime = (g) => new Date(`${g.date}T${g.time}:00`);
    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const clock = (g) => showTime(g).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const escapeHtml = Site.escape;

    let data;
    try {
        data = await Site.load();
    } catch (error) {
        empty.textContent = error.message;
        empty.classList.add("show");
        document.getElementById("nextShow").hidden = true;
        return;
    }
    Site.watch();
    const maxPerPurchase = data.settings.tickets.maxPerPurchase;

    const upcoming = data.events
        .filter((g) => g.status === "UPCOMING" && showTime(g) > new Date())
        .sort((a, b) => showTime(a) - showTime(b));

    list.innerHTML = upcoming.map((g, i) => {
        const d = showTime(g);
        return `
        <article class="gig" data-genre="${escapeHtml(g.genre)}" data-index="${i}">
            <div class="gig-image"><img src="${escapeHtml(g.image)}" alt="${escapeHtml(g.band)} live at The 70's Bistro"></div>
            <div class="gig-date">
                <span>${MONTHS[d.getMonth()]} ${d.getFullYear()}</span>
                <strong>${String(d.getDate()).padStart(2, "0")}</strong>
                <span>${DAYS[d.getDay()]}</span>
            </div>
            <div class="gig-info">
                <span class="mono-label">${escapeHtml(g.genre).toUpperCase()} • LIVE BAND</span>
                <h3>${escapeHtml(g.band)}</h3>
                <p>${escapeHtml(g.note)}</p>
                <div class="gig-meta">
                    <span><i class="fa-regular fa-clock"></i>${clock(g)}</span>
                    <span><i class="fa-solid fa-location-dot"></i>The 70's Bistro, Anonas St.</span>
                </div>
            </div>
            <div class="gig-action">
                <span class="gig-price">${peso(g.price)} <small>/ TICKET</small></span>
                ${g.remaining
                    ? `<button class="button button-light" type="button" data-reserve="${i}">RESERVE A TICKET</button>${g.remaining <= 20 ? `<small class="gig-left">ONLY ${g.remaining} LEFT</small>` : ""}`
                    : '<button class="button button-light" type="button" disabled>SOLD OUT</button>'}
            </div>
        </article>`;
    }).join("");

    window.revealOnScroll(list.querySelectorAll(".gig"));

    if (!upcoming.length) empty.classList.add("show");

    const next = upcoming[0];
    const nextBar = document.getElementById("nextShow");
    if (next) {
        document.getElementById("nextShowName").textContent = next.band;
        const parts = {
            d: document.getElementById("cdDays"),
            h: document.getElementById("cdHours"),
            m: document.getElementById("cdMins"),
            s: document.getElementById("cdSecs"),
        };
        const tick = () => {
            const diff = Math.max(0, showTime(next) - new Date());
            const pad = (n) => String(n).padStart(2, "0");
            parts.d.textContent = pad(Math.floor(diff / 864e5));
            parts.h.textContent = pad(Math.floor(diff / 36e5) % 24);
            parts.m.textContent = pad(Math.floor(diff / 6e4) % 60);
            parts.s.textContent = pad(Math.floor(diff / 1e3) % 60);
        };
        tick();
        setInterval(tick, 1000);
    } else {
        nextBar.hidden = true;
    }

    let current = null;
    let qty = 1;

    const errorBox = document.getElementById("ticketError");
    const submitBtn = form.querySelector('[type="submit"]');

    const renderQty = () => {
        qtyOut.textContent = qty;
        totalOut.textContent = peso(current.price * qty);
    };

    const openModal = (gig) => {
        current = gig;
        qty = 1;
        form.reset();
        errorBox.textContent = "";
        form.hidden = false;
        done.classList.remove("show");
        summary.innerHTML = `<strong>${escapeHtml(gig.band)}</strong>${DAYS[showTime(gig).getDay()]}, ${MONTHS[showTime(gig).getMonth()]} ${showTime(gig).getDate()}, ${showTime(gig).getFullYear()} &middot; ${clock(gig)}<br>${peso(gig.price)} per ticket`;
        renderQty();
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        body.style.overflow = "hidden";
        form.elements.name.focus();
    };

    const closeModal = () => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        body.style.overflow = "";
    };

    list.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-reserve]");
        if (btn) openModal(upcoming[Number(btn.dataset.reserve)]);
    });

    document.getElementById("qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); renderQty(); });
    document.getElementById("qtyPlus").addEventListener("click", () => { qty = Math.min(maxPerPurchase, current.remaining, qty + 1); renderQty(); });
    document.getElementById("ticketClose").addEventListener("click", closeModal);
    document.getElementById("ticketDoneClose").addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorBox.textContent = "";
        submitBtn.disabled = true;
        try {
            const ticket = await Site.post("/tickets", {
                eventId: current.id,
                name: form.elements.name.value.trim(),
                email: form.elements.email.value.trim(),
                phone: form.elements.phone.value.trim(),
                qty
            });
            document.getElementById("doneBand").textContent = ticket.band;
            document.getElementById("doneDetails").textContent =
                `${ticket.qty} ticket${ticket.qty > 1 ? "s" : ""} • ${peso(ticket.amount)} • ${form.elements.name.value.trim()}`;
            document.getElementById("doneCode").textContent = ticket.code;
            form.hidden = true;
            done.classList.add("show");
        } catch (error) {
            errorBox.textContent = error.message;
        } finally {
            submitBtn.disabled = false;
        }
    });
});
