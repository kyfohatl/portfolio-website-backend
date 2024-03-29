import dotenv from "dotenv"
dotenv.config()

import express, { Request, Response } from "express"
import bcrypt from "bcrypt"

import { AuthService, AuthUser, BackendError, BackendResponse, TypedReqCookies } from "../custom"
import User from "../models/user"
import Token from "../models/token"
import { sendErrorResponse, sendSuccessResponse } from "../lib/sendResponse"
import { generators } from "openid-client"
import { expressStorage } from "../lib/storage"
import { FACEBOOK_CALLBACK_ADDR, GOOGLE_CALLBACK_ADDR, initializeAuthClients } from "../middleware/auth"
import { ensureValidPostgresErr } from "../lib/types/error"

export const router = express.Router()

// Sends an access and refresh token pair via the response, both in the body (for mobile app frontends)
// and as a cookie using the Set-Cookie header (for browser frontends)
export async function sendTokens(res: Response, userId: string, redirectAddr?: string) {
  const authUser: AuthUser = { id: userId }
  const tokens = await Token.generateTokenPair(authUser)

  // We will send the tokens both in the body and set as a http-only cookie
  // Tokens set as a cookie will be used by browser frontends
  res.append("Set-Cookie", [
    `accessToken=${tokens.accessToken.token}; Max-age=${tokens.accessToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`,
    `refreshToken=${tokens.refreshToken.token}; Max-age=${tokens.refreshToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`
  ])

  if (redirectAddr) {
    // A redirect url is given. Redirect to the given location and set user id as a parameter
    // Also only send user id as this method of authentication will only be used for a browser frontend
    res.redirect(redirectAddr + `?userid=${userId}`)
  } else {
    // Redirect url is not given, send information in the response body
    // Tokens in the body can be used by mobile app frontends
    sendSuccessResponse(res, { tokens: tokens, userId: userId })
  }
}

export const SALT_ROUNDS = 10

