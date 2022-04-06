import dotenv from "dotenv"
dotenv.config()

import express from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

import { AuthUser } from "../custom"
import User from "../models/user"
import database from "../herokuClient"

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
      res.json({ success: generateTokenPair(authUser) })
    } else {
      // Incorrect credentials
      res.status(400).send({ error: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr } })
    }
  } catch (err) {
    res.status(500).json({ error: { generic: err } })
  }
})

// Generates a new access & refresh token pair if the given refresh token is valid
router.post("/token", (req, res) => {
  const refreshToken: string = req.body.token
  if (!refreshToken) return res.sendStatus(401)

  // Check if the refresh token exists in the database
  const queryStr = `
    SELECT EXISTS(
        SELECT 1
        FROM refresh_tokens
        WHERE token = $1
      );
  `
  const queryVals = [refreshToken]
  database.query(queryStr, queryVals, (err, data) => {
    if (err) return res.status(500).send(err)
    if (data.rows[0].exists) {
      // Token exists in database. Verify it
      jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string, (err, user) => {
        if (err || user == undefined) return res.sendStatus(403)

        try {
          // Remove old refresh token
          deleteRefreshToken(refreshToken)
          // Generate new refresh & access pair and send
          res.json({ success: generateTokenPair({ id: (user as AuthUser).id }) })
        } catch (err) {
          // Failed to replace old token with new pair
          return res.status(500).send(err)
        }
      })
    } else {
      // refresh token does not exist in the database
      res.status(403).send("Invalid refresh token")
    }
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

  // Add refresh token to the database
  const queryStr = `
    INSERT INTO refresh_tokens(token)
    VALUES ($1);
  `
  const queryVals = [refreshToken]
  database.query(queryStr, queryVals, (err, data) => {
    if (err) throw err
  })

  return refreshToken
}

function generateTokenPair(authUser: AuthUser) {
  try {
    const accessToken = generateAccessToken(authUser)
    const refreshToken = generateRefreshToken(authUser)
    return { accessToken: accessToken, refreshToken: refreshToken }
  } catch (err) {
    throw err
  }
}

function deleteRefreshToken(refreshToken: string) {
  const queryStr = `
    DELETE FROM refresh_tokens
    WHERE token = $1;
  `
  const queryVals = [refreshToken]
  database.query(queryStr, queryVals, (err, data) => {
    if (err) throw err
  })
}