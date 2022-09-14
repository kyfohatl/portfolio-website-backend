import request from "supertest"
import { BackendError } from "../../custom"
import app from "../../expressApp"
import Blog, { NEGATIVE_OFFSET_OR_LIMIT_TXT, NO_BLOGS_TXT } from "../../models/blog"
import User from "../../models/user"
import { DEFAULT_BLOGS_LIMIT } from "../../routes/blog"
import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"

const USERNAME = "someBlogUsername"
const PASSWORD = "someBlogPassword"
let user: User

// Run setup processes
beforeAll(async () => {
  await runTestEnvSetup()

  // Create a test user
  user = await User.create(USERNAME, PASSWORD)
})

// Run teardown processes
afterAll(async () => {
  // Delete test user
  await User.delete("username", USERNAME)

  await runTestEnvTeardown()
})

describe("GET /", () => {
  const ROUTE = "/blog/"

  describe("When there are blogs present in the database", () => {
    const BASE_HTML = "someHtml"
    const BASE_CSS = "someCss"
    const NUM_BLOGS = 30
    const blogIds: string[] = []

    beforeAll(async () => {
      // Create some test blogs
      for (let i = 0; i < NUM_BLOGS; i++) {
        blogIds.push(await Blog.save(user.id, BASE_HTML + i, BASE_CSS + i))
      }
    })

    afterAll(async () => {
      // Cleanup test blogs
      for (const blogId of blogIds) {
        await Blog.delete(blogId, user.id)
      }
    })

    describe("When given a valid offset and a valid limit", () => {
      const LIMIT = 10

      function itBehavesLikeGetBlogsList(offset: number) {
        it("Responds with the list of requested blogs", async () => {
          const response = await request(app).get(ROUTE).query({ page: offset, limit: LIMIT })
          expect(response.body.success.blogs).toHaveLength(LIMIT)
          for (let i = 0; i < LIMIT; i++) {
            expect(response.body.success.blogs[i].html).toBe(BASE_HTML + (i + offset))
            expect(response.body.success.blogs[i].css).toBe(BASE_CSS + (i + offset))
            expect(response.body.success.blogs[i].userId).toBe(user.id)
          }
        })
      }

      describe("When the offset is 0", () => {
        const OFFSET = 0
        itBehavesLikeGetBlogsList(OFFSET)
      })

      describe("When the offset is not 0", () => {
        const OFFSET = 12
        itBehavesLikeGetBlogsList(OFFSET)
      })
    })

    function itBehavesLikeNegativeNumberError(offset: number, limit: number) {
      it("Responds with an error object with code 404", async () => {
        const response = await request(app).get(ROUTE).query({ page: offset, limit: limit })
        expect(response.body).toEqual({ simpleError: NEGATIVE_OFFSET_OR_LIMIT_TXT, code: 404 } as BackendError)
      })
    }

    describe("When given an invalid offset", () => {
      const LIMIT = 10

      describe("When the offset is a positive number", () => {
        const OFFSET = NUM_BLOGS + 20

        it("Responds with an error object with code 404", async () => {
          const response = await request(app).get(ROUTE).query({ page: OFFSET, limit: LIMIT })
          expect(response.body).toEqual({ simpleError: NO_BLOGS_TXT, code: 404 } as BackendError)
        })
      })

      describe("When the offset is a negative number", () => {
        const OFFSET = -8
        itBehavesLikeNegativeNumberError(OFFSET, LIMIT)
      })
    })

    describe("When given an invalid limit", () => {
      const OFFSET = 20

      describe("When the limit is not a negative number", () => {
        describe("When the limit is 0", () => {
          const LIMIT = 0

          it("Responds with blogs according to a default limit", async () => {
            const response = await request(app).get(ROUTE).query({ page: OFFSET, limit: LIMIT })

            expect(response.body.success.blogs).toHaveLength(DEFAULT_BLOGS_LIMIT)

            for (let i = 0; i < DEFAULT_BLOGS_LIMIT; i++) {
              expect(response.body.success.blogs[i].html).toBe(BASE_HTML + (i + OFFSET))
              expect(response.body.success.blogs[i].css).toBe(BASE_CSS + (i + OFFSET))
              expect(response.body.success.blogs[i].userId).toBe(user.id)
            }
          })
        })

        describe("When the limit is greater than there are blogs remaining", () => {
          const LIMIT = 30

          it("Responds with a list of all remaining blogs", async () => {
            const response = await request(app).get(ROUTE).query({ page: OFFSET, limit: LIMIT })

            const numBlogsLeft = NUM_BLOGS - OFFSET
            expect(response.body.success.blogs).toHaveLength(numBlogsLeft)
            expect(response.body.success.blogs).not.toHaveLength(LIMIT)

            for (let i = 0; i < numBlogsLeft; i++) {
              expect(response.body.success.blogs[i].html).toBe(BASE_HTML + (i + OFFSET))
              expect(response.body.success.blogs[i].css).toBe(BASE_CSS + (i + OFFSET))
              expect(response.body.success.blogs[i].userId).toBe(user.id)
            }
          })
        })
      })

      describe("When the limit is a negative number", () => {
        const LIMIT = -6
        itBehavesLikeNegativeNumberError(OFFSET, LIMIT)
      })
    })
  })

  describe("When there are no blogs in the database", () => { })
})