import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export function createDatabase(databasePath, productsPath) {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      product_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      session_id TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
      delivery_option_id TEXT NOT NULL CHECK (delivery_option_id IN ('1', '2', '3')),
      PRIMARY KEY (session_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      order_time TEXT NOT NULL,
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0)
    );

    CREATE INDEX IF NOT EXISTS orders_by_session
      ON orders (session_id, order_time DESC);

    CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
      delivery_option_id TEXT NOT NULL,
      estimated_delivery_time TEXT NOT NULL,
      product_json TEXT NOT NULL,
      PRIMARY KEY (order_id, product_id)
    );
  `);

  const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("The product catalog must be a non-empty JSON array.");
  }

  const saveProduct = database.prepare(`
    INSERT INTO products (id, product_json) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET product_json = excluded.product_json
  `);
  const seedProducts = database.transaction((catalog) => {
    for (const product of catalog) {
      if (typeof product.id !== "string" || !Number.isInteger(product.priceCents)) {
        throw new Error("Product catalog contains an invalid product.");
      }
      saveProduct.run(product.id, JSON.stringify(product));
    }
  });
  seedProducts(products);

  return database;
}
