import app from "./expressApp";
import database from "./herokuClient";

async function startServer() {
  // Connect to the database before starting the server
  await database.connect()

  // Now start the server
  const port = process.env.PORT || 8000
  app.listen(port, () => {
    console.log("Listening on port " + port)
  })
}

startServer()