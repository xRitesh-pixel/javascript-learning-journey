import { getOrder } from "../data/orders.js";
import { setupSearch, updateCartCount } from "./shared/header.js";

const tracking = document.querySelector(".js-order-tracking");
const searchParams = new URLSearchParams(window.location.search);
const requestedOrderId = searchParams.get("orderId");
const requestedProductId = searchParams.get("productId");

function getDeliveryStatus(order, item) {
  const placedTime = new Date(order.orderTime).getTime();
  const deliveryTime = new Date(item.estimatedDeliveryTime).getTime();
  const now = Date.now();
  const progress = Math.min(1, Math.max(0, (now - placedTime) / (deliveryTime - placedTime)));

  if (progress >= 1) {
    return { label: "Delivered", width: "100%" };
  }
  if (progress >= 0.4) {
    return { label: "Shipped", width: "60%" };
  }
  return { label: "Preparing", width: "20%" };
}

function renderTracking(order) {
  const item = order.products.find((product) => product.productId === requestedProductId);
  if (!item) {
    tracking.innerHTML = `
      <a class="back-to-orders-link link-primary" href="orders.html">View all orders</a>
      <p>This product is not part of the selected order.</p>
    `;
    return;
  }

  const deliveryDate = new Date(item.estimatedDeliveryTime).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  const status = getDeliveryStatus(order, item);
  tracking.innerHTML = `
    <a class="back-to-orders-link link-primary" href="orders.html">View all orders</a>
    <div class="delivery-date">Arriving on ${deliveryDate}</div>
    <div class="product-info">${item.name}</div>
    <div class="product-info">Quantity: ${item.quantity}</div>
    <img class="product-image" src="${item.image}" alt="${item.name}">
    <div class="progress-labels-container">
      <div class="progress-label ${status.label === "Preparing" ? "current-status" : ""}">Preparing</div>
      <div class="progress-label ${status.label === "Shipped" ? "current-status" : ""}">Shipped</div>
      <div class="progress-label ${status.label === "Delivered" ? "current-status" : ""}">Delivered</div>
    </div>
    <div class="progress-bar-container" role="progressbar"
      aria-label="Delivery progress" aria-valuemin="0" aria-valuemax="100"
      aria-valuenow="${Number.parseInt(status.width, 10)}">
      <div class="progress-bar" style="width: ${status.width}"></div>
    </div>
  `;
}

async function initializeTracking() {
  if (!requestedOrderId) {
    tracking.innerHTML = `
      <a class="back-to-orders-link link-primary" href="orders.html">View all orders</a>
      <p>No order is available to track yet. Place an order first.</p>
    `;
    await updateCartCount();
    return;
  }

  try {
    const order = await getOrder(requestedOrderId);
    renderTracking(order);
    await updateCartCount();
  } catch (error) {
    if (error.message === "Order not found.") {
      tracking.innerHTML = `
        <a class="back-to-orders-link link-primary" href="orders.html">View all orders</a>
        <p>That order could not be found.</p>
      `;
    }
    console.error(error);
  }
}

setupSearch();
initializeTracking();
