import app, { isRunningInTestEnv } from "./expressApp";
import Database from "./lib/Database";

async function startServer() {
  // Set the correct database url depending on whether we are running a test environment or production
  let DATABASE_URL: string = process.env.DATABASE_URL as string
  if (isRunningInTestEnv()) {
    DATABASE_URL = process.env.TEST_DATABASE_URL as string
  }

  // Setup the database
  await Database.initialize(DATABASE_URL)

  // Now start the server
  const port = process.env.PORT || 8000
  app.listen(port, () => {
    console.log("Listening on port " + port)
  })
}

startServer()