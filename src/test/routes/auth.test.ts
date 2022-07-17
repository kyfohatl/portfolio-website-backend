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

// Create mock express response object
interface MockedResponse extends Response { }

const a: MockedResponse = {} as Response

describe("sendTokens", () => {
  // Mock an express Response object
  const mockResponse = {...response} as Response
  mockResponse.append = jest.fn()

  const TOKENS = {
    accessToken: { token: "someAccessToken", expiresInSeconds: 30 },
    refreshToken: { token: "someRefreshToken", expiresInSeconds: 30 }
  }

  describe("When only given a response and a user id", () => {
    const USER_ID = "someID"

    beforeAll(async () => {
      // Setup mocks
      sendSuccessResponseMock.mockReset()
      generateTokenPairMock.mockReset()
      generateTokenPairMock.mockResolvedValue(TOKENS)

      await sendTokens(mockResponse, USER_ID)
    })

    it("Generates access and refresh tokens", () => {
      expect(generateTokenPairMock).toHaveBeenCalledWith(USER_ID)
    })

    it("Sends the access and refresh tokens via the response", () => {
      expect(mockResponse.append).toHaveBeenCalledWith("Set-Cookie", [
        `accessToken=${TOKENS.accessToken.token}; Max-age=${TOKENS.accessToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`,
        `refreshToken=${TOKENS.refreshToken.token}; Max-age=${TOKENS.refreshToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`
      ])

      expect(sendSuccessResponse).toHaveBeenCalledWith(mockResponse, {tokens: TOKENS, userId: USER_ID})
    })
  })

  describe("When given a response, user id and a redirect url", () => {})
})