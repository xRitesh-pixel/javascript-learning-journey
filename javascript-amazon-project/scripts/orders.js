import { addToCart } from "../data/cart.js";
import { getOrders } from "../data/orders.js";
import { setupSearch, updateCartCount } from "./shared/header.js";

const ordersGrid = document.querySelector(".js-orders-grid");
const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;
const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric"
});

function renderOrders(orders) {
  ordersGrid.innerHTML = orders.length
    ? orders.map((order) => `
        <section class="order-container">
          <div class="order-header">
            <div class="order-header-left-section">
              <div class="order-date">
                <div class="order-header-label">Order Placed:</div>
                <div>${formatDate(order.orderTime)}</div>
              </div>
              <div class="order-total">
                <div class="order-header-label">Total:</div>
                <div>${formatPrice(order.totalCents)}</div>
              </div>
            </div>
            <div class="order-header-right-section">
              <div class="order-header-label">Order ID:</div>
              <div>${order.id}</div>
            </div>
          </div>
          <div class="order-details-grid">
            ${order.products.map((item) => `
              <div class="product-image-container">
                <img src="${item.image}" alt="${item.name}">
              </div>
              <div class="product-details">
                <div class="product-name">${item.name}</div>
                <div class="product-delivery-date">Arriving on: ${formatDate(item.estimatedDeliveryTime)}</div>
                <div class="product-quantity">Quantity: ${item.quantity}</div>
                <button class="buy-again-button button-primary js-buy-again"
                  type="button" data-product-id="${item.productId}" data-quantity="${item.quantity}">
                  <img class="buy-again-icon" src="images/icons/buy-again.png" alt="">
                  <span class="buy-again-message">Buy it again</span>
                </button>
              </div>
              <div class="product-actions">
                <a class="track-package-button button-secondary"
                  href="tracking.html?orderId=${encodeURIComponent(order.id)}&amp;productId=${encodeURIComponent(item.productId)}">
                  Track package
                </a>
              </div>
            `).join("")}
          </div>
        </section>
      `).join("")
    : '<p>You have not placed any orders yet. <a href="amazon.html">Start shopping</a>.</p>';
}

ordersGrid.addEventListener("click", async (event) => {
  const buyAgainButton = event.target.closest(".js-buy-again");
  if (!buyAgainButton) {
    return;
  }

  try {
    await addToCart(
      buyAgainButton.dataset.productId,
      Number(buyAgainButton.dataset.quantity)
    );
    buyAgainButton.querySelector(".buy-again-message").textContent = "Added to cart";
    await updateCartCount();
  } catch (error) {
    console.error(error);
  }
});

async function initializeOrders() {
  try {
    const orders = await getOrders();
    renderOrders(orders);
    await updateCartCount();
  } catch (error) {
    console.error(error);
  }
}

setupSearch();
initializeOrders();
