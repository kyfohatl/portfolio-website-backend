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

const sign = jest.mocked<(
  payload: string | object | Buffer,
  secretOrPrivateKey: jwt.Secret,
  options?: jwt.SignOptions | undefined
) => string>(jwt.sign, true)

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

describe("generateTokenPair", () => {
  describe("When given an AuthUser", () => {
    const ACCESS_TOKEN = "someAccessToken1234"
    const REFRESH_TOKEN = "someRefreshToken1234"

    beforeAll(() => {
      // Mock the jwt.sign function return values since it will be called twice
      sign
        .mockReturnValueOnce(ACCESS_TOKEN)
        .mockReturnValueOnce(REFRESH_TOKEN)
    })

    // Delete test refresh token
    afterAll(async () => {
      await Token.deleteRefreshToken(REFRESH_TOKEN)
    })

    it("Generate and returns an access and refresh token pair and saves the refresh token", async () => {
      const tokens = await Token.generateTokenPair({ id: "SomeID" })
      expect(tokens.accessToken.token).toBe(ACCESS_TOKEN)
      expect(tokens.accessToken.expiresInSeconds).toBeDefined()
      expect(tokens.refreshToken.token).toBe(REFRESH_TOKEN)
      expect(tokens.refreshToken.expiresInSeconds).toBeDefined()

      // Ensure that the refresh token has been saved to the database
      expect(await Token.doesTokenExist(REFRESH_TOKEN)).toBe(true)
    })
  })
})

describe("deleteRefreshToken", () => {
  const REFRESH_TOKEN = "someRandomToken234"

  describe("When given a token that exists in the database", () => {
    // Save test token
    beforeAll(async () => {
      await Token.saveRefreshToken(REFRESH_TOKEN)
    })

    it("Deletes the given token", async () => {
      // Delete token
      await Token.deleteRefreshToken(REFRESH_TOKEN)
      // Enure that it has been deleted
      expect(await Token.doesTokenExist(REFRESH_TOKEN)).toBe(false)
    })
  })

  describe("When given a token that does not exist in the database", () => {
    it("Does nothing, and will not throw an error", async () => {
      await Token.deleteRefreshToken(REFRESH_TOKEN)
    })
  })
})