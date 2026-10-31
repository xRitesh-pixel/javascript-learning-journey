import { addToCart } from "../data/cart.js";
import { apiRequest } from "../data/api.js";
import { setupSearch, updateCartCount } from "./shared/header.js";

const productsGrid = document.querySelector(".js-products-grid");
const searchBar = document.querySelector(".js-search-bar");
const emptySearchMessage = document.querySelector(".js-empty-search");
let products = [];

function renderProducts() {
  productsGrid.innerHTML = products.map((product) => `
    <div class="product-container" data-product-id="${product.id}"
      data-product-name="${product.name.toLowerCase()}">
      <div class="product-image-container">
        <img class="product-image" src="${product.image}" alt="${product.name}">
      </div>
      <div class="product-name limit-text-to-2-lines">${product.name}</div>
      <div class="product-rating-container">
        <img class="product-rating-stars"
          src="images/ratings/rating-${product.rating.stars * 10}.png"
          alt="${product.rating.stars} out of 5 stars">
        <div class="product-rating-count link-primary">${product.rating.count}</div>
      </div>
      <div class="product-price">${(product.priceCents / 100).toFixed(2)}</div>
      <div class="product-quantity-container">
        <select aria-label="Quantity for ${product.name}">
          ${Array.from({ length: 10 }, (_, index) =>
    `<option value="${index + 1}" ${index === 0 ? "selected" : ""}>${index + 1}</option>`
  ).join("")}
        </select>
      </div>
      <div class="product-spacer"></div>
      <div class="added-to-cart"><img src="images/icons/checkmark.png" alt="">Added</div>
      <button class="add-to-cart-button button-primary js-add-to-cart"
        data-product-id="${product.id}" type="button">Add to Cart</button>
    </div>
  `).join("");

  filterProducts();
}

function filterProducts() {
  const searchTerm = searchBar.value.trim().toLowerCase();
  let visibleProducts = 0;

  document.querySelectorAll(".product-container").forEach((productElement) => {
    const product = products.find((candidate) => candidate.id === productElement.dataset.productId);
    const matchesSearch = productElement.dataset.productName.includes(searchTerm)
      || product.keywords.some((keyword) => keyword.toLowerCase().includes(searchTerm));
    productElement.hidden = !matchesSearch;
    visibleProducts += matchesSearch ? 1 : 0;
  });

  emptySearchMessage.hidden = visibleProducts > 0;
}

productsGrid.addEventListener("click", async (event) => {
  const button = event.target.closest(".js-add-to-cart");
  if (!button) {
    return;
  }

  const productContainer = button.closest(".product-container");
  try {
    await addToCart(button.dataset.productId, Number(productContainer.querySelector("select").value));
    await updateCartCount();
    const addedMessage = productContainer.querySelector(".added-to-cart");
    addedMessage.style.opacity = "1";
    window.setTimeout(() => {
      addedMessage.style.opacity = "0";
    }, 1500);
  } catch (error) {
    console.error(error);
  }
});

async function initializeCatalog() {
  try {
    products = await apiRequest("/products");
    renderProducts();
    await updateCartCount();
  } catch (error) {
    console.error(error);
  }
}

searchBar.addEventListener("input", filterProducts);
searchBar.value = new URLSearchParams(window.location.search).get("search") || "";
setupSearch(filterProducts);
initializeCatalog();
