import { Response } from "express"
import * as sendResponseModule from "../../lib/sendResponse"
import Token from "../../models/token"
import User, { UserSearchParam } from "../../models/user"
import { sendTokens, SALT_ROUNDS } from "../../routes/auth"
import request from "supertest"
import bcrypt from "bcrypt"
import app from "../../expressApp"
import { BackendError } from "../../custom"
import Updatable from "../../lib/Updatable"

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

  function itBehavesLikeGenerateTokens() {
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

    itBehavesLikeGenerateTokens()

    it("Sends access and refresh tokens, as well is user id back via the response", () => {
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

    itBehavesLikeGenerateTokens()

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

// NOTE: We are using an Updatable container which contains the response, rather than passing the response itself.
// This is because since this function is called in the describe block body, it will be called and given an empty
// response object BEFORE the beforeAll hook runs, and hence the tests inside the function will be given an empty 
// object. To overcome this difficulty, an updatable container is passed instead, which will initially contain 
// nothing, but upon running of the beforeAll hook will be updated to contain a valid response, which can then be 
// accessed by the tests inside this function when they run
function itBehavesLikeGenerateAndSendTokens(container: Updatable<request.Response>, userId: string) {
  it("Sends generated tokens in the body of the response", () => {
    expect(container.getContent().body.success.tokens).toEqual(ROUTE_TOKENS)
  })

  it("Sends the id of the created user in the response body", () => {
    expect(container.getContent().body.success.userId).toBe(userId)
  })

  it("Send generated tokens as cookies", () => {
    expect(container.getContent().headers['set-cookie']).toEqual([
      `accessToken=${ROUTE_TOKENS.accessToken.token}; Max-age=${ROUTE_TOKENS.accessToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`,
      `refreshToken=${ROUTE_TOKENS.refreshToken.token}; Max-age=${ROUTE_TOKENS.refreshToken.expiresInSeconds}; HttpOnly; Path=/; SameSite=None; Secure`
    ])
  })
}

describe("POST /users", () => {
  const ROUTE = "/auth/users"

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
    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      responseContainer.update(await request(app).post(ROUTE).send({ username: USERNAME, password: PASSWORD }))
    })

    it("Hashes the given password", () => {
      expect(hashMock).toHaveBeenCalledWith(PASSWORD, SALT_ROUNDS)
    })

    it("Creates a new user using the given user information", () => {
      expect(createUserMock).toHaveBeenCalledWith(USERNAME, HASHED_PASS)
    })

    itBehavesLikeGenerateAndSendTokens(responseContainer, USER_ID)
  })

  describe("When username and password are missing from the request", () => {
    it("Returns an error object with code 400", async () => {
      const response = await request(app).post(ROUTE).send({})
      expect(response.body).toEqual({ simpleError: "Username or password missing", code: 400 } as BackendError)
    })
  })
})

const userWhereMock = jest.mocked(User.where, true)
const compareMock = jest.mocked(bcrypt.compare, true).mockImplementation(
  async (data: string | Buffer, encrypted: string) => {
    return data === encrypted
  }
)

describe("POST /users/login", () => {
  const ROUTE = "/auth/users/login"

  const USERNAME = "someUsername"
  const PASSWORD = "somePassword"
  const USER_ID = "someId"

  describe("When given a valid username", () => {
    beforeAll(() => {
      userWhereMock.mockReset()
      userWhereMock.mockResolvedValue({ id: USER_ID, username: USERNAME, password: PASSWORD })
    })

    describe("When given a valid username and password", () => {
      const responseContainer = new Updatable<request.Response>()
      beforeAll(async () => {
        responseContainer.update(await request(app).post(ROUTE).send({
          username: USERNAME,
          password: PASSWORD
        }))
      })

      it("Searches database for the given user", async () => {
        expect(userWhereMock).toHaveBeenCalledWith("username", USERNAME)
      })

      it("Compares given password to the one saved on the database", () => {
        expect(compareMock).toHaveBeenCalledWith(PASSWORD, PASSWORD)
      })

      itBehavesLikeGenerateAndSendTokens(responseContainer, USER_ID)
    })

    describe("When given a valid username and an invalid password", () => {
      const INVALID_PASSWORD = "someInvalidPassword"

      const responseContainer = new Updatable<request.Response>()
      beforeAll(async () => {
        responseContainer.update(await request(app).post(ROUTE).send({
          username: USERNAME,
          password: INVALID_PASSWORD
        }))
      })

      it("Responds with an error object and code 400", () => {
        expect(responseContainer.getContent().body).toEqual({
          complexError: { email: "Username or password is incorrect", password: "Username or password is incorrect" },
          code: 400
        })
      })
    })

    describe("When given the username for a user with a third-party account", () => {
      beforeAll(() => {
        userWhereMock.mockReset()
        userWhereMock.mockResolvedValue({ id: USER_ID, username: USERNAME })
      })

      it("Responds with an error with code 400", async () => {
        const response = await request(app).post(ROUTE).send({ username: USERNAME, password: PASSWORD })
        expect(response.body).toEqual({
          complexError: { email: "User already exists with third party account", password: "" },
          code: 400
        })
      })
    })
  })

  describe("When given an invalid username", () => {
    beforeAll(() => {
      userWhereMock.mockReset()
      // When the User.where function cannot find given user, it should throw an error
      userWhereMock.mockImplementation(
        (type: UserSearchParam, param: string) => {
          throw { simpleError: "No users found", code: 400 } as BackendError
        }
      )
    })

    it("Responds with an error object with code 400", async () => {
      const response = await request(app).post(ROUTE).send({ username: USERNAME, password: PASSWORD })
      expect(response.body).toEqual({ simpleError: "No users found", code: 400 })
    })
  })

  describe("When given no input", () => {
    it("Responds with an error object and code 400", async () => {
      const response = await request(app).post(ROUTE).send({})
      expect(response.body).toEqual({ simpleError: "A valid username is required!", code: 400 })
    })
  })
})