import { Request, Response } from "express"
import Token, { VerifyTokenReturn } from "../models/token"
import TestServer from "../test/TestServer"
import { AuthenticatedResponse, makeAuthenticateToken } from "./auth"

// Create mock verify access token function
const verifyAccToken = jest.fn<VerifyTokenReturn, [string]>()
// Now create express middleware function using the mock function
const authenticateToken = makeAuthenticateToken(verifyAccToken)

describe("authenticateToken", () => {
  describe("Check verifyAccessToken function calls", () => {
    it("Is called only once", async () => {
      // Reset mocks
      verifyAccToken.mockReset()
      // Get sample request and response objects
      const response = await TestServer.request(`${process.env.TEST_SERVER_ADDR}/test/reqAndRes`, "GET")
      const body = (await response.json()) as {req: Request, res: AuthenticatedResponse}
      // Now test the middleware function with the sample objects
      console.log(body)
      authenticateToken(body.req, body.res, () => {})
      // Finally run tests
      expect(verifyAccToken.mock.calls.length).toBe(1)
    })
  })
})