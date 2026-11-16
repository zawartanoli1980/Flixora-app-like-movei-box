import { openStore } from "../server/platform/store.js";
import { configureDemo, demoStatus } from "../server/platform/demo-catalog.js";
const action = process.argv[2] || "seed";
const { db } = openStore();
try {
  const result =
    action === "status" ? demoStatus(db) : configureDemo(db, action);
  console.log(
    `Demo catalog ${result.enabled ? "enabled" : "disabled"}: ${result.titleCount} fictional title previews and ${result.episodeCount} sample episodes. No playable videos or payment records are added.`,
  );
} finally {
  db.close();
}
