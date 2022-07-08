import { BackendError } from "../../custom"
import database from "../../herokuClient"
import Blog from "../../models/blog"
import User from "../../models/user"

// Test user
let userId: string
// Test blog
let blog: Blog

// Perform setup
beforeAll(async () => {
  // Connect to the database
  await database.connect()
  // Create test user if it does not exist
  try {
    const user = await User.create("testUser", "password")
    userId = user.id
  } catch (err) {
    console.log("FAILED TO CREATE TEST USER", err)
  }
})

// Perform teardown
afterAll(async () => {
  // Delete the test user
  await User.delete(userId)

  // Close database connection
  await database.end()
})

describe("save", () => {
  const summaryTitle = "Sample altered summary title"
  const summaryDescription = "Sample altered summary description"
  const html = `
    <head>
      <meta property="og:title" content="${summaryTitle}" />
      <meta property="og:description" content="${summaryDescription}" />
    </head>
    <body>
      <h1>Sample Altered Title</h1>
      <p>Sample altered article content...</p>
    </body>
  `
  const css = `
    h1 {
      color: green;
    }
    p {
      color: yellow;
    }
  `
  let blogId = ""

  describe("When a valid blog is provided", () => {
    describe("When a new blog with no blog id is given", () => {
      it("Creates a new blog entry and returns the blog id", async () => {
        // First create the blog
        const summaryTitle = "Sample summary title"
        const summaryDescription = "Sample summary description"
        const html = `
          <head>
            <meta property="og:title" content="${summaryTitle}" />
            <meta property="og:description" content="${summaryDescription}" />
          </head>
          <body>
            <h1>Sample Title</h1>
            <p>Sample article content...</p>
          </body>
        `
        const css = `
          h1 {
            color: red;
          }
          p {
            color: blue;
          }
        `
        blogId = await Blog.save(userId, html, css)

        // Now get the blog
        blog = await Blog.where(blogId)

        // Now test it
        expect(blog.id).toBe(blogId)
        expect(blog.userId).toBe(userId)
        expect(blog.html).toBe(html)
        expect(blog.css).toBe(css)
        expect(blog.summaryTitle).toBe(summaryTitle)
        expect(blog.summaryDescription).toBe(summaryDescription)
      })
    })

    describe("When a valid blog with an existing id is provided", () => {
      it("Saves the changes to the existing blog", async () => {
        // Save the blog
        await Blog.save(userId, html, css, blogId)
        // Now get it
        blog = await Blog.where(blogId)

        // Now test it
        expect(blog.id).toBe(blogId)
        expect(blog.userId).toBe(userId)
        expect(blog.html).toBe(html)
        expect(blog.css).toBe(css)
        expect(blog.summaryTitle).toBe(summaryTitle)
        expect(blog.summaryDescription).toBe(summaryDescription)
      })
    })
  })

  describe("When an invalid blog or user is provided", () => {
    describe("When a blog is provided with an invalid blog id", () => {
      it('Throws an error with error code 404', async () => {
        let blogId: string | undefined = undefined
        try {
          blogId = await Blog.save(userId, html, css, "c000f1a7-bac1-4072-9c70-53f8a62a3047")
        } catch (err) {
          expect(err).toEqual({ simpleError: "No blog with matching id found", code: 404 } as BackendError)
        }
        expect(blogId).toBeUndefined()
      })
    })

    describe("When a blog is provided with an invalid user id", () => {
      describe("When the given user is a valid user but cannot edit the given blog id", () => {
        let newBlogId = ""
        let newUser: User
        // Setup the new user and the new blog
        beforeAll(async () => {
          // Make a new user
          newUser = await User.create("testUser2", "password2")
          // Make a blog by this user
          const newHtml = "Nothing!"
          const newCss = "No css!"
          newBlogId = await Blog.save(newUser.id, newHtml, newCss)
        })

        // Teardown the new user and the new blog
        afterAll(async () => {
          // Delete the blog
          await Blog.delete(newBlogId, newUser.id)
          // Delete the user
          await User.delete(newUser.id)
        })

        it("Throws an error with error code 403", async () => {
          // Now try to save edits using a different user id
          let returningBlogId: string | undefined = undefined
          try {
            returningBlogId = await Blog.save(userId, html, css, newBlogId)
          } catch (err) {
            expect(err).toEqual({ simpleError: "User cannot edit or delete this blog", code: 403 } as BackendError)
          }
          expect(returningBlogId).toBeUndefined()
        })
      })

      describe("When the given user does not exist attempting to edit a valid blog id", () => {
        it("Throws an error with error code 403", async () => {
          let ReturningBlogId: string | undefined = undefined
          try {
            ReturningBlogId = await Blog.save("685f942e-5feb-47dc-bace-53c8f65dd3da", html, css, blogId)
          } catch (err) {
            expect(err).toEqual({ simpleError: "User cannot edit or delete this blog", code: 403 } as BackendError)
          }
          expect(ReturningBlogId).toBeUndefined()
        })
      })

      describe("When the given user does not exist attempting to create a new blog", () => {
        it("Throws an error with code 500", async () => {
          let returningBlogId: string | undefined
          try {
            returningBlogId = await Blog.save("3a1956d7-d425-4c38-97ed-8ed32f1dbc0d", html, css)
          } catch (err) {
            const castErr = err as BackendError
            expect("unknownError" in castErr).toBe(true)
            expect(castErr.code).toBe(500)
          }
          expect(returningBlogId).toBeUndefined()
        })
      })
    })
  })
})

describe("where", () => {
  describe("When a valid blog id is provided", () => {
    it("Returns an instance of the requested blog", async () => {
      const blog = await Blog.where("9634ef44-d2bf-4af0-afb6-72e9dcff0899")
      expect(blog.id).toBe("9634ef44-d2bf-4af0-afb6-72e9dcff0899")
      expect(blog.userId).toBe("8e637019-bf89-46a9-909a-dbb532647eaf")
      expect(blog.summaryTitle).toBe("Article 2")
      expect(blog.summaryDescription).toBe("Article 2 summary")
    })
  })

  describe("When an invalid blog id is provided", () => {
    describe("When the blog id is not a valid uuid", () => {
      it("Throws an unknown error with status code 500", async () => {
        let thrownErr: BackendError = { simpleError: "Test!", code: 200 }
        try {
          await Blog.where("invalidID")
        } catch (err) {
          thrownErr = err as BackendError
        }

        expect(("unknownError" in thrownErr)).toBeTruthy()
        expect(thrownErr.code).toBe(500)
      })
    })

    describe("When the blog id is a valid uuid but does not exist on the database", () => {
      it("Returns a simpleError object with code 400", async () => {
        let thrownErr
        try {
          await Blog.where("21cbb5c4-2c8e-43f1-82a1-f679df241ef4")
        } catch (err) {
          thrownErr = err
        }

        expect(thrownErr).toEqual({ simpleError: "Given blog id does not exist!", code: 400 } as BackendError)
      })
    })
  })
})

describe("delete", () => {
  describe("When valid user and blog id are provided", () => {
    it("Deletes the given blog and returns the deleted blog id", async () => {
      // Delete the blog
      const blogId = await Blog.delete(blog.id, userId)
      expect(blogId).toBe(blog.id)

      // See if the blog still exists
      let deletedId: string | undefined = undefined
      try {
        await Blog.where(blog.id)
      } catch (err) {
        const castErr = err as BackendError
        expect(err).toEqual({ simpleError: "Given blog id does not exist!", code: 400 } as BackendError)
      }
      expect(deletedId).toBeUndefined()
    })
  })
})