import { Client } from "pg"
import dotenv from "dotenv"

if (!process.env.DOT_ENV_IS_RUNNING) {
  // Dot env is not running. Start it
  dotenv.config()
}

// Setup database connection
const database = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

export default database