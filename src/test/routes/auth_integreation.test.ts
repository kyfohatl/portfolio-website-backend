import User from "../../models/user"
import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"
import request from "supertest"
import app from "../../expressApp"
import Updatable from "../../lib/Updatable"
import Token from "../../models/token"

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