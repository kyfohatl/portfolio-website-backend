import { Response } from "express"
import Token from "../../models/token"

// Mock the Token model
jest.mock("../../models/token")
const generateTokenPair = jest.mocked(Token.generateTokenPair, true)

// Create mock express response object
interface MockedResponse extends Response { }

const a: MockedResponse = {} as Response

describe("sendTokens", () => {
  beforeAll(() => {
    generateTokenPair.mockReset()
    generateTokenPair.mockResolvedValue({
      accessToken: { token: "someAccessToken", expiresInSeconds: 30 },
      refreshToken: { token: "someRefreshToken", expiresInSeconds: 30 }
    })
  })
})