/* ==========================================================================
   Catalog admin: script

   1. Helpers
   2. State
   3. Rendering
   4. Product editor
   5. Photos
   6. Settings, tabs and publishing
   ========================================================================== */


/* ==========================================================================
   1. Helpers
   ========================================================================== */

const $ = (id) => document.getElementById(id);
const clone = (value) => structuredClone(value);
const formatPrice = (n) => state.settings.currency + Number(n).toLocaleString("en-NG");

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const slugify = (text) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";

const isDirty = () => JSON.stringify(state) !== JSON.stringify(PUBLISHED);

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || clone(PUBLISHED);
  } catch {
    return clone(PUBLISHED);
  }
}

/** Save the draft and refresh the screen. */
function commit() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch { /* draft just won't survive a refresh */ }
  renderAll();
}

function download(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Show a colour tile with the first letter, and a photo on top if it loads. */
function tileHtml(product, className) {
  const img = product.image
    ? `<img src="${IMAGE_FOLDER}${escapeHtml(product.image)}" alt="">`
    : "";
  return `<div class="${className}" style="background:${product.color}"><span aria-hidden="true">${escapeHtml(product.name[0] || "?")}</span>${img}</div>`;
}

function removeBrokenImages(container) {
  container.querySelectorAll("img").forEach((img) =>
    img.addEventListener("error", () => img.remove(), { once: true }));
}


/* ==========================================================================
   2. State
   The draft lives in localStorage. PUBLISHED is the data.js currently in the
   folder, so we can tell when there are unpublished changes.
   ========================================================================== */

const DRAFT_KEY = "catalog-admin-draft";
const IMAGE_FOLDER = "../public/images/";
const EMPTY_CATALOG = {
  settings: { storeName: "My Shop", tagline: "", sellerNumber: "", currency: "₦" },
  products: [],
};

const DATA_FOUND = Boolean(window.CATALOG); // false if ../public/data.js did not load
const PUBLISHED = clone(window.CATALOG || EMPTY_CATALOG);

let state = loadDraft();
let editingId = null;    // id of the product in the editor (null = adding a new one)
let pendingPhoto = null; // { blob, url } for a freshly chosen photo


/* ==========================================================================
   3. Rendering
   ========================================================================== */

function renderAll() {
  renderStatus();
  renderStats();
  renderCategories();
  renderTable();
}

function renderStatus() {
  $("status").textContent = !DATA_FOUND
    ? "Could not find ../public/data.js. Keep the admin and public folders side by side, or use Import data.js."
    : isDirty()
    ? "Unpublished changes. Download data.js to publish them."
    : "Everything here matches your published shop.";
}

function renderStats() {
  const { products } = state;
  const soldOut = products.filter((p) => p.soldOut).length;
  const hidden = products.filter((p) => p.hidden).length;
  const categories = new Set(products.map((p) => p.category)).size;
  const cards = [
    [products.length - hidden, "Products in shop"],
    [soldOut, "Sold out"],
    [hidden, "Hidden"],
    [categories, "Categories"],
  ];
  $("stats").innerHTML = cards.map(([value, label]) =>
    `<div class="stat"><span class="stat__value">${value}</span><span class="stat__label">${label}</span></div>`).join("");
}

function renderCategories() {
  const categories = [...new Set(state.products.map((p) => p.category))].sort();
  const select = $("category-filter");
  const current = select.value || "All";

  select.innerHTML = ["All", ...categories]
    .map((c) => `<option value="${escapeHtml(c)}">${c === "All" ? "All categories" : escapeHtml(c)}</option>`).join("");
  select.value = categories.includes(current) || current === "All" ? current : "All";

  $("category-list").innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}">`).join("");
}

function statusBadge(product) {
  if (product.hidden)  return `<span class="badge">Hidden</span>`;
  if (product.soldOut) return `<span class="badge badge--alert">Sold out</span>`;
  return `<span class="badge badge--live">Live</span>`;
}

function renderRow(product) {
  return `
    <tr>
      <td><div class="product-cell">
        ${tileHtml(product, "thumb")}
        <div>${escapeHtml(product.name)}<small>${escapeHtml(product.desc || "")}</small></div>
      </div></td>
      <td>${escapeHtml(product.category)}</td>
      <td>${formatPrice(product.price)}</td>
      <td>${statusBadge(product)}</td>
      <td><div class="row-actions">
        <button class="button button--outline" data-action="edit" data-id="${product.id}">Edit</button>
        <button class="button button--outline" data-action="toggle-hidden" data-id="${product.id}">${product.hidden ? "Show" : "Hide"}</button>
        <button class="button button--outline" data-action="delete" data-id="${product.id}">Delete</button>
      </div></td>
    </tr>`;
}

function renderTable() {
  const query = $("search").value.trim().toLowerCase();
  const category = $("category-filter").value;

  const rows = state.products.filter((p) =>
    (category === "All" || p.category === category) &&
    `${p.name} ${p.desc}`.toLowerCase().includes(query));

  $("product-rows").innerHTML = rows.length
    ? rows.map(renderRow).join("")
    : `<tr><td colspan="5">No products match.</td></tr>`;
  removeBrokenImages($("product-rows"));
}


/* ==========================================================================
   4. Product editor
   ========================================================================== */

