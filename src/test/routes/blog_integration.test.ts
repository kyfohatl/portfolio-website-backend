import request from "supertest"
import { BackendError } from "../../custom"
import app from "../../expressApp"
import Updatable from "../../lib/Updatable"
import { INVALID_TOKEN_TXT } from "../../middleware/auth"
import Blog, { BLOG_NOT_EXIST_TXT, INVALID_BLOG_ID_TXT, NEGATIVE_OFFSET_OR_LIMIT_TXT, NOT_AUTH_TO_EDIT_TXT, NO_BLOGS_TXT } from "../../models/blog"
import Token from "../../models/token"
import User from "../../models/user"
import { DEFAULT_BLOGS_LIMIT, MISSING_DETAILS_TXT } from "../../routes/blog"
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

  describe("When there are no blogs in the database", () => {
    it("It responds with an error object with code 404", async () => {
      const response = await request(app).get(ROUTE).query({ page: 0, limit: 10 })
      expect(response.body).toEqual({ simpleError: NO_BLOGS_TXT, code: 404 } as BackendError)
    })
  })
})

describe("GET /:blogId", () => {
  const BASE_ROUTE = "/blog/"

  describe("When the requested blog exists", () => {
    const HTML = "someHtml"
    const CSS = "someCss"
    let blogId: string

    beforeAll(async () => {
      // Create test blog
      blogId = await Blog.save(user.id, HTML, CSS)
    })

    afterAll(async () => {
      // Delete test blog
      await Blog.delete(blogId, user.id)
    })

    it("Responds with the requested blog", async () => {
      const response = await request(app).get(BASE_ROUTE + blogId)
      expect(response.body.success.blog.id).toBe(blogId)
      expect(response.body.success.blog.userId).toBe(user.id)
      expect(response.body.success.blog.html).toBe(HTML)
      expect(response.body.success.blog.css).toBe(CSS)
    })
  })

  describe("When the requested blog does not exist", () => {
    const BLOG_ID = "3ba6354e-3ccc-4b95-998f-fd263c7d7dd7"

    it("Responds with an error object with code 404", async () => {
      const response = await request(app).get(BASE_ROUTE + BLOG_ID)
      expect(response.body).toEqual({ simpleError: BLOG_NOT_EXIST_TXT, code: 404 } as BackendError)
    })
  })

  describe("When the given blog id is not a valid uuid", () => {
    it("Responds with an error object with code 500", async () => {
      const response = await request(app).get(BASE_ROUTE + "someInvalidId")
      expect(response.body.code).toBe(500)
    })
  })
})

describe("POST /create", () => {
  const ROUTE = "/blog/create"
  let accToken: string
  let refToken: string

  const HTML = "someHtml"
  const CSS = "someCss"

  describe("When requested by a valid user", () => {
    beforeAll(async () => {
      // Create and save token pair
      const tokenPair = await Token.generateTokenPair({ id: user.id })
      accToken = tokenPair.accessToken.token
      refToken = tokenPair.refreshToken.token
    })

    afterAll(async () => {
      // Delete refresh token
      await Token.deleteRefreshToken(refToken)
    })

    describe("When the request is providing valid parameters", () => {
      function itBehavesLikeSaveBlog(responseContainer: Updatable<request.Response>, html: string, css: string) {
        it("Responds with the blog id", () => {
          expect(responseContainer.getContent().body.success.id).toBeTruthy()
        })

        it("Saves the blog to the database", async () => {
          const blog = await Blog.where(responseContainer.getContent().body.success.id)
          expect(blog.id).toBe(responseContainer.getContent().body.success.id)
          expect(blog.userId).toBe(user.id)
          expect(blog.html).toBe(html)
          expect(blog.css).toBe(css)
        })
      }

      describe("When the user is creating a new blog", () => {
        const responseContainer = new Updatable<request.Response>()

        beforeAll(async () => {
          responseContainer.update(
            await request(app).post(ROUTE).set("Cookie", [`accessToken=${accToken}`]).send({ html: HTML, css: CSS })
          )
        })

        afterAll(async () => {
          // Delete test blog
          await Blog.delete(responseContainer.getContent().body.success.id, user.id)
        })

        itBehavesLikeSaveBlog(responseContainer, HTML, CSS)
      })

      describe("When the user is editing an existing blog", () => {
        const MODIFIED_HTML = "someModifiedHtml"
        const MODIFIED_CSS = "someModifiedCss"

        const responseContainer = new Updatable<request.Response>()
        let blogId: string

        beforeAll(async () => {
          // Create the test blog
          blogId = await Blog.save(user.id, HTML, CSS)
          // Now send the request with the modified blog
          responseContainer.update(
            await request(app).post(ROUTE).set("Cookie", [`accessToken=${accToken}`]).send(
              { html: MODIFIED_HTML, css: MODIFIED_CSS, blogId: blogId }
            )
          )
        })

        afterAll(async () => {
          // Delete test blog
          await Blog.delete(blogId, user.id)
        })

        itBehavesLikeSaveBlog(responseContainer, MODIFIED_HTML, MODIFIED_CSS)
      })
    })

    describe("When the request is missing html", () => {
      it("Responds with an error object with code 400", async () => {
        const response = await request(app).post(ROUTE).set("Cookie", [`accessToken=${accToken}`]).send(
          { css: "someCSS" }
        )

        expect(response.body).toEqual({ simpleError: MISSING_DETAILS_TXT, code: 400 } as BackendError)
      })
    })

    describe("When the request is attempting to edit a blog that does not exists", () => {
      it("Responds with an error object with code 404", async () => {
        const response = await request(app).post(ROUTE).set("Cookie", [`accessToken=${accToken}`]).send(
          { html: HTML, css: CSS, blogId: "558ea731-d7a0-4608-8903-6b317321de3c" }
        )
        expect(response.body).toEqual({ simpleError: INVALID_BLOG_ID_TXT, code: 404 } as BackendError)
      })
    })
  })

  describe("When requested by an invalid user", () => {
    describe("When the user is unable to authenticate", () => {
      it("Responds with an error object with code 401", async () => {
        const response = await request(app).post(ROUTE).set("Cookie", ["accessToken=someInvalidToken123"]).send(
          { html: HTML, css: CSS }
        )
        expect(response.body).toEqual({ simpleError: INVALID_TOKEN_TXT, code: 401 } as BackendError)
      })
    })

    describe("When the user is able to authenticate, but is not authorized to edit the blog", () => {
      const USERNAME2 = "someOtherBlogUsername"
      const PASSWORD2 = "someOtherBlogPassword"
      let newUser: User
      let blogId: string
      let accToken: string
      let refToken: string

      beforeAll(async () => {
        // Create a new test user
        newUser = await User.create(USERNAME2, PASSWORD2)
        // Create a test blog with a different user
        blogId = await Blog.save(user.id, HTML, CSS)
        // Create a valid token pair with the new user's id
        const tokenPair = await Token.generateTokenPair({ id: newUser.id })
        accToken = tokenPair.accessToken.token
        refToken = tokenPair.refreshToken.token
      })

      afterAll(async () => {
        // Delete the refresh token
        await Token.deleteRefreshToken(refToken)
        // Delete test blog
        await Blog.delete(blogId, user.id)
        // Delete test user
        await User.delete("username", USERNAME2)
      })

      it("Responds with an error object with code 403", async () => {
        const response = await request(app).post(ROUTE).set("Cookie", [`accessToken=${accToken}`]).send(
          { html: HTML, css: CSS, blogId }
        )
        expect(response.body).toEqual({ simpleError: NOT_AUTH_TO_EDIT_TXT, code: 403 } as BackendError)
      })
    })
  })
})

