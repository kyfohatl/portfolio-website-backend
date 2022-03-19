import dotenv from "dotenv"
dotenv.config()

import express, { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

import { AuthUser } from "./custom"

const app = express()
app.use(express.json())


interface User {
  name: string,
  password: string
}

const users: User[] = []

app.get("/users", authenticateToken, (req, res) => {
  res.json(users)
})

app.listen(8000, () => {
  console.log("Listening on port 8000")
})

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(" ")[1]

  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err, authUser) => {
    if (err) return res.sendStatus(403)

    req.authUser = authUser as AuthUser
    next()
  })
}