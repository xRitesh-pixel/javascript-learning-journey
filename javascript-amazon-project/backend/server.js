import { createApp, getDefaultPaths } from "./app.js";
import { createDatabase } from "./database.js";

const paths = getDefaultPaths();
const database = createDatabase(paths.database, paths.products);
const app = createApp(database);
const port = Number(process.env.PORT || 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = app.listen(port, () => {
  console.log(`Storefront server listening on http://localhost:${port}`);
});

function shutDown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
