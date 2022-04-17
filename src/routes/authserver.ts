import dotenv from "dotenv"
dotenv.config()

import express from "express"
import bcrypt from "bcrypt"

import { AuthUser } from "../custom"
import User from "../models/user"
import Token from "../models/token"

export const router = express.Router()
router.use(express.json())

interface PostgresErr {
  code: string
}

// Returns true if the given error is a valid postgres error and false otherwise
function ensureValidPostgresErr(err: unknown): err is PostgresErr {
  return (!!err && typeof err === "object" && "code" in err && typeof (err as PostgresErr).code === "string")
}

// Create a new user with the given username and password
router.post("/users", async (req, res) => {

  try {
    const passHash: string = await bcrypt.hash(req.body.password, 10)
    const user = await User.create(req.body.username, passHash)
    res.status(201).json({ id: user.id })
  } catch (err) {
    if (ensureValidPostgresErr(err)) {
      // Check if email already exists on the database
      if (err.code === "23505") return res.status(500).json({ error: { email: "Email already exists!" } })
    }

    res.status(500).json({ error: { generic: err } })
  }
})

const incorrectUserOrPassStr = "Username or password is incorrect"

// Login the given user with the given username and password, if correct
router.post("/users/login", async (req, res) => {
  try {
    // Get the user
    const users = await User.where(req.body.username)
    if (users.length == 0) return res.status(400).json({ error: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr } })

    const user = users[0]

    // Check if password hashes match
    if (await bcrypt.compare(req.body.password, user.password)) {
      // Correct credentials. Send access & refresh token pair
      const authUser: AuthUser = { id: user.id }
      res.json({ success: Token.generateTokenPair(authUser) })
    } else {
      // Incorrect credentials
      res.status(400).send({ error: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr } })
    }
  } catch (err) {
    res.status(500).json({ error: { generic: err } })
  }
})

// Generates a new access & refresh token pair if the given refresh token is valid
router.post("/token", async (req, res) => {
  const refreshToken: string = req.body.token
  if (!refreshToken) return res.sendStatus(401)

  try {
    // Check for the validity of the given refresh token
    const data = await Token.verifyRefToken(refreshToken)
    if (data.isValid) {
      // Refresh token is valid
      // Remove old refresh token
      Token.deleteRefreshToken(refreshToken)
      // Generate new refresh & access pair and send
      res.json({ success: Token.generateTokenPair(data.user) })
    } else {
      // Refresh token is invalid
      res.status(403).send({ error: { generic: "Invalid refresh token" } })
    }
  } catch (err) {
    // System failed to complete required operations
    res.status(500).json({ error: { generic: err } })
  }
})

// Logout user
router.delete("/users/logout", (req, res) => {
  const refreshToken: string = req.body.token
  if (!refreshToken) return res.sendStatus(401)
  Token.deleteRefreshToken(refreshToken)
  res.sendStatus(204)
})