import { Response } from "express"
import * as sendResponseModule from "../../lib/sendResponse"
import Token from "../../models/token"
import User from "../../models/user"
import { sendTokens, SALT_ROUNDS } from "../../routes/auth"
import request from "supertest"
import bcrypt from "bcrypt"
import app from "../../expressApp"
import { BackendError } from "../../custom"

// Mock the Token model
jest.mock("../../models/token")
const generateTokenPairMock = jest.mocked(Token.generateTokenPair, true)

describe("sendTokens", () => {
  // Create a mock of the sendSuccessResponse function
  const sendSuccessResponseMock = jest.spyOn(sendResponseModule, "sendSuccessResponse").mockImplementation(
    jest.fn()
  )

  // Restore sendSuccessResponse function for other tests
  afterAll(() => {
    sendSuccessResponseMock.mockRestore()
  })

  // Mock an express Response object
  const mockResponse = {
    append: jest.fn(),
    redirect: jest.fn()
  }

  const USER_ID = "someID"

  const TOKENS = {
    accessToken: { token: "someAccessToken", expiresInSeconds: 30 },
    refreshToken: { token: "someRefreshToken", expiresInSeconds: 30 }
  }

  function itBehavesLikeGenerateAndSendTokens() {
    it("Generates access and refresh tokens", () => {
      expect(generateTokenPairMock).toHaveBeenCalledWith({ id: USER_ID })
    })

    it("Sets access and refresh tokens as cookies on the response", () => {
      expect(mockResponse.append).toHaveBeenCalledWith("Set-Cookie", [
        `accessToken=${TOKENS.accessToken.token}; Max-age=${TOKENS.accessToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`,
        `refreshToken=${TOKENS.refreshToken.token}; Max-age=${TOKENS.refreshToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`
      ])
    })
  }

  describe("When only given a response and a user id", () => {
    beforeAll(async () => {
      // Setup mocks
      sendSuccessResponseMock.mockReset()
      generateTokenPairMock.mockReset()
      generateTokenPairMock.mockResolvedValue(TOKENS)

      // Call the function
      await sendTokens(mockResponse as unknown as Response, USER_ID)
    })

    itBehavesLikeGenerateAndSendTokens()

    it("Sends access and refresh tokens back via the response", () => {
      expect(sendSuccessResponseMock).toHaveBeenCalledWith(mockResponse, { tokens: TOKENS, userId: USER_ID })
    })
  })

  describe("When given a response, user id and a redirect url", () => {
    const REDIRECT_URL = "http://someRedirectDomain.com/"

    beforeAll(async () => {
      // Setup mocks
      generateTokenPairMock.mockReset()
      generateTokenPairMock.mockResolvedValue(TOKENS)
      mockResponse.append.mockReset()
      mockResponse.redirect.mockReset()

      // Call the function
      await sendTokens(mockResponse as unknown as Response, USER_ID, REDIRECT_URL)
    })

    itBehavesLikeGenerateAndSendTokens()

    it("Redirects to the given redirect url with the user id as a query parameter", () => {
      expect(mockResponse.redirect).toHaveBeenCalledWith(REDIRECT_URL + `?userid=${USER_ID}`)
    })
  })
})

// Mock the bcrypt module
jest.mock('bcrypt')
const hashMock = jest.mocked<
  (data: string | Buffer, saltOrRounds: string | number) => Promise<string>
>(bcrypt.hash, true)

// Mock the User model
jest.mock("../../models/user")
const createUserMock = jest.mocked(User.create, true)

const ROUTE_TOKENS = {
  accessToken: { token: "routeAccessToken456", expiresInSeconds: 40 },
  refreshToken: { token: "routeRefreshToken456", expiresInSeconds: 40 }
}

describe("POST /users", () => {
  const HASHED_PASS = "someHashedPassword123"
  const USER_ID = "1234"
  const USERNAME = "someUsername"
  const PASSWORD = "somePassword"
  const USER = { id: USER_ID, username: USERNAME, password: PASSWORD }

  beforeAll(() => {
    hashMock.mockReset()
    createUserMock.mockReset()

    hashMock.mockResolvedValue(HASHED_PASS)
    createUserMock.mockResolvedValue(USER)
    generateTokenPairMock.mockResolvedValue(ROUTE_TOKENS)
  })

  describe("When given a valid username and password", () => {
    let response: request.Response
    beforeAll(async () => {
      response = await request(app).post("/auth/users").send({ username: USERNAME, password: PASSWORD })
    })

    it("Hashes the given password", () => {
      expect(hashMock).toHaveBeenCalledWith(PASSWORD, SALT_ROUNDS)
    })

    it("Creates a new user using the given user information", () => {
      expect(createUserMock).toHaveBeenCalledWith(USERNAME, HASHED_PASS)
    })

    it("Sends generated tokens in the body of the response", () => {
      expect(response.body.success.tokens).toEqual(ROUTE_TOKENS)
    })

    it("Sends the id of the created user in the response body", () => {
      expect(response.body.success.userId).toBe(USER_ID)
    })

    it("Send generated tokens as cookies", () => {
      expect(response.headers['set-cookie']).toEqual([
        `accessToken=${ROUTE_TOKENS.accessToken.token}; Max-age=${ROUTE_TOKENS.accessToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`,
        `refreshToken=${ROUTE_TOKENS.refreshToken.token}; Max-age=${ROUTE_TOKENS.refreshToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`
      ])
    })
  })

  describe("When username and password are missing from the request", () => {
    it("Returns an error object with code 400", async () => {
      const response = await request(app).post("/auth/users").send({})
      expect(response.body).toEqual({ simpleError: "Username or password missing", code: 400 } as BackendError)
    })
  })
})