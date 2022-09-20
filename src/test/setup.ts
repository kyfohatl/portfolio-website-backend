import dotenv from "dotenv"
import Database from "../lib/Database"

export default async function runTestEnvSetup() {
  // Dot env is not running. Start it
  if (!process.env.DOT_ENV_IS_RUNNING) {
    dotenv.config()
  }

  // Setup database client
  await Database.initialize(process.env.TEST_DATABASE_URL as string)
}