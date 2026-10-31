import { apiRequest } from "./api.js";

export async function getCart() {
  return apiRequest("/cart");
}

export async function getDeliveryOptions() {
  return apiRequest("/delivery-options");
}

export async function addToCart(productId, quantity = 1) {
  return apiRequest("/cart/items", {
    method: "POST",
    body: { productId, quantity }
  });
}

export async function updateCartQuantity(productId, quantity) {
  return apiRequest(`/cart/items/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    body: { quantity }
  });
}

export async function removeFromCart(productId) {
  return apiRequest(`/cart/items/${encodeURIComponent(productId)}`, {
    method: "DELETE"
  });
}

export async function updateDeliveryOption(productId, deliveryOptionId) {
  return apiRequest(
    `/cart/items/${encodeURIComponent(productId)}/delivery`,
    {
      method: "PATCH",
      body: { deliveryOptionId }
    }
  );
}
