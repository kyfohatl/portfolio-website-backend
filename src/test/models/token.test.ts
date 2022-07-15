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

// Mock the verify function
const verify = jest.mocked<(
  token: string,
  secretOrPublicKey: jwt.Secret
) => string | jwt.JwtPayload>(jwt.verify, true)

describe("verifyAccToken", () => {
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

describe("verifyRefToken", () => {
  describe("When given a valid refresh token", () => {
    beforeAll(() => {
      verify.mockReset()
      //verify.mockReturnValue()
    })

    it("Returns token data along with true", () => { })
  })

  describe('When given an invalid refresh token', () => {
    describe("When the refresh token does not exist in the database", () => { })

    describe("When the refresh token exists in the database", () => {
      // TODO: Mock the database refresh token query method (WHICH NEEDS TO BE ABSTRACTED AWAY)
      beforeAll(() => { })

      it("Returns an object containing false", () => { })
    })
  })
})