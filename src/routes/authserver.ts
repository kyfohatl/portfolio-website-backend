import dotenv from "dotenv"
dotenv.config()

import express from "express"
import bcrypt from "bcrypt"

import { AuthUser, BackendError, BackendResponse } from "../custom"
import User from "../models/user"
import Token from "../models/token"
import { sendErrorResponse, sendSuccessResponse } from "../lib/sendResponse"

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
    sendSuccessResponse(res, { id: user.id }, 201)
  } catch (err) {
    const castError = err as BackendError

    if ("unknownError" in castError) {
      // Custom handling of postgres errors
      if (ensureValidPostgresErr(castError.unknownError)) {
        // Check if email already exists on the database
        if (castError.unknownError.code === "23505") {
          // Email already exists. Send specific error
          return res.status(400).json({
            complexError: { email: "Email already exists!" },
            code: 400
          } as BackendResponse)
        }
      }
    } else {
      // Other errors
      sendErrorResponse(res, castError)
    }
  }
})

const incorrectUserOrPassStr = "Username or password is incorrect"

// Login the given user with the given username and password, if correct
router.post("/users/login", async (req, res) => {
  try {
    // Get the user
    const users = await User.where(req.body.username)
    const user = users[0]

    // Check if password hashes match
    if (await bcrypt.compare(req.body.password, user.password)) {
      // Correct credentials. Send access & refresh token pair
      const authUser: AuthUser = { id: user.id }
      res.json({ success: Token.generateTokenPair(authUser) } as BackendResponse)
    } else {
      // Incorrect credentials
      sendErrorResponse(res, {
        complexError: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr },
        code: 400
      } as BackendError)
    }
  } catch (err) {
    const castError = err as BackendError
    if ("unknownError" in castError) {
      sendErrorResponse(res, castError)
    } else {
      if ("simpleError" in castError) {
        sendErrorResponse(res, {
          complexError: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr },
          code: castError.code
        } as BackendError)
      }
    }
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
      res.json({ success: Token.generateTokenPair(data.user) } as BackendResponse)
    } else {
      // Refresh token is invalid
      sendErrorResponse(res, { simpleError: "Invalid refresh token", code: 403 } as BackendError)
    }
  } catch (err) {
    // System failed to complete required operations
    sendErrorResponse(res, err as BackendError)
  }
})

// Logout user
router.delete("/users/logout", async (req, res) => {
  const refreshToken: string = req.body.token
  if (!refreshToken) return res.sendStatus(401)

  try {
    await Token.deleteRefreshToken(refreshToken)
    // Successfully deleted given refresh token
    res.sendStatus(204)
  } catch (err) {
    // Failed to delete given refresh token
    sendErrorResponse(res, { unknownError: err, code: 500 } as BackendError)
  }
})