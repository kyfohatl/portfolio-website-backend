import User from "../../models/user"
import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"
import request from "supertest"
import app from "../../expressApp"

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