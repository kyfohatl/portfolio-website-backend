import { Request, request, response } from "express"
import Token from "../../models/token"
import { AuthenticatedResponse, authenticateToken, FACEBOOK_CALLBACK_ADDR, initializeClient } from "../../middleware/auth"
import { BaseClient, Issuer, TypeOfGenericClient } from "openid-client"

// Mock the token class
jest.mock("../../models/token")
// Now create a deep mock of all the methods inside the class
const MockedToken = jest.mocked(Token, true)

// Mock express for access to request and response objects
jest.mock("express")

// Testing the authenticateToken middleware function
describe("authenticateToken", () => {
  // Creates and returns mock request, response and next function/objects
  function createMockReqResNext() {
    const next = jest.fn()
    const req = jest.mocked<Request>(Object.create(request), true)
    const res = jest.mocked<AuthenticatedResponse>(Object.create(response), true)
    res.status.mockReturnValue(res)
    // Set fake locals to create locals object on the response
    res.locals = { authUser: { id: "" } }
    // Set empty headers for request
    req.headers = {}

    return { req, res, next }
  }

  describe("When an access token is provided", () => {
    describe("When the token is valid", () => {
      // Runs test for a valid access token
      function itBehavesLikeValidToken(req: Request, res: AuthenticatedResponse, next: jest.Mock) {
        // Call the function
        authenticateToken(req, res, next)

        // Run tests
        it("Sets authUser local variable in the response object", () => {
          expect(res.locals.authUser.id).toBe("15")
        })
        it("Calls the next function", () => {
          expect(next).toHaveBeenCalledTimes(1)
        })
      }

      // Reset token mock
      MockedToken.verifyAccToken.mockReset()
      // Setup return value
      MockedToken.verifyAccToken.mockReturnValue({ isValid: true, user: { id: "15" } })

      describe("When the token is provided as a cookie", () => {
        // Create mock data
        const { req, res, next } = createMockReqResNext()
        req.cookies = { accessToken: "123456" }

        // Call the authenticate token function and run tests
        itBehavesLikeValidToken(req, res, next)
      })

      describe("When the token is provided as a auth header", () => {
        // Create mock data
        const { req, res, next } = createMockReqResNext()
        req.headers = { authorization: "Bearer 123456" }

        // Call the authenticate token function and run tests
        itBehavesLikeValidToken(req, res, next)
      })
    })

    describe("When the token is invalid", () => {
      MockedToken.verifyAccToken.mockReset()
      MockedToken.verifyAccToken.mockReturnValue({ isValid: false })

      describe("When the token is provided as a cookie", () => {
        it("Responds with status code 401 and error message", () => {
          // Setup mock data
          const { req, res, next } = createMockReqResNext()
          req.cookies = { accessToken: "123456" }

          // Run the function
          authenticateToken(req, res, next)

          // Run tests
          expect(res.status).toHaveBeenCalledWith(401)
          expect(res.json).toHaveBeenCalledWith({ simpleError: "Token invalid", code: 401 })
        })
      })
    })
  })

  describe("When an access token is not provided", () => {
    // Create mock data
    const { req, res, next } = createMockReqResNext()
    it("Responds with status code 401 and error message", () => {
      authenticateToken(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ simpleError: "No token given", code: 401 })
    })
  })
})

// Mock the OpenId client issuer class and its methods
jest.mock("openid-client")
const MockedIssuer = jest.mocked(Issuer, true)

// Testing the initializeClient helper function
describe("initializeClient", () => {
  describe("When given facebook as auth client type", () => {
    // Setup return value for the mocked issuer discovery method
    MockedIssuer.discover.mockReset()
    const issuerInstance = jest.mocked<Issuer<BaseClient>>(Object.create(Issuer), true)
    MockedIssuer.discover.mockResolvedValue(issuerInstance)

    // Call the method with facebook client type
    initializeClient("facebook")

    // Run tests
    it("Calls the issuer discover function with the correct address", () => {
      expect(MockedIssuer.discover).toHaveBeenCalledWith("https://www.facebook.com/.well-known/openid-configuration/")
    })

    it("Creates a new client with the correct facebook details", () => {
      expect(issuerInstance.Client).toHaveBeenCalledWith({
        client_id: "396361625604894",
        redirect_uris: [FACEBOOK_CALLBACK_ADDR],
        response_types: ["id_token"]
      })
    })
  })

  describe("When given google as auth client type", () => {
    it("Generates google client in expressStorage with correct details", () => { })
  })
})