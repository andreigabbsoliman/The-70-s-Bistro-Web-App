const EVENT_STATUSES = ["UPCOMING", "COMPLETED", "CANCELLED"];
const GENRES = ["Folk", "Pinoy Rock", "Reggae", "Alternative", "Acoustic", "Other"];
const MIN_CAPACITY = 150, MAX_CAPACITY = 250;
const eventGrid = document.getElementById("eventGrid");
const eventSearch = document.getElementById("searchInput");
const genreFilter = document.getElementById("genreFilter");
let eventStatus = "";

UI.fillSelect(genreFilter, GENRES, "All genres");

const eventFields = [
    { name: "band", label: "Band Name", type: "text", required: true },
    { name: "genre", label: "Genre", type: "select", options: GENRES },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "time", label: "Showtime", type: "time", required: true, default: "20:00" },
    { name: "price", label: "Ticket Price (₱)", type: "number", required: true, min: 1 },
    { name: "capacity", label: "Ticket Capacity", type: "number", required: true, min: MIN_CAPACITY, max: MAX_CAPACITY, help: `Total tickets for the gig (${MIN_CAPACITY}-${MAX_CAPACITY}).` },
    { name: "status", label: "Status", type: "select", options: EVENT_STATUSES },
    { name: "note", label: "Description", type: "textarea", required: true, placeholder: "A line or two shown on the website." },
    { name: "image", label: "Image", type: "image" }
];

function renderChips() {
    const events = DB.list("events");
    const chips = [["", "All", events.length], ...EVENT_STATUSES.map(s => [s, s.charAt(0) + s.slice(1).toLowerCase(), events.filter(e => e.status === s).length])];
    document.getElementById("statusChips").innerHTML = chips.map(([v, label, n]) => `<button class="chip ${v === eventStatus ? "active" : ""}" data-status="${v}">${label} (${n})</button>`).join("");
}

function renderEvents() {
    renderChips();
    const q = eventSearch.value.trim().toLowerCase();
    const list = DB.list("events")
        .filter(e => (!eventStatus || e.status === eventStatus) && (!genreFilter.value || e.genre === genreFilter.value) && (!q || e.band.toLowerCase().includes(q)))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    if (!list.length) { eventGrid.innerHTML = '<p class="empty-state">No events found.</p>'; return; }
    eventGrid.innerHTML = list.map(e => {
        const tickets = Flow.ticketStats(e.id);
        return `<article class="event-card ${e.status.toLowerCase()}">
            <div class="event-media">${e.image ? `<img src="${esc(e.image)}" alt="${esc(e.band)}">` : "🎸"}${UI.badge(e.status)}</div>
            <div class="event-body">
                <span class="event-date">${fmt.date(e.date)} · ${fmt.time(e.time)}</span>
                <h3>${esc(e.band)}</h3>
                <span class="event-artist">${esc(e.genre)} · ${fmt.pesoShort(e.price)} / ticket</span>
                <p class="event-desc">${esc(e.note)}</p>
                <div class="event-tickets">
                    <div class="fill-bar ${tickets.remaining ? "" : "full"}"><i style="width:${Math.round((tickets.sold + tickets.pending) / tickets.capacity * 100)}%"></i></div>
                    <p><strong>${tickets.sold}</strong> / ${tickets.capacity} sold${tickets.pending ? ` · ${tickets.pending} pending` : ""} · ${tickets.remaining ? `${tickets.remaining} left` : "<b>SOLD OUT</b>"} · ${fmt.pesoShort(tickets.revenue)}</p>
                </div>
                ${UI.actions(e.id, [["view", "View"], ["edit", "Edit"], ["status", "Status"], ["delete", "Delete", "btn-danger"]])}
            </div>
        </article>`;
    }).join("");
}

function openAddEvent() {
    UI.formModal({
        title: "Add Event", fields: eventFields, values: { date: todayISO(), status: "UPCOMING", price: 350, capacity: DB.data.settings.tickets.defaultCapacity }, submitText: "Add Event",
        onSubmit: data => {
            const event = DB.add("events", data);
            if (!event) return false;
            Flow.notify("system", "New Event Added", `${event.band} was added to the events calendar.`);
            UI.toast("Event added.");
            refreshNotificationBadges();
            renderEvents();
        }
    });
}

function openEditEvent(id) {
    UI.formModal({
        title: "Edit Event", fields: eventFields, values: DB.find("events", id),
        onSubmit: data => {

            const t = Flow.ticketStats(id);
            if (data.capacity < t.sold + t.pending) { UI.toast(`${t.sold + t.pending} tickets are already sold or held. Capacity can't be lower.`, "error"); return false; }
            if (!DB.update("events", id, data)) return false;
            UI.toast("Event updated.");
            renderEvents();
        }
    });
}

function openChangeStatus(id) {
    const e = DB.find("events", id);
    UI.formModal({
        title: `Change Status — ${e.band}`, size: "sm", submitText: "Update", values: { status: e.status },
        fields: [{ name: "status", label: "Status", type: "select", options: EVENT_STATUSES, full: true }],
        onSubmit: data => {
            if (!DB.update("events", id, { status: data.status })) return false;
            UI.toast("Event status changed.");
            renderEvents();
        }
    });
}

function openViewEvent(id) {
    const e = DB.find("events", id);
    const tickets = Flow.ticketStats(id);
    UI.modal({
        title: e.band,
        body: (e.image ? `<img class="event-view-img" src="${esc(e.image)}" alt="">` : "") +
            UI.details([["Date", fmt.date(e.date)], ["Showtime", fmt.time(e.time)], ["Genre", esc(e.genre)], ["Ticket price", fmt.peso(e.price)], ["Capacity", `${tickets.capacity} tickets`], ["Seats left", tickets.remaining || "Sold out"],
                ["Status", UI.badge(e.status)], ["Tickets sold", tickets.sold], ["Pending payment", tickets.pending], ["Ticket revenue", fmt.peso(tickets.revenue)], ["Description", esc(e.note)]]),
        footer: [{ label: "Close", cls: "btn-ghost" }, { label: "Edit", cls: "btn-primary", onClick: () => { openEditEvent(id); } }]
    });
}

UI.onAction(eventGrid, async (action, id) => {
    if (action === "view") openViewEvent(id);
    if (action === "edit") openEditEvent(id);
    if (action === "status") openChangeStatus(id);
    if (action === "delete") {
        const e = DB.find("events", id);
        const hasSales = DB.list("transactions").some(t => t.eventId === id);
        const ok = await UI.confirm({ title: "Delete event", message: `Delete <strong>${esc(e.band)}</strong>?${hasSales ? " Its ticket transactions will stay in the records." : ""}`, confirmText: "Delete", danger: true });
        if (ok) { DB.remove("events", id); UI.toast("Event deleted."); renderEvents(); }
    }
});
document.getElementById("statusChips").addEventListener("click", e => {
    const chip = e.target.closest("[data-status]");
    if (chip) { eventStatus = chip.dataset.status; renderEvents(); }
});
eventSearch.addEventListener("input", debounce(renderEvents, 150));
genreFilter.addEventListener("change", renderEvents);
document.getElementById("addEventBtn").addEventListener("click", openAddEvent);

DB.onChange(renderEvents);
renderEvents();
UI.openFromQuery(openAddEvent);
