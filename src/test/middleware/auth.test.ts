import { Request, Response } from "express"
import Token from "../../models/token"
import TestServer from "../TestServer"
import { AuthenticatedResponse, authenticateToken } from "../../middleware/auth"

// Create mock verify access token function
//const verifyAccToken = jest.fn<VerifyTokenReturn, [string]>()
// Now create express middleware function using the mock function
//const authenticateToken = authenticateToken(verifyAccToken)

// Mock all methods in the token class
jest.mock("../../models/token")

describe("authenticateToken", () => {
  describe("Check verifyAccessToken function calls", () => {
    it("Is called only once", async () => {
      // Reset mocks

      // Get sample request and response objects
      const response = await TestServer.request(`${process.env.TEST_SERVER_ADDR}/test/reqAndRes`, "GET")
      const body = (await response.json()) as { req: Request, res: AuthenticatedResponse }
      // Now test the middleware function with the sample objects
      console.log(body)
      authenticateToken(body.req, body.res, () => { })
      // Finally run tests
      expect(verifyAccToken.mock.calls.length).toBe(1)
    })
  })
})