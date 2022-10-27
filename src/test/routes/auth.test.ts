import { NextFunction, Request, Response } from "express"
import * as sendResponseModule from "../../lib/sendResponse"
import Token from "../../models/token"
import User, { UserSearchParam } from "../../models/user"
import { sendTokens, SALT_ROUNDS, CLEAR_ACC_TOKEN_COOKIE_STR, CLEAR_REF_TOKEN_COOKIE_STR, handleOpenIdCallback, GOOGLE_FRONTEND_REDIR_ADDR, incorrectUserOrPassStr } from "../../routes/auth"
import request from "supertest"
import bcrypt from "bcrypt"
import app from "../../expressApp"
import { AuthService, BackendError, BackendResponse } from "../../custom"
import Updatable from "../../lib/Updatable"
import { FACEBOOK_CALLBACK_ADDR, GOOGLE_CALLBACK_ADDR, initializeAuthClients } from "../../middleware/auth"
import { expressStorage } from "../../lib/storage"
import { BaseClient, CallbackExtras, CallbackParamsType, generators, OpenIDCallbackChecks, TokenSet } from "openid-client"
import { resetMockAndSetImplementation, resetMockAndSetResolveValue } from "../test_helpers/jestHelpers"

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
      expect(response.body).toEqual({
        complexError: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr },
        code: 400
      } as BackendError)
    })
  })

  describe("When given no input", () => {
    it("Responds with an error object and code 400", async () => {
      const response = await request(app).post(ROUTE).send({})
      expect(response.body).toEqual({ simpleError: "A valid username is required!", code: 400 })
    })
  })
})

const verifyRefTokenMock = jest.mocked(Token.verifyRefToken, true)
const deleteRefreshTokenMock = jest.mocked(Token.deleteRefreshToken, true)

describe("POST /token", () => {
  const ROUTE = "/auth/token"
  const REFRESH_TOKEN = "someFakeRefreshToken"

  describe("When a valid refresh token is sent as a cookie", () => {
    const USER_ID = "someFakeId"
    const responseContainer = new Updatable<request.Response>()

    beforeAll(async () => {
      verifyRefTokenMock.mockReset()
      deleteRefreshTokenMock.mockReset()

      verifyRefTokenMock.mockResolvedValue({ isValid: true, user: { id: USER_ID } })
      deleteRefreshTokenMock.mockResolvedValue()

      // Send the request
      responseContainer.update(await request(app).post(ROUTE).set("Cookie", [`refreshToken=${REFRESH_TOKEN}`]))
    })

    it("Ensures that the given token is valid", () => {
      expect(verifyRefTokenMock).toHaveBeenCalledWith(REFRESH_TOKEN)
    })

    it("Deletes the given refresh token from the database", () => {
      expect(deleteRefreshTokenMock).toHaveBeenCalledWith(REFRESH_TOKEN)
    })

    itBehavesLikeGenerateAndSendTokens(responseContainer, USER_ID)
  })

  describe("When an invalid refresh token is sent as a cookie", () => {
    const responseContainer = new Updatable<request.Response>()

    beforeAll(async () => {
      verifyRefTokenMock.mockReset()
      verifyRefTokenMock.mockResolvedValue({ isValid: false })

      // Send request
      responseContainer.update(await request(app).post(ROUTE).set("Cookie", [`refreshToken=${REFRESH_TOKEN}`]))
    })

    it("Attempts to verify the given refresh token", () => {
      expect(verifyRefTokenMock).toHaveBeenCalledWith(REFRESH_TOKEN)
    })

    it("Sends an error response with code 403", () => {
      expect(responseContainer.getContent().body).toEqual({ simpleError: "Invalid refresh token", code: 403 })
    })
  })

  describe("When no refresh token is sent in the cookies", () => {
    it("Sends an error response with code 401", async () => {
      const response = await request(app).post(ROUTE)
      expect(response.body).toEqual({ simpleError: "No refresh token given!", code: 401 })
    })
  })
})

