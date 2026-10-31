import {
  getCart,
  getDeliveryOptions,
  removeFromCart,
  updateCartQuantity,
  updateDeliveryOption
} from "../data/cart.js";
import { placeOrder, getEstimatedDeliveryTime } from "../data/orders.js";
import { updateCartCount } from "./shared/header.js";

const orderSummary = document.querySelector(".js-order-summary");
const placeOrderButton = document.querySelector(".js-place-order");
const checkoutMessage = document.querySelector(".js-checkout-message");
const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;
let deliveryOptions = [];
let currentCart;

function formatDeliveryDate(date) {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function renderCheckout() {
  const { items, totals } = currentCart;
  orderSummary.innerHTML = items.length
    ? items.map((item) => {
      const selectedOption = deliveryOptions.find(
        (option) => option.id === item.deliveryOptionId
      );
      const deliveryChoices = deliveryOptions.map((option) => {
        const deliveryDate = getEstimatedDeliveryTime(option.id, new Date(), deliveryOptions);
        const shippingPrice = option.priceCents === 0
          ? "FREE Shipping"
          : `${formatPrice(option.priceCents)} - Shipping`;

        return `
          <label class="delivery-option">
            <input type="radio" class="delivery-option-input js-delivery-option"
              name="delivery-option-${item.productId}" value="${option.id}"
              data-product-id="${item.productId}"
              ${option.id === selectedOption.id ? "checked" : ""}>
            <span>
              <span class="delivery-option-date">${formatDeliveryDate(deliveryDate)}</span>
              <span class="delivery-option-price">${shippingPrice}</span>
            </span>
          </label>
        `;
      }).join("");
      const quantityChoices = Array.from({ length: 10 }, (_, index) => {
        const quantity = index + 1;
        return `<option value="${quantity}" ${quantity === item.quantity ? "selected" : ""}>${quantity}</option>`;
      }).join("");

      return `
        <div class="cart-item-container">
          <div class="delivery-date">Delivery date: ${formatDeliveryDate(item.estimatedDeliveryTime)}</div>
          <div class="cart-item-details-grid">
            <img class="product-image" src="${item.image}" alt="${item.name}">
            <div class="cart-item-details">
              <div class="product-name">${item.name}</div>
              <div class="product-price">${formatPrice(item.priceCents)}</div>
              <div class="product-quantity">
                <label>Quantity:
                  <select class="js-quantity-select" data-product-id="${item.productId}"
                    aria-label="Quantity for ${item.name}">${quantityChoices}</select>
                </label>
                <button class="link-primary js-remove-item" type="button"
                  data-product-id="${item.productId}">Delete</button>
              </div>
            </div>
            <div class="delivery-options">
              <div class="delivery-options-title">Choose a delivery option:</div>
              ${deliveryChoices}
            </div>
          </div>
        </div>
      `;
    }).join("")
    : '<div class="cart-item-container">Your cart is empty. <a href="amazon.html">Continue shopping</a>.</div>';

  document.querySelector(".js-item-count").textContent = totals.itemCount;
  document.querySelector(".js-items-total").textContent = formatPrice(totals.itemsTotalCents);
  document.querySelector(".js-shipping-total").textContent = formatPrice(totals.shippingTotalCents);
  document.querySelector(".js-subtotal").textContent =
    formatPrice(totals.itemsTotalCents + totals.shippingTotalCents);
  document.querySelector(".js-tax").textContent = formatPrice(totals.taxCents);
  document.querySelector(".js-order-total").textContent = formatPrice(totals.orderTotalCents);
  placeOrderButton.disabled = items.length === 0;
}

async function refreshCheckout() {
  currentCart = await getCart();
  renderCheckout();
  await updateCartCount();
}

orderSummary.addEventListener("change", async (event) => {
  const target = event.target;
  try {
    if (target.matches(".js-quantity-select")) {
      currentCart = await updateCartQuantity(target.dataset.productId, Number(target.value));
    } else if (target.matches(".js-delivery-option")) {
      currentCart = await updateDeliveryOption(target.dataset.productId, target.value);
    } else {
      return;
    }
    renderCheckout();
    await updateCartCount();
  } catch (error) {
    console.error(error);
  }
});

orderSummary.addEventListener("click", async (event) => {
  const removeButton = event.target.closest(".js-remove-item");
  if (!removeButton) {
    return;
  }

  try {
    currentCart = await removeFromCart(removeButton.dataset.productId);
    renderCheckout();
    await updateCartCount();
  } catch (error) {
    console.error(error);
  }
});

placeOrderButton.addEventListener("click", async () => {
  placeOrderButton.disabled = true;
  try {
    const order = await placeOrder();
    checkoutMessage.hidden = false;
    checkoutMessage.innerHTML = `Order placed successfully. <a href="orders.html">View your orders</a>.`;
    checkoutMessage.dataset.orderId = order.id;
    await refreshCheckout();
  } catch (error) {
    console.error(error);
    placeOrderButton.disabled = currentCart.items.length === 0;
  }
});

async function initializeCheckout() {
  try {
    [deliveryOptions, currentCart] = await Promise.all([
      getDeliveryOptions(),
      getCart()
    ]);
    renderCheckout();
    await updateCartCount();
  } catch (error) {
    console.error(error);
  }
}

initializeCheckout();
