import User from "../../models/user"
import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"
import request from "supertest"
import app from "../../expressApp"
import Updatable from "../../lib/Updatable"
import Token from "../../models/token"
import { CLEAR_ACC_TOKEN_COOKIE_STR, CLEAR_REF_TOKEN_COOKIE_STR, incorrectUserOrPassStr } from "../../routes/auth"
import { AuthService, BackendError } from "../../custom"
import { expressStorage } from "../../lib/storage"

// Run setup
beforeAll(async () => {
  await runTestEnvSetup()
})

// Run teardown
afterAll(async () => {
  await runTestEnvTeardown()
})

describe("POST /users", () => {
  const ROUTE = "/auth/users"

  describe("When given a valid username and password", () => {
    const USERNAME = "someUsername"
    const PASSWORD = "somePassword"

    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      responseContainer.update(await request(app).post(ROUTE).send({ username: USERNAME, password: PASSWORD }))
    })

    // Cleanup user and refresh token
    afterAll(async () => {
      await Token.deleteRefreshToken(responseContainer.getContent().body.success.tokens.refreshToken.token)
      await User.delete("username", USERNAME)
    })

    it("Creates a new user on the database", async () => {
      const user = await User.where("username", USERNAME)
      expect(user.username).toBe(USERNAME)
    })

    it("Sets access and refresh tokens as cookies on the client", async () => {
      expect(responseContainer.getContent().headers["set-cookie"][0].includes("accessToken")).toBe(true)
      expect(responseContainer.getContent().headers["set-cookie"][1].includes("refreshToken")).toBe(true)
    })
  })

  describe("When given the username of an existing user", () => {
    const USERNAME = "someUsername"
    const PASSWORD = "somePassword"

    // Create a test user
    beforeAll(async () => {
      await User.create(USERNAME, PASSWORD)
    })

    // Delete test user
    afterAll(async () => {
      await User.delete("username", USERNAME)
    })

    it("Returns an error object with code 400", async () => {
      const response = await request(app).post(ROUTE).send({ username: USERNAME, password: "Irrelevant" })
      expect(response.body).toEqual({ complexError: { email: 'Email already exists!' }, code: 400 })
    })
  })
})

async function createTestUser(username: string, password: string) {
  const response = await request(app).post("/auth/users").send({ username, password })
  return response.body.success.tokens.refreshToken.token
}

async function deleteUserAndRefreshToken(username: string, refreshToken: string) {
  await User.delete("username", username)
  await Token.deleteRefreshToken(refreshToken)
}

describe("POST /users/login", () => {
  const ROUTE = "/auth/users/login"
  const USERNAME = "someUsername"
  const PASSWORD = "somePassword"

  describe("When given a valid username and a valid password", () => {
    // Setup
    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      // Create a test user
      const createUserResponse = await request(app)
        .post("/auth/users")
        .send({ username: USERNAME, password: PASSWORD })

      // Delete the refresh token created
      await Token.deleteRefreshToken(createUserResponse.body.success.tokens.refreshToken.token)

      // Send the request
      responseContainer.update(await request(app).post(ROUTE).send({ username: USERNAME, password: PASSWORD }))
    })

    // Clean up
    afterAll(async () => {
      // Delete refresh token
      await Token.deleteRefreshToken(responseContainer.getContent().body.success.tokens.refreshToken.token)
      // Delete test user
      await User.delete("username", USERNAME)
    })

    it("Sets access and refresh tokens as cookies on the client", async () => {
      expect(responseContainer.getContent().headers["set-cookie"][0].includes("accessToken")).toBe(true)
      expect(responseContainer.getContent().headers["set-cookie"][1].includes("refreshToken")).toBe(true)
    })
  })

  describe("When given a valid username and no password", () => {
    let refreshToken: string

    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      // Create test user and save the refresh token
      refreshToken = await createTestUser(USERNAME, PASSWORD)
      // Send request
      responseContainer.update(await request(app).post(ROUTE).send({ username: USERNAME }))
    })

    // Cleanup test environment
    afterAll(async () => {
      // Delete test user and refresh token
      await deleteUserAndRefreshToken(USERNAME, refreshToken)
    })

    it("Responds with an error object with code 500", () => {
      expect(responseContainer.getContent().body).toHaveProperty("unknownError")
      expect(responseContainer.getContent().body.code).toBe(500)
    })
  })

  describe("When given an invalid username with some password", () => {
    it("Responds with an error that describes either the username or password as being incorrect", async () => {
      const response = await request(app).post(ROUTE).send({ username: USERNAME, password: PASSWORD })
      expect(response.body).toEqual({
        complexError: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr },
        code: 400
      } as BackendError)
    })
  })

  describe("When given a valid username and an invalid password", () => {
    const INVALID_PASS = "someInvalidPassword"

    let refreshToken: string
    beforeAll(async () => {
      refreshToken = await createTestUser(USERNAME, PASSWORD)
    })

    afterAll(async () => {
      await deleteUserAndRefreshToken(USERNAME, refreshToken)
    })

    it("Responds with an error that describes either the username or password as being incorrect", async () => {
      const response = await request(app).post(ROUTE).send({ username: USERNAME, password: INVALID_PASS })
      expect(response.body).toEqual({
        complexError: { email: incorrectUserOrPassStr, password: incorrectUserOrPassStr },
        code: 400
      } as BackendError)
    })
  })
})

