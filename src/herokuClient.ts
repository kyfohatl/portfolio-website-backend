import { Client } from "pg"

// Setup database connection
const database = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

database.connect()

export default database