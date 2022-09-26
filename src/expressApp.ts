import dotenv from "dotenv"

if (!process.env.DOT_ENV_IS_RUNNING) {
  // Dot env is not running. Start it
  dotenv.config()
}

import express from "express"
import cors from "cors"

import { router as authRouter } from "./routes/auth"
import { router as blogRouter } from "./routes/blog"
import { router as testAuthRouter } from "./test/test_routes/auth"
import { router as testGeneralRouter } from "./test/test_routes/general"
import cookieParser from "cookie-parser"
import bodyParser from "body-parser"

// Start up express
const app = express()
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
// Setup cors
app.use(cors({
  origin: [process.env.FRONTEND_SERVER_ADDR + "", process.env.BACKEND_SERVER_ADDR + "", "http://localhost"],
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

export function isRunningInTestEnv() {
  return process.argv.includes("-t")
}

// If running in a test environment, also add test routes
if (isRunningInTestEnv()) {
  app.use("/test/auth", testAuthRouter)
  app.use("/test/general", testGeneralRouter)
}

export default app