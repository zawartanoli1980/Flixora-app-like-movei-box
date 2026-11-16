import { openStore, createOwner } from "../server/platform/store.js";
const { db } = openStore();
try {
  createOwner(db, process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD);
  console.log(
    "Initial owner created. Remove OWNER_PASSWORD from your environment.",
  );
} finally {
  db.close();
}