describe("DELETE /:blogId", () => {
  const BASE_ROUTE = "/blog/"
  const HTML = "someHtml"
  const CSS = "someCSS"
  let accToken: string
  let refToken: string

  beforeAll(async () => {
    // Create token pair
    const tokenPair = await Token.generateTokenPair({ id: user.id })
    accToken = tokenPair.accessToken.token
    refToken = tokenPair.refreshToken.token
  })

  afterAll(async () => {
    // Delete refresh token
    await Token.deleteRefreshToken(refToken)
  })

  describe("When requested by a valid user", () => {
    describe("When requesting to delete a valid blog", () => {
      let blogId: string
      let deletedBlogId: string

      beforeAll(async () => {
        // Create a test blog
        blogId = await Blog.save(user.id, HTML, CSS)
        // Now attempt to delete it
        const response = await request(app).delete(BASE_ROUTE + blogId).set("Cookie", [`accessToken=${accToken}`])
        deletedBlogId = response.body.success.id
      })

      it("Deletes the blog from the database", async () => {
        let threwErr = true
        try {
          await Blog.where(blogId)
          threwErr = false
        } catch (err) {
          expect(err).toEqual({ simpleError: BLOG_NOT_EXIST_TXT, code: 404 } as BackendError)
        }
        expect(threwErr).toBe(true)
      })

      it("Returns the id of the deleted blog", () => {
        expect(deletedBlogId).toBe(blogId)
      })
    })

    describe("When requesting to delete a blog that does not exist", () => {
      it("Responds with an error object with code 404", async () => {
        const response = await request(app).delete(BASE_ROUTE + "f6f87a68-96da-43f0-a81c-44701f92727c").set(
          "Cookie", [`accessToken=${accToken}`]
        )
        expect(response.body).toEqual({ simpleError: INVALID_BLOG_ID_TXT, code: 404 } as BackendError)
      })
    })
  })

  describe("When requested by an invalid user", () => {
    describe("When the user is not allowed to delete the given blog", () => {
      const USERNAME2 = "someOtherBlogUsername"
      const PASSWORD2 = "someOtherBlogPassword"
      let newUser: User
      let blogId: string

      beforeAll(async () => {
        // Create a new user
        newUser = await User.create(USERNAME2, PASSWORD2)
        // Create a test blog under the new user
        blogId = await Blog.save(newUser.id, HTML, CSS)
      })

      afterAll(async () => {
        // Delete test blog
        await Blog.delete(blogId, newUser.id)
        // Delete test user
        await User.delete("username", USERNAME2)
      })

      it("Responds with an error object with code 403", async () => {
        const response = await request(app).delete(BASE_ROUTE + blogId).set("Cookie", [`accessToken=${accToken}`])
        expect(response.body).toEqual({ simpleError: NOT_AUTH_TO_EDIT_TXT, code: 403 } as BackendError)
      })
    })
  })
})