describe("POST /auth/token", () => {
  const ROUTE = "/auth/token"

  describe("When given a valid refresh token", () => {
    const USERNAME = "someUsername"
    const PASSWORD = "somePassword"

    // Setup
    const refreshToken1Container = new Updatable<string>()
    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      // Create test user
      const createUserResponse = await request(app).post("/auth/users").send({ username: USERNAME, password: PASSWORD })
      // Save the first refresh token
      refreshToken1Container.update(createUserResponse.body.success.tokens.refreshToken.token)

      // We need to wait before we ask for the next set of tokens, as currently jwt tokens are created based on 
      // user id and time. Since the id is the same, if the tokens are created very close in time, they will actually 
      // be exactly the same token
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))

      // Send the request
      responseContainer.update(await request(app).post(ROUTE).set(
        "Cookie",
        [`refreshToken=${refreshToken1Container.getContent()}`]
      ))
    })

    // Cleanup
    afterAll(async () => {
      // Delete refresh token
      const token = responseContainer.getContent().body.success.tokens.refreshToken.token
      await Token.deleteRefreshToken(token)
      // Delete test user
      await User.delete("username", USERNAME)
    })

    it("Deletes the old refresh token from the database", async () => {
      const firstTokenExists = await Token.doesTokenExist(refreshToken1Container.getContent())
      expect(firstTokenExists).toBe(false)
    })

    it("Generates and sets a new pair of access and refresh tokens as cookies on the client", () => {
      expect(responseContainer.getContent().headers["set-cookie"][0].includes("accessToken")).toBe(true)
      expect(responseContainer.getContent().headers["set-cookie"][1].includes("refreshToken")).toBe(true)
    })
  })

  describe("When given an invalid refresh token", () => {
    it("Responds with an error object with code 403", async () => {
      const response = await request(app).post(ROUTE).set("Cookie", ["refreshToken=someInvalidToken"])
      expect(response.body).toEqual({ simpleError: "Invalid refresh token", code: 403 } as BackendError)
    })
  })
})

describe("DELETE /auth/users/logout", () => {
  const ROUTE = "/auth/users/logout"
  const USERNAME = "someUsername"
  const tokenContainer = new Updatable<string>()

  function itBehavesLikeClearTokens(responseContainer: Updatable<request.Response>) {
    it("Attempts to clear existing token cookies from the frontend", () => {
      expect(responseContainer.getContent().headers["set-cookie"]).toEqual([
        CLEAR_ACC_TOKEN_COOKIE_STR,
        CLEAR_REF_TOKEN_COOKIE_STR
      ])
    })

    it("Responds with status code 204", () => {
      expect(responseContainer.getContent().statusCode).toBe(204)
    })
  }

  // Run setup
  beforeAll(async () => {
    // Create a test user
    const user = await User.create(USERNAME, "somePassword")
    // Create a test refresh token
    tokenContainer.update((await Token.generateRefreshToken({ id: user.id })).token)
  })

  // Run teardown
  afterAll(async () => {
    // Delete test user
    await User.delete("username", USERNAME)
  })

  describe("When a valid refresh token is given", () => {
    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      // Send the request
      responseContainer.update(
        await request(app).delete(ROUTE).set("Cookie", [`refreshToken=${tokenContainer.getContent()}`])
      )
    })

    it("Deletes given refresh token from the database", async () => {
      const tokenExists = await Token.doesTokenExist(tokenContainer.getContent())
      expect(tokenExists).toBe(false)
    })

    itBehavesLikeClearTokens(responseContainer)
  })

  describe("When an invalid refresh token is given", () => {
    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      // Send request
      responseContainer.update(
        await request(app).delete(ROUTE).set("Cookie", `refreshToken=${tokenContainer.getContent()}`)
      )
    })

    itBehavesLikeClearTokens(responseContainer)
  })
})

describe("GET /login/:authService", () => {
  const BASE_ROUTE = "/auth/login/"

  function itBehavesLikeValidOcid(type: AuthService, responseContainer: Updatable<request.Response>) {
    it("Generates a nonce and sets it as a cookie on the client", () => {
      expect(responseContainer.getContent().headers["set-cookie"][0].includes("nonce=")).toBe(true)
    })

    it("Creates a base client on the expressStorage global object", () => {
      expect((type + "AuthClient") in expressStorage).toBe(true)
    })

    it("Responds with a redirection", () => {
      expect(responseContainer.getContent().redirect).toBe(true)
      expect(responseContainer.getContent().statusCode).toBe(302)
      expect(responseContainer.getContent().headers["location"].includes(type)).toBe(true)
    })

    it("Has the same nonce present in the redirection link as the one in the cookies", () => {
      const linkNonce = responseContainer.getContent().headers["location"].match(/nonce=([a-z0-9\-_]*)/i)[1]
      const cookieNonce = responseContainer.getContent().headers["set-cookie"][0].match(/nonce=([a-z0-9\-_]*)/i)[1]
      expect(linkNonce).toBe(cookieNonce)
    })
  }

  beforeAll(() => {
    // Ensure the expressStorage global object is empty
    delete expressStorage.googleAuthClient
    delete expressStorage.facebookAuthClient
  })

  describe("GET /login/google", () => {
    const CLIENT_TYPE = "google"
    const ROUTE = BASE_ROUTE + CLIENT_TYPE

    // Setup
    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      responseContainer.update(await request(app).get(ROUTE))
    })

    itBehavesLikeValidOcid(CLIENT_TYPE, responseContainer)
  })

  describe("GET /login/facebook", () => {
    const CLIENT_TYPE = "facebook"
    const ROUTE = BASE_ROUTE + CLIENT_TYPE

    // Setup
    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      responseContainer.update(await request(app).get(ROUTE))
    })

    itBehavesLikeValidOcid(CLIENT_TYPE, responseContainer)
  })
})