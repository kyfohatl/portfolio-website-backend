import User from "../../models/user"
import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"
import request from "supertest"
import app from "../../expressApp"
import Updatable from "../../lib/Updatable"
import Token from "../../models/token"
import { CLEAR_ACC_TOKEN_COOKIE_STR, CLEAR_REF_TOKEN_COOKIE_STR } from "../../routes/auth"

// Run setup
beforeAll(async () => {
  await runTestEnvSetup()
})

// Run teardown
afterAll(async () => {
  await runTestEnvTeardown()
})

describe("POST /users", () => {
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
      const response = await request(app).post("/auth/users").send({ username: USERNAME, password: "Irrelevant" })
      expect(response.body).toEqual({ complexError: { email: 'Email already exists!' }, code: 400 })
    })
  })
})

describe("POST /users/login", () => {
  const ROUTE = "/auth/users/login"

  describe("When given a valid username and no password", () => {
    const USERNAME = "someUsername"
    const PASSWORD = "somePassword"
    let refreshToken: string

    const responseContainer = new Updatable<request.Response>()
    beforeAll(async () => {
      // Create test user
      const response = await request(app).post("/auth/users").send({ username: USERNAME, password: PASSWORD })
      refreshToken = response.body.success.tokens.refreshToken.token

      // Send request
      responseContainer.update(await request(app).post(ROUTE).send({ username: USERNAME }))
    })

    // Cleanup test environment
    afterAll(async () => {
      // Delete test user
      await User.delete("username", USERNAME)
      // Delete refresh token
      await Token.deleteRefreshToken(refreshToken)
    })

    it("Responds with an error object with code 500", () => {
      expect(responseContainer.getContent().body).toHaveProperty("unknownError")
      expect(responseContainer.getContent().body.code).toBe(500)
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