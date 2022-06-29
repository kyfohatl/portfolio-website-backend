import { Request, Response } from "express"
import Token from "../models/token"
import { authenticateToken } from "./auth"

describe("authenticateToken", () => {
  const accessToken = Token.generateAccessToken({ id: "123456" }).token

  const mockReq: Request = {
    cookies: { accessToken: accessToken },
    headers: {}
  } as Request

  const res: Response = {
    statusCode: -1,
    status: (code: number) => {
      res.statusCode = code
    }
  } as Response

  describe("Input has a valid access token as cookie", () => {
    it("Calls the next function", () => {
      authenticateToken(req, res, () => { })
    })
  })
})