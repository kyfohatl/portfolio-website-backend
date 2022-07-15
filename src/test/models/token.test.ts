import Token from "../../models/token"
import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"
import jwt from "jsonwebtoken"
import { AuthUser, BackendError } from "../../custom"

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
    const SAMPLE_USER = { id: "id456" }
    const REFRESH_TOKEN = "someRefreshToken"

    beforeAll(async () => {
      // Setup jwt.verify mock
      verify.mockReset()
      verify.mockReturnValue(SAMPLE_USER)
      // Save refresh token to database
      await Token.saveRefreshToken(REFRESH_TOKEN)
    })

    afterAll(async () => {
      // Delete refresh token
      await Token.deleteRefreshToken(REFRESH_TOKEN)
    })

    it("Returns token data along with true", async () => {
      const data = await Token.verifyRefToken(REFRESH_TOKEN)
      expect(data).toEqual({ isValid: true, user: SAMPLE_USER })
    })
  })

  describe('When given an invalid refresh token', () => {
    describe("When the refresh token does not exist in the database", () => {
      beforeAll(() => {
        verify.mockReset()
        // Assume that the jwt.verify approves the token
        verify.mockReturnValue({ id: "id789" })
      })

      it("Returns an object with isValid set to false", async () => {
        const data = await Token.verifyRefToken("someRefreshToken")
        expect(data).toEqual({ isValid: false })
      })
    })

    describe("When the refresh token exists in the database", () => {
      const REFRESH_TOKEN = "someInvalidToken"

      beforeAll(async () => {
        // Setup mock
        verify.mockReset()
        verify.mockImplementation(() => {
          throw new Error()
        })
        // Save invalid refresh token in database
        await Token.saveRefreshToken(REFRESH_TOKEN)
      })

      afterAll(async () => {
        await Token.deleteRefreshToken(REFRESH_TOKEN)
      })

      it("Returns an object with isValid set to false", async () => {
        const data = await Token.verifyRefToken(REFRESH_TOKEN)
        expect(data).toEqual({ isValid: false })
      })
    })
  })
})

describe("doesTokenExist", () => {
  const REFRESH_TOKEN = "someRefreshToken"

  describe("When the given token exists in the database", () => {
    // Save test token to the database
    beforeAll(async () => {
      await Token.saveRefreshToken(REFRESH_TOKEN)
    })

    // Delete test token
    afterAll(async () => {
      await Token.deleteRefreshToken(REFRESH_TOKEN)
    })

    it("Returns true", async () => {
      expect(await Token.doesTokenExist(REFRESH_TOKEN)).toBe(true)
    })
  })

  describe("When the given token does not exist in the database", () => {
    it("Returns false", async () => {
      expect(await Token.doesTokenExist(REFRESH_TOKEN)).toBe(false)
    })
  })
})

describe("saveRefreshToken", () => {
  const REFRESH_TOKEN = "someToken"

  describe("When the given token does not already exist in the database", () => {
    // Clear test token from database
    afterAll(async () => {
      await Token.deleteRefreshToken(REFRESH_TOKEN)
    })

    it("Saves the given token into the database", async () => {
      // Save the token
      await Token.saveRefreshToken(REFRESH_TOKEN)

      // Now check if it exists
      expect(await Token.doesTokenExist(REFRESH_TOKEN)).toBe(true)
    })
  })

  describe("When the given token already exists in the database", () => {
    // Save test token
    beforeAll(async () => {
      await Token.saveRefreshToken(REFRESH_TOKEN)
    })

    // Delete test token
    afterAll(async () => {
      await Token.deleteRefreshToken(REFRESH_TOKEN)
    })

    it("Throws an error with code 500", async () => {
      let threwErr = true
      try {
        await Token.saveRefreshToken(REFRESH_TOKEN)
        threwErr = false
      } catch (err) {
        const castErr = err as BackendError
        expect("unknownError" in castErr).toBe(true)
        expect(castErr.code).toBe(500)
      }

      // Ensure an error was thrown
      expect(threwErr).toBe(true)
    })
  })
})