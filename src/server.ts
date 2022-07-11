import app from "./expressApp";
import Database from "./lib/Database";

async function startServer() {
  // Setup the database
  await Database.initialize(process.env.DATABASE_URL as string)

  // Now start the server
  const port = process.env.PORT || 8000
  app.listen(port, () => {
    console.log("Listening on port " + port)
  })
}

startServer()