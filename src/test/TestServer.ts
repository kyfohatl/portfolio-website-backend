import app from "../expressApp"

type TestRequestMethod = "GET" | "POST" | "PUT" | "DELETE"

export default class TestServer {
  static #app = app
  static #isInitialized = false

  // Initializes the test express server
  static #initialize() {
    const PORT = process.env.TEST_SERVER_PORT || 8001
    TestServer.#app.listen(PORT, () => {
      console.log("Test server listening on port " + PORT)
    })
    TestServer.#isInitialized = true
  }

  // Sends a request to the test server, for the given route, with the given method, headers and body
  static async request(url: string, method: TestRequestMethod, headers: Record<string, string>, body: any) {
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