function openEditor(id = null) {
  editingId = id;
  const product = state.products.find((p) => p.id === id) ||
    { name: "", desc: "", price: "", category: "", color: "#1f2a5c", image: "", soldOut: false, hidden: false };

  $("dialog-title").textContent = id ? "Edit product" : "Add product";
  $("p-name").value = product.name;
  $("p-desc").value = product.desc;
  $("p-price").value = product.price;
  $("p-category").value = product.category;
  $("p-color").value = product.color;
  $("p-image").value = product.image || "";
  $("p-soldOut").checked = product.soldOut;
  $("p-hidden").checked = product.hidden;

  pendingPhoto = null;
  $("p-file").value = "";
  $("download-photo").hidden = true;
  renderPhotoPreview();
  $("product-dialog").showModal();
}

function renderPhotoPreview() {
  const src = pendingPhoto ? pendingPhoto.url : ($("p-image").value.trim() ? IMAGE_FOLDER + $("p-image").value.trim() : "");
  const preview = $("photo-preview");
  preview.style.background = $("p-color").value;
  preview.innerHTML = `<span>${escapeHtml(($("p-name").value || "?")[0])}</span>${src ? `<img src="${escapeHtml(src)}" alt="">` : ""}`;
  removeBrokenImages(preview);
}

function saveProduct(event) {
  event.preventDefault();

  const data = {
    name: $("p-name").value.trim(),
    desc: $("p-desc").value.trim(),
    price: Number($("p-price").value),
    category: $("p-category").value.trim(),
    color: $("p-color").value,
    image: $("p-image").value.trim(),
    soldOut: $("p-soldOut").checked,
    hidden: $("p-hidden").checked,
  };

  if (editingId) {
    Object.assign(state.products.find((p) => p.id === editingId), data);
  } else {
    const id = Math.max(0, ...state.products.map((p) => p.id)) + 1;
    state.products.push({ id, ...data });
  }

  $("product-dialog").close();
  commit();
}

function handleRowAction(button) {
  const id = Number(button.dataset.id);
  const product = state.products.find((p) => p.id === id);

  if (button.dataset.action === "edit") {
    openEditor(id);
  } else if (button.dataset.action === "toggle-hidden") {
    product.hidden = !product.hidden;
    commit();
  } else if (button.dataset.action === "delete" && confirm(`Delete "${product.name}"?`)) {
    state.products = state.products.filter((p) => p.id !== id);
    commit();
  }
}


/* ==========================================================================
   5. Photos
   Photos cannot be uploaded without a server, so we resize the chosen photo
   in the browser and let you download it into your public/images/ folder.
   ========================================================================== */

const MAX_PHOTO_SIZE = 900; // longest side in pixels

async function resizePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

async function handlePhotoChoice(file) {
  if (!file) return;
  const blob = await resizePhoto(file);
  pendingPhoto = { blob, url: URL.createObjectURL(blob) };

  $("p-image").value = `${slugify($("p-name").value)}.jpg`;
  $("download-photo").hidden = false;
  renderPhotoPreview();
}


/* ==========================================================================
  6. Settings, tabs and publishing
   ========================================================================== */

const SETTING_FIELDS = ["storeName", "tagline", "sellerNumber", "currency"];

function fillSettingsForm() {
  SETTING_FIELDS.forEach((key) => { $(`set-${key}`).value = state.settings[key]; });
}

function exportData() {
  const text = `/* Catalog data. Edit in admin.html, then download a fresh data.js. */\nwindow.CATALOG = ${JSON.stringify(state, null, 2)};\n`;
  download(new Blob([text], { type: "text/javascript" }), "data.js");
}

/** Read a data.js (or .json) file and use it as the current catalog. */
async function importData(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const data = JSON.parse(json);
    if (!data.settings || !Array.isArray(data.products)) throw new Error("Not a catalog file");
    state = data;
    fillSettingsForm();
    commit();
    alert(`Imported ${data.products.length} products.`);
  } catch {
    alert("That file could not be read. Choose the data.js from your public folder.");
  }
}

function showTab(name) {
  document.querySelectorAll("[data-tab]").forEach((tab) =>
    tab.setAttribute("aria-pressed", String(tab.dataset.tab === name)));
  ["products", "settings", "publish"].forEach((id) => { $(`tab-${id}`).hidden = id !== name; });
}


/* ==========================================================================
  Events
   ========================================================================== */

  $("tabs").addEventListener("click", (e) => { if (e.target.dataset.tab) showTab(e.target.dataset.tab); });

  $("product-rows").addEventListener("click", (e) => {
    const button = e.target.closest("[data-action]");
    if (button) handleRowAction(button);
  });

  $("search").addEventListener("input", renderTable);
  $("category-filter").addEventListener("change", renderTable);
  $("add-product").addEventListener("click", () => openEditor());

  $("product-form").addEventListener("submit", saveProduct);
  $("cancel-product").addEventListener("click", () => $("product-dialog").close());
  $("p-file").addEventListener("change", (e) => handlePhotoChoice(e.target.files[0]));
  ["p-name", "p-image", "p-color"].forEach((id) => $(id).addEventListener("input", renderPhotoPreview));
  $("download-photo").addEventListener("click", () => download(pendingPhoto.blob, $("p-image").value.trim()));

  SETTING_FIELDS.forEach((key) =>
    $(`set-${key}`).addEventListener("input", (e) => {
      if (key === "sellerNumber") e.target.value = e.target.value.replace(/\D/g, ""); // digits only
      state.settings[key] = e.target.value;
      commit();
    }));

  $("import-file").addEventListener("change", (e) => importData(e.target.files[0]));
  $("export-top").addEventListener("click", exportData);
  $("export-main").addEventListener("click", exportData);
  $("reset-draft").addEventListener("click", () => {
    if (!confirm("Discard all unpublished changes?")) return;
    state = clone(PUBLISHED);
    fillSettingsForm();
    commit();
  });

  fillSettingsForm();
  renderAll();