describe("DELETE /users/logout", () => {
  const ROUTE = "/auth/users/logout"
  const REFRESH_TOKEN = "someFakeRefreshToken"

  describe("When a valid refresh token is given", () => {
    const responseContainer = new Updatable<request.Response>()

    function itBehavesLikeValidToken() {
      it("Attempts to delete the given token from database", () => {
        expect(deleteRefreshTokenMock).toHaveBeenCalledWith(REFRESH_TOKEN)
      })

      it("Sends back a response to clear cookies with status code 204", () => {
        expect(responseContainer.getContent().statusCode).toBe(204)
        expect(responseContainer.getContent().headers['set-cookie']).toEqual([
          CLEAR_ACC_TOKEN_COOKIE_STR,
          CLEAR_REF_TOKEN_COOKIE_STR
        ])
      })
    }

    describe("When the token is sent as a cookie", () => {
      beforeAll(async () => {
        deleteRefreshTokenMock.mockReset()
        deleteRefreshTokenMock.mockResolvedValue()

        // Send request
        responseContainer.update(await request(app).delete(ROUTE).set("Cookie", [`refreshToken=${REFRESH_TOKEN}`]))
      })

      itBehavesLikeValidToken()
    })

    describe("When the token is sent in the request body", () => {
      beforeAll(async () => {
        deleteRefreshTokenMock.mockReset()
        deleteRefreshTokenMock.mockResolvedValue()

        // send request
        responseContainer.update(await request(app).delete(ROUTE).send({ token: REFRESH_TOKEN }))
      })

      itBehavesLikeValidToken()
    })
  })

  describe("When no refresh token is given", () => {
    it("Responds with an error object with code 401", async () => {
      const response = await request(app).delete(ROUTE)
      expect(response.body).toEqual({ simpleError: "No refresh token given!", code: 401 })
    })
  })
})

// Mock the base client authorizationUrl method
const authorizationUrlMock = jest.fn()

// Mock the initializeClient middleware
jest.mock("../../middleware/auth")
const initializeAuthClientsMock = jest.mocked(initializeAuthClients, true)

// Mock the openid-client module
jest.mock("openid-client")
const generatorsMock = jest.mocked(generators, true)


describe("GET /login/:authService", () => {
  const ROUTE_BASE = "/auth/login/"

  // Returns true if the nonce cookie is present in the response headers, and false otherwise
  function hasNonceCookie(response: request.Response) {
    if (!("set-cookie" in response.headers)) return false

    const cookies = response.headers["set-cookie"] as string[]
    for (const cookie of cookies) {
      if (cookie.includes(`nonce=${NONCE}`)) return true
    }

    return false
  }

  // Setup mocks
  const AUTH_URL_RETURN = "someString"
  // A mock implementation of the authorizationUrl method
  function aUrlMockImplementation(scope?: string, response_mode?: string, nonce?: string) {
    return AUTH_URL_RETURN
  }

  // Returns a mock implementation of the initializeAuthClient method for the given client type
  function makeIacMockImplementation(type: AuthService) {
    // Reset authorizationUrl mock and set mock implementation
    resetMockAndSetImplementation(authorizationUrlMock, aUrlMockImplementation)

    return async (req: Request, res: Response, next: NextFunction) => {
      // Create a fake base client of the correct type
      expressStorage[type + "AuthClient"] = { authorizationUrl: authorizationUrlMock } as unknown as BaseClient
      // Call the route function
      next()
    }
  }

  // Mock implementation for the generators.nonce method
  const NONCE = "someRandomNonce"
  function nonceMockImplementation(bytes?: number) {
    return NONCE
  }

  function itBehavesLikeGenerateUrlAndRedirect(
    scope: string,
    responseMode: string,
    responseContainer: Updatable<request.Response>) {
    it("Uses the generator nonce function to generate a nonce", () => {
      expect(generatorsMock.nonce).toHaveBeenCalledTimes(1)
    })

    it("Builds a redirect url using the google auth client in the express storage object", () => {
      expect(authorizationUrlMock).toHaveBeenCalledWith({
        scope: scope,
        response_mode: responseMode,
        nonce: NONCE
      })
    })

    it("Sets the nonce as a cookie on the client", () => {
      expect(hasNonceCookie(responseContainer.getContent())).toBe(true)
    })

    it("Redirects the user to the url built by the authorizationUrl method of the google base client", () => {
      expect(responseContainer.getContent().redirect).toBe(true)
      expect(responseContainer.getContent().status).toBe(302)
      expect(responseContainer.getContent().headers.location).toBe(AUTH_URL_RETURN)
    })
  }

  describe("GET /login/google", () => {
    const ROUTE = ROUTE_BASE + "google"

    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      // Reset and setup a mock implementation of the middleware function called before the route
      resetMockAndSetImplementation(initializeAuthClientsMock, makeIacMockImplementation("google"))
      // Reset and setup a mock implementation of the generators.nonce method
      resetMockAndSetImplementation(generatorsMock.nonce, nonceMockImplementation)

      // Send the request
      responseContainer.update(await request(app).get(ROUTE))
    })

    itBehavesLikeGenerateUrlAndRedirect("openid email profile", "form_post", responseContainer)
  })

  describe("GET /login/facebook", () => {
    const ROUTE = ROUTE_BASE + "facebook"

    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      // Reset and setup a mock implementation of the middleware function called before the route
      resetMockAndSetImplementation(initializeAuthClientsMock, makeIacMockImplementation("facebook"))
      // Reset and setup a mock implementation of the generators.nonce method
      resetMockAndSetImplementation(generatorsMock.nonce, nonceMockImplementation)

      // Send the request
      responseContainer.update(await request(app).get(ROUTE))
    })

    itBehavesLikeGenerateUrlAndRedirect("openid email public_profile", "query", responseContainer)
  })

  describe("GET /auth/login/invalidRoute", () => {
    const ROUTE = ROUTE_BASE + "invalidRoute"

    beforeAll(() => {
      // Reset and setup the initializeAuthClient mock
      resetMockAndSetImplementation(
        initializeAuthClientsMock,
        async (req: Request, res: Response, next: NextFunction) => next()
      )
    })

    it("Responds with and error object with code 400", async () => {
      const response = await request(app).get(ROUTE)
      expect(response.body).toEqual({ simpleError: "Invalid auth service!", code: 400 })
    })
  })
})

