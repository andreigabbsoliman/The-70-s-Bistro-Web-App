const galleryGrid = document.getElementById("galleryGrid");

function renderGallery() {
    const list = DB.list("gallery");
    document.getElementById("photoCount").textContent = `${list.length} photo${list.length === 1 ? "" : "s"}`;
    if (!list.length) { galleryGrid.innerHTML = '<p class="empty-state">No photos yet. Add the first one.</p>'; return; }
    galleryGrid.innerHTML = list.map((g, i) => `
        <article class="photo-card">
            <div class="photo" data-action="view" data-id="${g.id}"><img src="${esc(g.image)}" alt="${esc(g.caption)}" loading="lazy"><span class="photo-no">${pad2(i + 1)}</span></div>
            <div class="photo-info"><p>${esc(g.caption)}</p>${UI.actions(g.id, [["edit", "Edit Caption"], ["delete", "Delete", "btn-danger"]])}</div>
        </article>`).join("");
}

function openAddImage() {
    UI.formModal({
        title: "Add Image", size: "sm", submitText: "Add Image",
        fields: [
            { name: "image", label: "Image file", type: "image", required: true },
            { name: "caption", label: "Caption", type: "text", required: true, full: true }
        ],
        onSubmit: data => {
            if (!DB.add("gallery", { ...data, added: todayISO() })) return false;
            UI.toast("Image added.");
            renderGallery();
        }
    });
}

function openEditCaption(id) {
    UI.formModal({
        title: "Edit Caption", size: "sm", values: DB.find("gallery", id),
        fields: [{ name: "caption", label: "Caption", type: "text", required: true, full: true }],
        onSubmit: data => {
            if (!DB.update("gallery", id, data)) return false;
            UI.toast("Caption updated.");
            renderGallery();
        }
    });
}

function openViewImage(id) {
    const photos = DB.list("gallery");
    let index = photos.findIndex(g => g.id === id);
    const modal = UI.modal({
        title: "Gallery", size: "lg", body: '<div id="lightbox"></div>',
        footer: [
            { label: "← Previous", cls: "btn-ghost", keepOpen: true, onClick: () => { index = (index - 1 + photos.length) % photos.length; show(); } },
            { label: "Next →", cls: "btn-ghost", keepOpen: true, onClick: () => { index = (index + 1) % photos.length; show(); } },
            { label: "Close", cls: "btn-primary" }
        ]
    });
    const show = () => {
        const g = photos[index];
        modal.body.querySelector("#lightbox").innerHTML = `<div class="lightbox-img"><img src="${esc(g.image)}" alt="${esc(g.caption)}"></div>
            <div class="lightbox-meta"><h4>${esc(g.caption)}</h4><p class="muted">Added ${fmt.date(g.added)} · ${index + 1} of ${photos.length}</p></div>`;
    };
    show();
}

UI.onAction(galleryGrid, async (action, id) => {
    if (action === "view") openViewImage(id);
    if (action === "edit") openEditCaption(id);
    if (action === "delete") {
        const g = DB.find("gallery", id);
        const ok = await UI.confirm({ title: "Delete image", message: `Delete <strong>${esc(g.caption)}</strong> from the gallery?`, confirmText: "Delete", danger: true });
        if (ok) { DB.remove("gallery", id); UI.toast("Image deleted."); renderGallery(); }
    }
});
document.getElementById("addImageBtn").addEventListener("click", openAddImage);

DB.onChange(renderGallery);
renderGallery();