// Create a new user with the given username and password
router.post("/users", async (req, res) => {
  // Ensure a username and password are present
  if (!(req.body.username && req.body.password))
    return sendErrorResponse(res, { simpleError: "Username or password missing", code: 400 })

  try {
    const passHash: string = await bcrypt.hash(req.body.password, SALT_ROUNDS)
    const user = await User.create(req.body.username, passHash)
    // Send tokens to frontend
    await sendTokens(res, user.id)
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

export const incorrectUserOrPassStr = "Username or password is incorrect"

// Login the given user with the given username and password, if correct
// Sends back jwt acc and refresh tokens both as cookies and in the response body
router.post("/users/login", async (req, res) => {
  if (!("username" in req.body))
    return sendErrorResponse(res, { simpleError: "A valid username is required!", code: 400 } as BackendError)

  try {
    // Get the user
    const user = await User.where("username", req.body.username)

    // Ensure that this user is not a third party auth user
    if (!user.password) return sendErrorResponse(res, {
      complexError: { email: "User already exists with third party account", password: "" },
      code: 400
    } as BackendError)

    // Check if password hashes match
    if (await bcrypt.compare(req.body.password, user.password)) {
      // Correct credentials. Send access & refresh token pair
      // Both as a cookie and in the body
      await sendTokens(res, user.id)
    } else {
      // Incorrect credentials
      sendErrorResponse(res, {
        complexError: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr },
        code: 400
      } as BackendError)
    }
  } catch (err) {
    const castError = err as BackendError
    if ("simpleError" in castError) {
      // Given username does not exist
      sendErrorResponse(res, {
        complexError: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr },
        code: 400
      } as BackendError)
    } else {
      // Some other error
      sendErrorResponse(res, err)
    }
  }
})

// Generates a new access & refresh token pair if the given refresh token is valid
router.post("/token", async (req: TypedReqCookies<{ refreshToken?: string }>, res) => {
  // Ensure a refresh token is present in cookies
  const refreshToken = req.cookies.refreshToken
  if (!refreshToken) return sendErrorResponse(res, { simpleError: "No refresh token given!", code: 401 } as BackendError)

  try {
    // Check for the validity of the given refresh token
    const data = await Token.verifyRefToken(refreshToken)
    if (data.isValid) {
      // Refresh token is valid
      // Remove old refresh token
      await Token.deleteRefreshToken(refreshToken)
      // Generate new refresh & access pair and send
      await sendTokens(res, data.user.id)
    } else {
      // Refresh token is invalid
      sendErrorResponse(res, { simpleError: "Invalid refresh token", code: 403 } as BackendError)
    }
  } catch (err) {
    // System failed to complete required operations
    sendErrorResponse(res, err as BackendError)
  }
})

export const CLEAR_ACC_TOKEN_COOKIE_STR = "accessToken=\"\"; Max-age=0; HttpOnly; Path=/; SameSite=None; Secure"
export const CLEAR_REF_TOKEN_COOKIE_STR = "refreshToken=\"\"; Max-age=0; HttpOnly; Path=/; SameSite=None; Secure"

// Logout user
router.delete("/users/logout", async (req, res) => {
  let refreshToken: string | undefined = undefined
  // First try to get the token from cookies (for web browser frontend)
  if (req.cookies && "refreshToken" in req.cookies) refreshToken = req.cookies.refreshToken
  else {
    // Otherwise try to get it from the body (for mobile app frontend)
    refreshToken = req.body.token
  }

  // Ensure a token is present
  if (!refreshToken) {
    return sendErrorResponse(res, { simpleError: "No refresh token given!", code: 401 } as BackendResponse)
  }

  try {
    await Token.deleteRefreshToken(refreshToken)
    // Successfully deleted given refresh token, or given token does not exist in database
    // Clear cookies from frontend if they exist
    res.append("Set-Cookie", [
      CLEAR_ACC_TOKEN_COOKIE_STR,
      CLEAR_REF_TOKEN_COOKIE_STR
    ])
    // Send response
    res.sendStatus(204)
  } catch (err) {
    // Failed to delete given refresh token
    sendErrorResponse(res, { unknownError: err, code: 500 } as BackendError)
  }
})

const NONCE_MAX_AGE = 15 * 60 * 1000

// Third party openid client authentication
// Currently google and facebook auth are supported
router.get("/login/:authService", initializeAuthClients, async (req, res) => {
  if (!req.params.authService) return sendErrorResponse(res, { simpleError: "No auth service given!", code: 400 })

  const nonce = generators.nonce()

  let url: string
  switch (req.params.authService) {
    case "google":
      url = expressStorage.googleAuthClient.authorizationUrl({
        scope: "openid email profile",
        response_mode: "form_post",
        nonce
      })
      break
    case "facebook":
      url = expressStorage.facebookAuthClient.authorizationUrl({
        scope: "openid email public_profile",
        response_mode: "query",
        nonce
      })
      break
    default:
      // Given auth service is not supported
      return sendErrorResponse(res, { simpleError: "Invalid auth service!", code: 400 })
  }

  // Save the nonce as a cookie
  res.cookie(
    "nonce",
    nonce,
    { path: "/", maxAge: NONCE_MAX_AGE, httpOnly: true, sameSite: "none", secure: true }
  )

  // Redirect the user to the authorization url, where they are prompted by google to sign in
  res.redirect(url)
})

export const GOOGLE_FRONTEND_REDIR_ADDR = `${process.env.FRONTEND_SERVER_ADDR}/signin/google`

// Handles the callback process for the given openid client authentication service type
// Throws an error if unable to complete the process
export async function handleOpenIdCallback(req: Request, res: Response, clientType: AuthService) {
  const clientObjName = clientType + "AuthClient"

  // Ensure required information is present
  if (!("nonce" in req.cookies))
    throw ({ simpleError: "Missing nonce!", code: 500 } as BackendError)
  else if (!(clientObjName in expressStorage))
    throw ({ simpleError: "Client has not been initialized", code: 500 } as BackendError)

  // Set correct information depending on client type
  let callbackAddr: string
  switch (clientType) {
    case "google":
      callbackAddr = GOOGLE_CALLBACK_ADDR
      break
    case "facebook":
      callbackAddr = FACEBOOK_CALLBACK_ADDR
      break
    default:
      throw ({ simpleError: `Given client type of ${clientType} is not supported`, code: 400 } as BackendError)
  }

  const params = expressStorage[clientObjName].callbackParams(req)
  const tokenSet = await expressStorage[clientObjName].callback(
    callbackAddr,
    params,
    { nonce: req.cookies.nonce }
  )
  const claims = tokenSet.claims()

  // Ensure an email is present in the given user info
  if (!claims.email) throw ({ simpleError: "Third party did not provide email!", code: 400 } as BackendError)

  try {
    // If a user with the given information does not exist on the system, create a new user
    // Otherwise get the id of the existing user
    const user = await User.getThirdPartyUserOrCreate(clientType, claims.sub, claims.email)
    // Openid authentication successful. Send tokens
    if (clientType === "facebook") await sendTokens(res, user.id)
    else await sendTokens(res, user.id, GOOGLE_FRONTEND_REDIR_ADDR)
  } catch (err) {
    throw err
  }
}

// Callback endpoint for google openid client auth
router.post("/login/google/callback", async (req, res) => {
  try {
    await handleOpenIdCallback(req, res, "google")
  } catch (err) {
    // Failed to complete openid authentication
    sendErrorResponse(res, err as BackendError)
  }
})

// Callback endpoint for facebook openid client auth
router.post("/login/facebook/callback", async (req, res) => {
  try {
    await handleOpenIdCallback(req, res, "facebook")
  } catch (err) {
    // Failed to complete openid authentication
    sendErrorResponse(res, err as BackendError)
  }
})