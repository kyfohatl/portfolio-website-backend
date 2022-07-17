import { response, Response } from "express"
import { sendSuccessResponse } from "../../lib/sendResponse"
import Token from "../../models/token"
import { sendTokens } from "../../routes/auth"

// Mock the Token model
jest.mock("../../models/token")
const generateTokenPairMock = jest.mocked(Token.generateTokenPair, true)
// Mock the send response helper functions
jest.mock("../../lib/sendResponse")
const sendSuccessResponseMock = jest.mocked(sendSuccessResponse, true)

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