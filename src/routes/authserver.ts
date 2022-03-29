import dotenv from "dotenv"
dotenv.config()

import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

import { AuthUser } from "../custom"

export const router = express.Router()
router.use(express.json())


interface User {
  name: string,
  password: string
}

const users: User[] = []

let refreshTokens: string[] = []

// Create a new user with the given username and password
router.post("/users", async (req, res) => {

  try {
    const passHash: string = await bcrypt.hash(req.body.password, 10)
    const user: User = {
      name: req.body.name,
      password: passHash
    }

    users.push(user)
    res.status(201).send("New user added")
  } catch {
    res.status(500).send()
  }
})

// Login the given user with the given username and password, if correct
router.post("/users/login", async (req, res) => {
  const user = users.find(user => user.name === req.body.name)
  if (user == null) {
    // Username does not exist
    return res.status(400).send("Username or password is incorrect")
  }

  // Check if password hashes match
  try {
    if (await bcrypt.compare(req.body.password, user.password)) {
      // Correct credentials. Send access & refresh token pair
      const authUser: AuthUser = { name: user.name }
      res.json(generateTokenPair(authUser))
    } else {
      // Incorrect credentials
      res.status(400).send("Username or password is incorrect")
    }
  } catch {
    res.status(500).send()
  }
})

// Generates a new access & refresh token pair if the given refresh token is valid
router.post("/token", (req, res) => {
  const refreshToken: string = req.body.token
  if (!refreshToken) return res.sendStatus(401)
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403)

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string, (err, user) => {
    if (err || user == undefined) return res.sendStatus(403)

    // Remove old refresh token
    deleteRefreshToken(refreshToken)
    // Generate new refresh & access pair and send
    res.json(generateTokenPair({ name: (user as User).name }))
  })
})

// Logout user
router.delete("/users/logout", (req, res) => {
  const refreshToken: string = req.body.token
  if (!refreshToken) return res.sendStatus(401)
  deleteRefreshToken(refreshToken)
  res.sendStatus(204)
})

function generateAccessToken(authUser: AuthUser) {
  return jwt.sign(authUser, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: "15m" })
}

function generateRefreshToken(authUser: AuthUser) {
  const refreshToken = jwt.sign(authUser, process.env.REFRESH_TOKEN_SECRET as string)
  refreshTokens.push(refreshToken)
  return refreshToken
}

function generateTokenPair(authUser: AuthUser) {
  const accessToken = generateAccessToken(authUser)
  const refreshToken = generateRefreshToken(authUser)
  return { accessToken: accessToken, refreshToken: refreshToken }
}

function deleteRefreshToken(refreshToken: string) {
  refreshTokens = refreshTokens.filter(token => token !== refreshToken)
}