const getThirdPartyUserOrCreateMock = jest.mocked(User.getThirdPartyUserOrCreate, true)

describe("handleOpenIdCallback", () => {
  const NONCE = "someNonce"
  const CALLBACK_PARAMS_RETURN = {} as CallbackParamsType

  describe("When given a valid request", () => {
    // Setup constants
    const SUB = "someSub"
    const EMAIL = "someEmail"
    const USER_ID = "someUserId"

    const ACC_TOKEN = "someAccessToken"
    const REF_TOKEN = "someRefreshToken"
    const ACC_TOKEN_EXP = 15
    const REF_TOKEN_EXP = 30

    // Sets up most mocks required for a valid test
    function setupMocks() {
      // Mock request
      const REQ = { cookies: { nonce: NONCE } } as Request
      // Mock response
      const RES = {
        append: jest.fn((field: string, value?: string | string[]) => { return {} }),
        redirect: jest.fn((url: string) => { }),
        json: jest.fn((body?: any) => { return {} })
      } as unknown as Response

      RES.status = jest.fn((code: number) => RES)

      // Mock tokenSet.claims method
      const mockClaims = jest.fn(() => {
        return { email: EMAIL, sub: SUB }
      })

      return { REQ, RES, mockClaims }
    }

    // Run beforeAll setup required for a valid test
    async function runBeforeAllSetup(
      type: AuthService,
      mockClaims: jest.Mock<{ email: string, sub: string }, []>,
      req: Request,
      res: Response
    ) {
      // Setup expressStorage to contain all required properties
      // Note that this mock needs to be setup in the beforeAll rather than in the describe block, because 
      // expressStorage is a single object, and hence when jest executes all describe blocks before running tests, the 
      // expressStorage object of one describe will override the one in the previous describe block
      expressStorage[type + "AuthClient"] = {
        callbackParams: jest.fn((input: Request) => {
          return CALLBACK_PARAMS_RETURN
        }),
        callback: jest.fn(async (
          redirectUri: string | undefined,
          parameters: CallbackParamsType,
          checks?: OpenIDCallbackChecks,
          extras?: CallbackExtras) => {
          return {
            claims: mockClaims
          } as unknown as TokenSet
        })
      } as unknown as BaseClient

      // Setup the User.getThirdPartyUserOrCreate method mock
      getThirdPartyUserOrCreateMock.mockReset()
      getThirdPartyUserOrCreateMock.mockResolvedValue({ id: USER_ID, username: EMAIL })
      // Setup the Token.generateTokenPair method mock 
      generateTokenPairMock.mockReset()
      generateTokenPairMock.mockResolvedValue({
        accessToken: { token: ACC_TOKEN, expiresInSeconds: ACC_TOKEN_EXP },
        refreshToken: { token: REF_TOKEN, expiresInSeconds: REF_TOKEN_EXP }
      })

      // Call the function
      await handleOpenIdCallback(req, res, type)
    }

    function itBehavesLikeValidRequest(
      type: AuthService,
      callBackAddr: string,
      req: Request,
      res: Response,
      mockClaims: jest.Mock<{ email: string, sub: string }, []>
    ) {
      it("Calls the callBackParams method of the base client with the given request", () => {
        expect(expressStorage[type + "AuthClient"].callbackParams).toHaveBeenCalledWith(req)
      })

      it("Calls the callback method on the base client and gives it the required parameters", () => {
        expect(expressStorage[type + "AuthClient"].callback).toHaveBeenCalledWith(
          callBackAddr,
          CALLBACK_PARAMS_RETURN,
          { nonce: NONCE }
        )
      })

      it("Calls the tokenSet claims method", () => {
        expect(mockClaims).toHaveBeenCalledTimes(1)
      })

      it("Attempts to get or create a third party user with the information received from the tokenSet claims", () => {
        expect(getThirdPartyUserOrCreateMock).toHaveBeenCalledWith(type, SUB, EMAIL)
      })

      it("Generates an access and refresh token pair", () => {
        expect(generateTokenPairMock).toHaveBeenCalledWith({ id: USER_ID })
      })

      it("Sets the access and refresh tokens as cookies for the client", () => {
        expect(res.append).toHaveBeenCalledWith("Set-Cookie", [
          `accessToken=${ACC_TOKEN}; Max-age=${ACC_TOKEN_EXP}; HttpOnly; Path=/; SameSite=None; Secure`,
          `refreshToken=${REF_TOKEN}; Max-age=${REF_TOKEN_EXP}; HttpOnly; Path=/; SameSite=None; Secure`
        ])
      })
    }

    describe("When google is the client type", () => {
      const CLIENT_TYPE = "google"

      // Setup most required mocks
      const { REQ, RES, mockClaims } = setupMocks()

      beforeAll(async () => {
        // Setup expressStorage mock, reset other required mocks, and call the function
        await runBeforeAllSetup(CLIENT_TYPE, mockClaims, REQ, RES)
      })

      itBehavesLikeValidRequest("google", GOOGLE_CALLBACK_ADDR, REQ, RES, mockClaims)

      it("Redirects the user to the client to the google redirection address", () => {
        expect(RES.redirect).toHaveBeenCalledWith(GOOGLE_FRONTEND_REDIR_ADDR + `?userid=${USER_ID}`)
      })
    })

    describe("When facebook is the client type", () => {
      const CLIENT_TYPE = "facebook"

      // Setup most required mocks
      const { REQ, RES, mockClaims } = setupMocks()

      beforeAll(async () => {
        // Setup expressStorage mock, reset other required mocks, and call the function
        await runBeforeAllSetup(CLIENT_TYPE, mockClaims, REQ, RES)
      })

      itBehavesLikeValidRequest(CLIENT_TYPE, FACEBOOK_CALLBACK_ADDR, REQ, RES, mockClaims)

      it("Sends a successful response with the tokens and user id", () => {
        expect(RES.json).toHaveBeenCalledWith(
          {
            success: {
              tokens: {
                accessToken: { token: ACC_TOKEN, expiresInSeconds: ACC_TOKEN_EXP },
                refreshToken: { token: REF_TOKEN, expiresInSeconds: REF_TOKEN_EXP }
              },
              userId: USER_ID
            }
          } as BackendResponse
        )
      })
    })
  })

  describe("When given an invalid request", () => {
    describe("When the nonce is not present in the request cookies", () => {
      const REQ = { cookies: {} } as Request
      const RES = {} as Response

      it("Throws an error object with code 500", async () => {
        let threwErr = true
        try {
          await handleOpenIdCallback(REQ, RES, "google")
          threwErr = false
        } catch (err) {
          expect(err).toEqual({ simpleError: "Missing nonce!", code: 500 } as BackendError)
        }
        expect(threwErr).toBe(true)
      })
    })

    describe("When the required client has not been initialized", () => {
      const CLIENT_TYPE = "google"
      const REQ = { cookies: { nonce: NONCE } } as Request
      const RES = {} as Response

      beforeAll(() => {
        // Clear out the expressStorage googleAuthClient property if it exists, jst for this test
        delete expressStorage[CLIENT_TYPE + "AuthClient"]
      })

      it("Throws an error object with code 500", async () => {
        let threwErr = true
        try {
          await handleOpenIdCallback(REQ, RES, CLIENT_TYPE)
          threwErr = false
        } catch (err) {
          expect(err).toEqual({ simpleError: "Client has not been initialized", code: 500 } as BackendError)
        }
        expect(threwErr).toBe(true)
      })
    })

    describe("When the given third party client does not provide an email", () => {
      const REQ = { cookies: { nonce: NONCE } } as Request
      const RES = {} as Response
      const CLIENT_TYPE = "facebook"

      const mockClaims = jest.fn(() => { return { someRandom: "invalid" } })

      beforeAll(() => {
        // Setup the express storage base client
        expressStorage[CLIENT_TYPE + "AuthClient"] = {
          callbackParams: jest.fn((input: Request) => {
            return CALLBACK_PARAMS_RETURN
          }),
          callback: jest.fn(async (
            redirectUri: string | undefined,
            parameters: CallbackParamsType,
            checks?: OpenIDCallbackChecks,
            extras?: CallbackExtras) => {
            return {
              claims: mockClaims
            } as unknown as TokenSet
          })
        } as unknown as BaseClient
      })

      it("Throws an error with code 400", async () => {
        let threwErr = true
        try {
          await handleOpenIdCallback(REQ, RES, CLIENT_TYPE)
          threwErr = false
        } catch (err) {
          expect(err).toEqual({ simpleError: "Third party did not provide email!", code: 400 } as BackendError)
        }
        expect(threwErr).toBe(true)
      })
    })
  })
})