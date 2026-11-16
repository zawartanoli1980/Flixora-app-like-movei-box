import { startImportWorker } from "./imports.js";
import { openStore } from "./store.js";
import { createPlatformApp, metadata } from "./app.js";
import { startWorker } from "./worker.js";
const store = openStore();
const stop = startWorker(store);
const stopImports = startImportWorker(store, metadata);
const server = createPlatformApp(store).listen(
  Number(process.env.PORT || 3201),
  "0.0.0.0",
  (error) => {
    if (error) {
      console.error("API startup failed:", error.code);
      process.exitCode = 1;
      stop();
      stopImports();
      store.db.close();
    } else
      console.log(
        "Flixora real-content API listening; no demo catalog enabled.",
      );
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stop();
    stopImports();
    server.close(() => {
      store.db.close();
      process.exit(0);
    });
    server.closeAllConnections();
  });
