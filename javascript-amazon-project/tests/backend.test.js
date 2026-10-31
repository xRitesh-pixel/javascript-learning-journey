import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { createApp } from "../backend/app.js";
import { createDatabase } from "../backend/database.js";

const activeServers = [];

async function withServer(run) {
  const database = createDatabase(
    ":memory:",
    new URL("../backend/products.json", import.meta.url)
  );
  const server = createApp(database).listen(0);
  activeServers.push({ server, database });
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  let cookie = "";

  const send = async (endpoint, options = {}, sessionCookie = cookie, captureCookie = true) => {
    const headers = new Headers(options.headers);
    if (sessionCookie) {
      headers.set("Cookie", sessionCookie);
    }
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}${endpoint}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie && captureCookie) {
      cookie = setCookie.split(";")[0];
    }
    return response;
  };
  const request = (endpoint, options) => send(endpoint, options);
  request.asSession = (endpoint, sessionCookie, options) =>
    send(endpoint, options, sessionCookie, false);

  return run(request);
}

async function openServer(databasePath) {
  const database = createDatabase(
    databasePath,
    new URL("../backend/products.json", import.meta.url)
  );
  const server = createApp(database).listen(0);
  const resources = { server, database };
  activeServers.push(resources);
  await new Promise((resolve) => server.once("listening", resolve));
  resources.baseUrl = `http://127.0.0.1:${server.address().port}`;
  return resources;
}

async function closeServer(resources) {
  const activeIndex = activeServers.indexOf(resources);
  if (activeIndex !== -1) {
    activeServers.splice(activeIndex, 1);
  }
  await new Promise((resolve, reject) => {
    resources.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resources.database.close();
      resolve();
    });
  });
}

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map(({ server, database }) =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        database.close();
        resolve();
      });
    })));
});

test("serves catalog and isolates carts by anonymous session cookie", async () => {
  await withServer(async (request) => {
    const catalogResponse = await request("/api/products");
    const products = await catalogResponse.json();
    assert.equal(catalogResponse.status, 200);
    assert.equal(products.length, 42);

    const cookie = catalogResponse.headers.get("set-cookie").split(";")[0];
    const productId = products[0].id;
    const addResponse = await request("/api/cart/items", {
      method: "POST",
      body: { productId, quantity: 2 }
    });
    const cart = await addResponse.json();
    assert.equal(cart.items[0].quantity, 2);
    assert.equal(cart.totals.itemCount, 2);

    const anotherSession = await fetch(
      new URL("/api/cart", catalogResponse.url),
      { headers: { Cookie: `${cookie.split("=")[0]}=00000000-0000-4000-8000-000000000001` } }
    );
    const isolatedCart = await anotherSession.json();
    assert.equal(isolatedCart.items.length, 0);
  });
});

test("validates cart writes and computes authoritative order totals", async () => {
  await withServer(async (request) => {
    const products = await (await request("/api/products")).json();
    const product = products[0];
    const invalid = await request("/api/cart/items", {
      method: "POST",
      body: { productId: product.id, quantity: 11 }
    });
    assert.equal(invalid.status, 400);

    await request("/api/cart/items", {
      method: "POST",
      body: { productId: product.id, quantity: 2 }
    });
    await request(`/api/cart/items/${product.id}/delivery`, {
      method: "PATCH",
      body: { deliveryOptionId: "2" }
    });

    const orderResponse = await request("/api/orders", {
      method: "POST",
      body: { totalCents: 1 }
    });
    const order = await orderResponse.json();
    assert.equal(orderResponse.status, 201);
    assert.equal(order.totalCents, 2 * product.priceCents + 499 + Math.round(2 * product.priceCents * 0.1));
    assert.equal(order.products[0].quantity, 2);
    assert.equal((await (await request("/api/cart")).json()).items.length, 0);

    const storedOrders = await (await request("/api/orders")).json();
    assert.equal(storedOrders.length, 1);
    assert.equal(storedOrders[0].id, order.id);
  });
});

test("rejects tracking orders owned by another session", async () => {
  await withServer(async (request) => {
    const product = (await (await request("/api/products")).json())[0];
    await request("/api/cart/items", {
      method: "POST",
      body: { productId: product.id, quantity: 1 }
    });
    const order = await (await request("/api/orders", {
      method: "POST",
      body: {}
    })).json();

    const response = await request.asSession(
      `/api/orders/${order.id}`,
      "amazon_demo_session=00000000-0000-4000-8000-000000000002"
    );
    assert.equal(response.status, 404);
  });
});

test("keeps a cart after the database and server are restarted", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "amazon-store-test-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const databasePath = path.join(directory, "store.sqlite");
  const firstServer = await openServer(databasePath);
  const catalogResponse = await fetch(`${firstServer.baseUrl}/api/products`);
  const product = (await catalogResponse.json())[0];
  const cookie = catalogResponse.headers.get("set-cookie").split(";")[0];
  const addResponse = await fetch(`${firstServer.baseUrl}/api/cart/items`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ productId: product.id, quantity: 3 })
  });
  assert.equal(addResponse.status, 201);
  await closeServer(firstServer);

  const restartedServer = await openServer(databasePath);
  const cartResponse = await fetch(`${restartedServer.baseUrl}/api/cart`, {
    headers: { Cookie: cookie }
  });
  const cart = await cartResponse.json();
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 3);
  await closeServer(restartedServer);
});
