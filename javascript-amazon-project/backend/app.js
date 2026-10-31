import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(backendDirectory, "..");
const SESSION_COOKIE = "amazon_demo_session";
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const deliveryOptions = [
  { id: "1", deliveryDays: 7, priceCents: 0 },
  { id: "2", deliveryDays: 3, priceCents: 499 },
  { id: "3", deliveryDays: 1, priceCents: 999 }
];

function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) {
      return [];
    }
    return [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()]];
  }));
}

function getEstimatedDeliveryTime(deliveryOptionId, fromDate = new Date()) {
  const option = deliveryOptions.find((candidate) => candidate.id === deliveryOptionId);
  if (!option) {
    throw apiError(400, "Choose a valid delivery option.");
  }

  const deliveryDate = new Date(fromDate);
  deliveryDate.setDate(deliveryDate.getDate() + option.deliveryDays);
  return deliveryDate.toISOString();
}

function calculateTotals(items) {
  const itemsTotalCents = items.reduce(
    (total, item) => total + item.priceCents * item.quantity,
    0
  );
  const shippingTotalCents = items.reduce((total, item) => {
    const option = deliveryOptions.find((candidate) => candidate.id === item.deliveryOptionId);
    if (!option) {
      throw apiError(500, "A cart item has an invalid delivery option.");
    }
    return total + option.priceCents;
  }, 0);
  const taxCents = Math.round(itemsTotalCents * 0.1);

  return {
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    itemsTotalCents,
    shippingTotalCents,
    taxCents,
    orderTotalCents: itemsTotalCents + shippingTotalCents + taxCents
  };
}

