import { Response } from "express"
import { sendSuccessResponse } from "../../lib/sendResponse"
import Token from "../../models/token"
import User from "../../models/user"
import * as authModule from "../../routes/auth"
import { sendTokens, SALT_ROUNDS } from "../../routes/auth"
import request from "supertest"
import bcrypt, { hash } from "bcrypt"
import app from "../../expressApp"

// Mock the Token model
jest.mock("../../models/token")
const generateTokenPairMock = jest.mocked(Token.generateTokenPair, true)
// Mock the send response helper functions
jest.mock("../../lib/sendResponse")
const sendSuccessResponseMock = jest.mocked(sendSuccessResponse, true)

// Mock the sendTokens function to allow isolated unit testing of routes
async function sendTokensMockImplementation(res: Response, userId: string, redirectAddr?: string) { }
const sendTokensMock = jest.spyOn(authModule, "sendTokens").mockImplementation(sendTokensMockImplementation)

describe("sendTokens", () => {
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

  // Restore the function implementation so it can be tested
  beforeAll(() => {
    sendTokensMock.mockRestore()
  })

  // Brin back the mock for other tests
  afterAll(() => {
    sendTokensMock.mockImplementation(sendTokensMockImplementation)
  })

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
      expect(sendSuccessResponse).toHaveBeenCalledWith(mockResponse, { tokens: TOKENS, userId: USER_ID })
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

describe("POST /users", () => {
  const HASHED_PASS = "someHashedPassword123"
  const USER_ID = "1234"
  const USERNAME = "someUsername"
  const PASSWORD = "somePassword"
  const USER = new User(USER_ID, USERNAME, PASSWORD)

  beforeAll(() => {
    hashMock.mockReset()
    createUserMock.mockReset()

    hashMock.mockResolvedValue(HASHED_PASS)
    createUserMock.mockResolvedValue(USER)
  })

  describe("When given a valid username and password", () => {
    beforeAll(async () => {
      await request(app).post("/auth/users").send({ username: USERNAME, password: PASSWORD })
    })

    it("Hashes the given password", async () => {
      expect(hashMock).toHaveBeenCalledWith(PASSWORD, SALT_ROUNDS)
    })
  })

  describe("When username and password are missing from the request", () => { })

  describe("When given the username of an existing user", () => { })
})