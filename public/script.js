/* ==========================================================================
   Adire & Co. catalog: script

   1. Settings (loaded from data.js)
   2. Helpers
   3. State
   4. Rendering
   5. WhatsApp message
   6. Events
   ========================================================================== */


/* ==========================================================================
   1. Settings (loaded from data.js)
   ========================================================================== */

const { settings, products } = window.CATALOG; // from data.js (edit it in admin.html)

const SELLER_NUMBER = settings.sellerNumber;
const STORE_NAME    = settings.storeName;
const CURRENCY      = settings.currency;
const IMAGE_FOLDER  = "images/";

const PRODUCTS = products.filter((product) => !product.hidden);


/* ==========================================================================
   2. Helpers
   ========================================================================== */

const $ = (id) => document.getElementById(id);

const formatPrice = (amount) => CURRENCY + amount.toLocaleString("en-NG");

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  }[char]));


/* ==========================================================================
   3. State
   ========================================================================== */

const CATEGORIES = ["All", ...new Set(PRODUCTS.map((p) => p.category))];

let activeCategory = "All";
let cart = loadCart(); // { [productId]: quantity }

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("cart")) || {};
  } catch {
    return {};
  }
}

function saveCart() {
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
  } catch {
    /* storage unavailable: the cart still works for this visit */
  }
}

function getCartItems() {
  return PRODUCTS
    .filter((product) => cart[product.id] && !product.soldOut)
    .map((product) => ({ ...product, quantity: cart[product.id] }));
}

function getCartTotal() {
  return getCartItems().reduce((sum, item) => sum + item.quantity * item.price, 0);
}

function changeQuantity(productId, delta) {
  const quantity = (cart[productId] || 0) + delta;

  if (quantity <= 0) {
    delete cart[productId];
  } else {
    cart[productId] = quantity;
  }

  saveCart();
  renderProducts();
  renderCart();
}


/* ==========================================================================
   4. Rendering
   ========================================================================== */

function renderStepper(product, quantity, modifier = "") {
  const name = escapeHtml(product.name);
  return `
    <div class="stepper ${modifier}">
      <button class="stepper__button" data-id="${product.id}" data-delta="-1" aria-label="Remove one ${name}">−</button>
      <span class="stepper__value">${quantity}</span>
      <button class="stepper__button" data-id="${product.id}" data-delta="1" aria-label="Add one ${name}">+</button>
    </div>`;
}

function renderFilters() {
  $("filters").innerHTML = CATEGORIES.map((category) => `
    <button class="filter" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">
      ${escapeHtml(category)}
    </button>`).join("");
}

function renderProductCard(product) {
  const quantity = cart[product.id] || 0;
  const image = product.image
    ? `<img src="${IMAGE_FOLDER}${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">`
    : "";

  const action = product.soldOut
    ? `<button class="button button--outline product-card__action" disabled>Sold out</button>`
    : quantity
    ? renderStepper(product, quantity, "product-card__action")
    : `<button class="button button--outline product-card__action" data-id="${product.id}" data-delta="1">Add to cart</button>`;

  return `
    <article class="product-card">
      <div class="product-card__media" style="background:${product.color}">
        <span aria-hidden="true">${escapeHtml(product.name[0])}</span>${image}
      </div>
      <div class="product-card__body">
        <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
        <small class="product-card__desc">${escapeHtml(product.desc)}</small>
        <div class="product-card__price">${formatPrice(product.price)}</div>
        ${action}
      </div>
    </article>`;
}

function renderProducts() {
  const visible = PRODUCTS.filter((p) => activeCategory === "All" || p.category === activeCategory);
  $("product-grid").innerHTML = visible.map(renderProductCard).join("");

  // If a photo file is missing, remove it so the coloured tile shows instead
  $("product-grid").querySelectorAll(".product-card__media img").forEach((img) =>
    img.addEventListener("error", () => img.remove(), { once: true }));
}

function renderCartLine(item) {
  return `
    <div class="cart-line">
      <div class="cart-line__info">
        ${escapeHtml(item.name)}
        <span class="cart-line__price">${formatPrice(item.price)} each</span>
      </div>
      ${renderStepper(item, item.quantity, "stepper--compact")}
    </div>`;
}

function renderCart() {
  const items = getCartItems();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const link = $("whatsapp-link");

  $("cart-count").textContent = count;
  $("cart-total").textContent = formatPrice(getCartTotal());

  $("cart-lines").innerHTML = items.length
    ? items.map(renderCartLine).join("")
    : `<div class="cart__empty">Your cart is empty.<br>Add something from the catalog.</div>`;

  link.setAttribute("aria-disabled", String(items.length === 0));
  link.href = items.length
    ? `https://wa.me/${SELLER_NUMBER}?text=${encodeURIComponent(buildMessage())}`
    : "#";
}


/* ==========================================================================
   5. WhatsApp message
   ========================================================================== */

function buildMessage() {
  const name    = $("customer-name").value.trim();
  const address = $("customer-address").value.trim();
  const note    = $("customer-note").value.trim();

  const lines = [
    `Hello ${STORE_NAME}, I'd like to order:`,
    "",
    ...getCartItems().map((i) => `• ${i.quantity} × ${i.name} — ${formatPrice(i.quantity * i.price)}`),
    "",
    `Total: ${formatPrice(getCartTotal())}`,
  ];

  if (name)    lines.push(`Name: ${name}`);
  if (address) lines.push(`Delivery/pickup: ${address}`);
  if (note)    lines.push(`Note: ${note}`);

  lines.push("", "Please confirm availability and payment details. Thank you!");
  return lines.join("\n");
}


/* ==========================================================================
   6. Events
   ========================================================================== */

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.id) {
    changeQuantity(Number(button.dataset.id), Number(button.dataset.delta));
  } else if (button.dataset.category) {
    activeCategory = button.dataset.category;
    renderFilters();
    renderProducts();
  }
});

["customer-name", "customer-address", "customer-note"].forEach((id) =>
  $(id).addEventListener("input", renderCart));

$("open-cart").addEventListener("click", () => $("cart-dialog").showModal());
$("close-cart").addEventListener("click", () => $("cart-dialog").close());
$("cart-dialog").addEventListener("click", (event) => {
  if (event.target === $("cart-dialog")) $("cart-dialog").close(); // click on backdrop
});

document.title = `${STORE_NAME} Catalog`;
$("store-title").textContent = STORE_NAME;
$("store-tagline").textContent = settings.tagline;

renderFilters();
renderProducts();
renderCart();
