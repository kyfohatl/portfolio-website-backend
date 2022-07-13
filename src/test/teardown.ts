import Database from "../lib/Database";

export default async function runTestEnvTeardown() {
  // Close database connection
  await Database.closeConnection()
}