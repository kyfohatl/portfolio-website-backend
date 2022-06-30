import { Request, Response } from "express"
import app from "../expressApp"

type TestRequestMethod = "GET" | "POST" | "PUT" | "DELETE"

export default class TestServer {
  static #app = app
  static #isInitialized = false

  // Initializes additional test routes required for the test server
  static #initializeTestRoutes() {
    // A simple route that sends an express request and response objects back to origin for testing
    TestServer.#app.get("/test/reqAndRes", (req: Request, res: Response) => {
      res.json({req, res})
    })
  }

  // Initializes the test express server
  static #initialize() {
    // Initialize any additional test routes required
    TestServer.#initializeTestRoutes()

    // Now initialize the server itself
    const PORT = process.env.TEST_SERVER_PORT || 8001
    TestServer.#app.listen(PORT, () => {
      console.log("Test server listening on port " + PORT)
    })
    TestServer.#isInitialized = true
  }

  // Sends a request to the test server, for the given route, with the given method, headers and body
  static async request(url: string, method: TestRequestMethod, headers?: Record<string, string>, body?: any) {
    // Initialize test server if it has not been initialized already
    if (!TestServer.#isInitialized) TestServer.#initialize()

    const response = await fetch(url, {
      method: method,
      headers: headers,
      credentials: "include",
      body: JSON.stringify(body)
    })

    return response
  }
}