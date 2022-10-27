import express from "express"
import Database from "../../lib/Database"
import { sendErrorResponse, sendSuccessResponse } from "../../lib/sendResponse"

export const router = express.Router()

router.delete("/clearDb", async (req, res) => {
  try {
    await Database.clearDb()
    sendSuccessResponse(res, "Database cleared")
  } catch (err) {
    sendErrorResponse(res, err)
  }
})