import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"

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
  

  describe("When given a valid token", () => {
    it("Returns token data along with true", () => {})
  })

  describe("When given an invalid token", () => {
    it("Returns and object containing false", () => {})
  })
})