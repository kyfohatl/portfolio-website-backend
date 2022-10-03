import express from "express"
import { AuthService, BackendError, TypedRequestBody } from "../../custom"
import { sendErrorResponse, sendSuccessResponse } from "../../lib/sendResponse"
import Token from "../../models/token"
import User from "../../models/user"

export const router = express.Router()

// Removes the given user from the database
router.delete("/user", async (req: TypedRequestBody<{ username?: string }>, res) => {
  // Ensure a username is sent
  if (!req.body.username) return res.status(400).json({ simpleError: "No username given!", code: 400 } as BackendError)

  try {
    const deletedUser = await User.delete("username", req.body.username)
    sendSuccessResponse(res, deletedUser)
  } catch (err) {
    sendErrorResponse(res, err)
  }
})

// Creates a user on the database, generates a jwt token pair and sends it via the response body
router.post("/user", async (req: TypedRequestBody<{ username?: string, password?: string }>, res) => {
  // Ensure username and password are present
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ simpleError: "Username or password not given!", code: 400 } as BackendError)
  }

  try {
    const newUser = await User.create(req.body.username, req.body.password)
    const tokens = Token.generateTokenPair({ id: newUser.id })
    sendSuccessResponse(res, { tokens, userId: newUser.id })
  } catch (err) {
    sendErrorResponse(res, err)
  }
})

// Create a third party user on the database
router.post("/tp_user", async (
  req: TypedRequestBody<{ username: string, provider: AuthService, providerUserId: string }>,
  res
) => {
  try {
    const user = await User.getThirdPartyUserOrCreate(
      req.body.provider,
      req.body.providerUserId,
      req.body.username.toLowerCase()
    )
    sendSuccessResponse(res, user.id)
  } catch (err) {
    sendErrorResponse(res, err)
  }
})