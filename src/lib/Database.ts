import { Client } from "pg";

export default class Database {
  // The actual database client
  static #client: Client | undefined

  // Creates the client and starts the database connection
  static async initialize(connectionString: string) {
    // Create the client
    Database.#client = new Client({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    })

    // Start the connection
    await Database.#client.connect()
  }

  // Closes the database connection if it exists
  static async closeConnection() {
    if (!Database.#client) throw new Error("Client not initialized!")
    await Database.#client.end()
  }

  // Returns the client instance if it exists, otherwise throws an error
  static getClient(): Client {
    if (!Database.#client) throw new Error("Client not initialized!")
    return Database.#client
  }

  // Clears all rows of all tables in the database
  static async clearDb() {
    const queryStr = `
      BEGIN;
      TRUNCATE TABLE refresh_tokens CASCADE;
      TRUNCATE TABLE blog_tags CASCADE;
      TRUNCATE TABLE blogs CASCADE;
      TRUNCATE TABLE auth_providers CASCADE;
      TRUNCATE TABLE users CASCADE;
      COMMIT;
    `
    const promise = new Promise<void>((resolve, reject) => {
      Database.getClient().query(queryStr, (err, data) => {
        if (err) return reject(err)
        return resolve()
      })
    })

    return promise
  }
}