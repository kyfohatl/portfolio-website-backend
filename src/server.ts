import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"

import { AuthUser } from "./custom"
import { router } from "./routes/authserver"
import database from "./herokuClient"
import { authenticateToken } from "./middleware/auth"

// Start up express
const app = express()
app.use(express.json())
// Setup cors
app.use(cors())


interface User {
  name: string,
  password: string
}

const users: User[] = []

// Authentication routes
app.use("/auth", router)

app.get("/test", authenticateToken, (req, res) => {
  res.json("Hello you are authenticated")
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log("Listening on port " + port)
})