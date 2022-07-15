import Token from "../../models/token"
import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"
import jwt from "jsonwebtoken"
import { AuthUser } from "../../custom"

// Run setup
beforeAll(async () => {
  await runTestEnvSetup()
})

// Run teardown
afterAll(async () => {
  await runTestEnvTeardown()
})

// Mock the jwt library
jest.mock("jsonwebtoken")

describe("verifyAccToken", () => {
  // Mock the verify function
  const verify = jest.mocked<(
    token: string,
    secretOrPublicKey: jwt.Secret
  ) => string | jwt.JwtPayload>(jwt.verify, true)

  describe("When given a valid token", () => {
    const SAMPLE_USER: AuthUser = { id: "id1234" }

    beforeAll(() => {
      verify.mockReset()
      verify.mockReturnValue(SAMPLE_USER)
    })

    it("Returns token data along with true", () => {
      const data = Token.verifyAccToken("SomeValidToken")
      expect(data).toEqual({ isValid: true, user: SAMPLE_USER })
    })
  })

  describe("When given an invalid token", () => {
    beforeAll(() => {
      verify.mockReset()
      verify.mockImplementation(() => {
        throw new Error()
      })
    })

    it("Returns and object containing false", () => {
      const data = Token.verifyAccToken("SomeInvalidToken")
      expect(data).toEqual({ isValid: false })
    })
  })
})