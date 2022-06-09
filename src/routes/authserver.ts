import dotenv from "dotenv"
dotenv.config()

import express, { Response } from "express"
import cookieParser from "cookie-parser"
import bcrypt from "bcrypt"

import { AuthUser, BackendError, BackendResponse, TypedReqCookies } from "../custom"
import User from "../models/user"
import Token from "../models/token"
import { sendErrorResponse } from "../lib/sendResponse"

export const router = express.Router()
router.use(express.json())
router.use(cookieParser())

interface PostgresErr {
  code: string
}

// Returns true if the given error is a valid postgres error and false otherwise
function ensureValidPostgresErr(err: unknown): err is PostgresErr {
  return (!!err && typeof err === "object" && "code" in err && typeof (err as PostgresErr).code === "string")
}

// Sends an access and refresh token pair via the response, both in the body (for mobile app frontends)
// and as a cookie using the Set-Cookie header (for browser frontends)
function sendTokens(res: Response, userId: string) {
  const authUser: AuthUser = { id: userId }
  const tokens = Token.generateTokenPair(authUser)

  // We will send the tokens both in the body and set as a http-only cookie
  // Tokens set as a cookie will be used by browser frontends
  res.append("Set-Cookie", [
    `accessToken=${tokens.accessToken.token}; Max-age=${tokens.accessToken.expiresInSeconds}; HttpOnly; Path=/`,
    `refreshToken=${tokens.refreshToken.token}; Max-age=${tokens.refreshToken.expiresInSeconds}; HttpOnly; Path=/`
  ])

  // Tokens in the body can be used by mobile app frontends
  res.json({ success: { tokens: tokens, userId: userId } } as BackendResponse)
}

// Create a new user with the given username and password
router.post("/users", async (req, res) => {

  try {
    const passHash: string = await bcrypt.hash(req.body.password, 10)
    const user = await User.create(req.body.username, passHash)
    // Send tokens to frontend
    sendTokens(res, user.id)
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
// Sends back jwt acc and refresh tokens both as cookies and in the response body
router.post("/users/login", async (req, res) => {
  try {
    // Get the user
    const users = await User.where(req.body.username)
    const user = users[0]

    // Check if password hashes match
    if (await bcrypt.compare(req.body.password, user.password)) {
      // Correct credentials. Send access & refresh token pair
      // Both as a cookie and in the body
      sendTokens(res, user.id)
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
router.post("/token", async (req: TypedReqCookies<{ refreshToken?: string }>, res) => {
  // Ensure a refresh token is present in cookies
  const refreshToken = req.cookies.refreshToken
  if (!refreshToken) return res.sendStatus(401)

  try {
    // Check for the validity of the given refresh token
    const data = await Token.verifyRefToken(refreshToken)
    if (data.isValid) {
      // Refresh token is valid
      // Remove old refresh token
      await Token.deleteRefreshToken(refreshToken)
      // Generate new refresh & access pair and send
      sendTokens(res, data.user.id)
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
  let refreshToken: string | undefined = undefined
  // First try to get the token from cookies (for web browser frontend)
  if ("refreshToken" in req.cookies) refreshToken = req.cookies.refreshToken
  else {
    // Otherwise try to get it from the body (for mobile app frontend)
    refreshToken = req.body.token
  }

  // Ensure a token is present
  if (!refreshToken) return res.sendStatus(401)

  try {
    await Token.deleteRefreshToken(refreshToken)
    // Successfully deleted given refresh token
    // Clear cookies from frontend if they exist
    res.append("Set-Cookie", [
      "accessToken=\"\"; Max-age=0; HttpOnly; Path=/",
      "refreshToken=\"\"; Max-age=0; HttpOnly; Path=/"
    ])
    // Send response
    res.sendStatus(204)
  } catch (err) {
    // Failed to delete given refresh token
    sendErrorResponse(res, { unknownError: err, code: 500 } as BackendError)
  }
})