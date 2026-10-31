import { apiRequest } from "./api.js";

export async function getOrders() {
  return apiRequest("/orders");
}

export async function getOrder(orderId) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}`);
}

export async function placeOrder() {
  return apiRequest("/orders", {
    method: "POST",
    body: {}
  });
}

export function getEstimatedDeliveryTime(deliveryOptionId, fromDate = new Date(), options = []) {
  const option = options.find((candidate) => candidate.id === deliveryOptionId);
  if (!option) {
    throw new Error(`Unknown delivery option: ${deliveryOptionId}`);
  }

  const deliveryDate = new Date(fromDate);
  deliveryDate.setDate(deliveryDate.getDate() + option.deliveryDays);
  return deliveryDate.toISOString();
}
