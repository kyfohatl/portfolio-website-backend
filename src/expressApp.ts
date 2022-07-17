import dotenv from "dotenv"

if (!process.env.DOT_ENV_IS_RUNNING) {
  // Dot env is not running. Start it
  dotenv.config()
}

import express from "express"
import cors from "cors"

import { router as authRouter } from "./routes/auth"
import { router as blogRouter } from "./routes/blog"
import cookieParser from "cookie-parser"

// Start up express
const app = express()
app.use(express.json())
app.use(cookieParser())
// Setup cors
app.use(cors({
  origin: [process.env.FRONTEND_SERVER_ADDR + "", process.env.BACKEND_SERVER_ADDR + ""],
  credentials: true
}))


interface User {
  name: string,
  password: string
}

const users: User[] = []

// Authentication routes
app.use("/auth", authRouter)
// Blog routes
app.use("/blog", blogRouter)

export default app