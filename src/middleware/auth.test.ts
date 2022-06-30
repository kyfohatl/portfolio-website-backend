import { Request, Response } from "express"
import Token, { VerifyTokenReturn } from "../models/token"
import TestServer from "../test/TestServer"
import { makeAuthenticateToken } from "./auth"

// Create mock verify access token function
const verifyAccToken = jest.fn<VerifyTokenReturn, [string]>()
// Now create express middleware function using the mock function
const authenticateToken = makeAuthenticateToken(verifyAccToken)

describe("authenticateToken", () => {
  describe("Check verifyAccessToken function calls", () => {
    it("Is called only once", () => {
      verifyAccToken.mockReset()
      TestServer.request(`${process.env.TEST_SERVER_ADDR}`)
      expect(verifyAccToken.mock.calls.length).toBe(1)
    })
  })

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