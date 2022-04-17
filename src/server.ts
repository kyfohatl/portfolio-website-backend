import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"

import { AuthUser } from "./custom"
import { router as authRouter } from "./routes/authserver"
import database from "./herokuClient"
import { authenticateToken } from "./middleware/auth"
import {router as blogRouter} from "./routes/blog"

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
app.use("/auth", authRouter)
// Blog routes
app.use("/blog", blogRouter)

app.get("/test", authenticateToken, (req, res) => {
  res.json("Hello you are authenticated")
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log("Listening on port " + port)
})