export function createApp(database) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.use("/api", (request, response, next) => {
    const cookies = parseCookies(request.headers.cookie);
    const existingId = cookies[SESSION_COOKIE];
    const sessionId = existingId && SESSION_ID_PATTERN.test(existingId)
      ? existingId
      : crypto.randomUUID();

    request.sessionId = sessionId;
    if (sessionId !== existingId) {
      response.append(
        "Set-Cookie",
        `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
      );
    }
    next();
  });

  const findProduct = database.prepare(
    "SELECT product_json FROM products WHERE id = ?"
  );
  const readCartRows = database.prepare(`
    SELECT cart_items.product_id, cart_items.quantity, cart_items.delivery_option_id,
      products.product_json
    FROM cart_items
    JOIN products ON products.id = cart_items.product_id
    WHERE cart_items.session_id = ?
    ORDER BY cart_items.rowid
  `);
  const getCart = (sessionId) => {
    const items = readCartRows.all(sessionId).map((row) => {
      const product = JSON.parse(row.product_json);
      return {
        ...product,
        productId: row.product_id,
        quantity: row.quantity,
        deliveryOptionId: row.delivery_option_id,
        estimatedDeliveryTime: getEstimatedDeliveryTime(row.delivery_option_id)
      };
    });
    return { items, totals: calculateTotals(items) };
  };

  app.get("/api/products", (request, response) => {
    const products = database.prepare(
      "SELECT product_json FROM products ORDER BY rowid"
    ).all().map((row) => JSON.parse(row.product_json));
    response.json(products);
  });

  app.get("/api/delivery-options", (request, response) => {
    response.json(deliveryOptions);
  });

  app.get("/api/cart", (request, response) => {
    response.json(getCart(request.sessionId));
  });

  app.post("/api/cart/items", (request, response) => {
    const { productId, quantity = 1 } = request.body ?? {};
    if (typeof productId !== "string" || !Number.isInteger(quantity)
      || quantity < 1 || quantity > 10) {
      throw apiError(400, "Provide a product ID and a quantity from 1 to 10.");
    }
    if (!findProduct.get(productId)) {
      throw apiError(404, "Product not found.");
    }

    const currentItem = database.prepare(`
      SELECT quantity FROM cart_items WHERE session_id = ? AND product_id = ?
    `).get(request.sessionId, productId);
    if ((currentItem?.quantity ?? 0) + quantity > 10) {
      throw apiError(400, "A cart item cannot exceed a quantity of 10.");
    }

    database.prepare(`
      INSERT INTO cart_items (session_id, product_id, quantity, delivery_option_id)
      VALUES (?, ?, ?, '1')
      ON CONFLICT(session_id, product_id)
      DO UPDATE SET quantity = quantity + excluded.quantity
    `).run(request.sessionId, productId, quantity);
    response.status(201).json(getCart(request.sessionId));
  });

  app.patch("/api/cart/items/:productId", (request, response) => {
    const { quantity } = request.body ?? {};
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw apiError(400, "Quantity must be an integer from 1 to 10.");
    }
    const result = database.prepare(`
      UPDATE cart_items SET quantity = ?
      WHERE session_id = ? AND product_id = ?
    `).run(quantity, request.sessionId, request.params.productId);
    if (result.changes === 0) {
      throw apiError(404, "Cart item not found.");
    }
    response.json(getCart(request.sessionId));
  });

  app.patch("/api/cart/items/:productId/delivery", (request, response) => {
    const { deliveryOptionId } = request.body ?? {};
    if (!deliveryOptions.some((option) => option.id === deliveryOptionId)) {
      throw apiError(400, "Choose a valid delivery option.");
    }
    const result = database.prepare(`
      UPDATE cart_items SET delivery_option_id = ?
      WHERE session_id = ? AND product_id = ?
    `).run(deliveryOptionId, request.sessionId, request.params.productId);
    if (result.changes === 0) {
      throw apiError(404, "Cart item not found.");
    }
    response.json(getCart(request.sessionId));
  });

  app.delete("/api/cart/items/:productId", (request, response) => {
    const result = database.prepare(`
      DELETE FROM cart_items WHERE session_id = ? AND product_id = ?
    `).run(request.sessionId, request.params.productId);
    if (result.changes === 0) {
      throw apiError(404, "Cart item not found.");
    }
    response.json(getCart(request.sessionId));
  });

  app.post("/api/orders", (request, response) => {
    const cart = getCart(request.sessionId);
    if (cart.items.length === 0) {
      throw apiError(400, "Cannot place an order with an empty cart.");
    }

    const orderId = crypto.randomUUID();
    const orderTime = new Date().toISOString();
    const saveOrder = database.transaction(() => {
      database.prepare(`
        INSERT INTO orders (id, session_id, order_time, total_cents)
        VALUES (?, ?, ?, ?)
      `).run(orderId, request.sessionId, orderTime, cart.totals.orderTotalCents);

      const saveItem = database.prepare(`
        INSERT INTO order_items (
          order_id, product_id, quantity, delivery_option_id,
          estimated_delivery_time, product_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of cart.items) {
        const { productId, quantity, deliveryOptionId, estimatedDeliveryTime, ...product } = item;
        saveItem.run(
          orderId,
          productId,
          quantity,
          deliveryOptionId,
          estimatedDeliveryTime,
          JSON.stringify(product)
        );
      }
      database.prepare("DELETE FROM cart_items WHERE session_id = ?")
        .run(request.sessionId);
    });
    saveOrder();

    const order = {
      id: orderId,
      orderTime,
      totalCents: cart.totals.orderTotalCents,
      products: cart.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        priceCents: item.priceCents,
        quantity: item.quantity,
        deliveryOptionId: item.deliveryOptionId,
        estimatedDeliveryTime: item.estimatedDeliveryTime
      }))
    };
    response.status(201).json(order);
  });

  const getOrders = database.prepare(`
    SELECT id, order_time, total_cents FROM orders
    WHERE session_id = ? ORDER BY order_time DESC
  `);
  const getOrderItems = database.prepare(`
    SELECT product_id, quantity, delivery_option_id,
      estimated_delivery_time, product_json
    FROM order_items WHERE order_id = ?
  `);
  const serializeOrder = (row) => ({
    id: row.id,
    orderTime: row.order_time,
    totalCents: row.total_cents,
    products: getOrderItems.all(row.id).map((item) => ({
      ...JSON.parse(item.product_json),
      productId: item.product_id,
      quantity: item.quantity,
      deliveryOptionId: item.delivery_option_id,
      estimatedDeliveryTime: item.estimated_delivery_time
    }))
  });

  app.get("/api/orders", (request, response) => {
    response.json(getOrders.all(request.sessionId).map(serializeOrder));
  });

  app.get("/api/orders/:orderId", (request, response) => {
    const order = database.prepare(`
      SELECT id, order_time, total_cents FROM orders
      WHERE id = ? AND session_id = ?
    `).get(request.params.orderId, request.sessionId);
    if (!order) {
      throw apiError(404, "Order not found.");
    }
    response.json(serializeOrder(order));
  });

  app.use("/api", (request, response, next) => {
    next(apiError(404, "API endpoint not found."));
  });

  app.get(["/", "/amazon.html"], (request, response) => {
    response.sendFile(path.join(projectDirectory, "amazon.html"));
  });
  app.get("/checkout.html", (request, response) => {
    response.sendFile(path.join(projectDirectory, "checkout.html"));
  });
  app.get("/orders.html", (request, response) => {
    response.sendFile(path.join(projectDirectory, "orders.html"));
  });
  app.get("/tracking.html", (request, response) => {
    response.sendFile(path.join(projectDirectory, "tracking.html"));
  });
  for (const directory of ["images", "styles", "scripts", "data"]) {
    app.use(`/${directory}`, express.static(path.join(projectDirectory, directory)));
  }

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const candidateStatus = error.status ?? error.statusCode;
    const status = Number.isInteger(candidateStatus) ? candidateStatus : 500;
    if (status >= 500) {
      console.error(error);
    }
    response.status(status).json({
      error: {
        message: status >= 500 ? "An unexpected server error occurred." : error.message
      }
    });
  });

  return app;
}

export function getDefaultPaths() {
  return {
    database: process.env.DATABASE_PATH || path.join(projectDirectory, "data", "store.sqlite"),
    products: process.env.PRODUCTS_PATH || path.join(backendDirectory, "products.json")
  };
}
