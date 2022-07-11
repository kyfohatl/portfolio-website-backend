import { BackendError } from "../../custom"
import Database from "../../lib/Database"
import Blog from "../../models/blog"
import User from "../../models/user"

import dotenv from "dotenv"

if (!process.env.DOT_ENV_IS_RUNNING) {
  // Dot env is not running. Start it
  dotenv.config()
}

// Test user
let userId: string
// Test blog
let blog: Blog

// Perform setup
beforeAll(async () => {
  // Setup database client
  await Database.initialize(process.env.TEST_DATABASE_URL as string)
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
  await Database.closeConnection()
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
      const newBlog = await Blog.where(blog.id)
      expect(newBlog.id).toBe(blog.id)
      expect(newBlog.userId).toBe(blog.userId)
      expect(newBlog.summaryTitle).toBe(blog.summaryTitle)
      expect(newBlog.summaryDescription).toBe(blog.summaryDescription)
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

describe("saveTags", () => {
  const tags = ["Tag1", "Tag2", "Tag3"]

  describe("When given a valid blog id", () => {
    describe("When a valid list of tags is provided", () => {
      // Setup tags for testing
      beforeAll(async () => {
        // Save tags
        await Blog.saveTags(blog.id, tags)
      })

      // Clean up test tags once done
      afterAll(async () => {
        await Blog.removeTags(blog.id)
      })

      it("Saves the tags to the database", async () => {
        // Now get the blog again
        const blogWithTags = await Blog.where(blog.id)
        // Run tests
        expect(blogWithTags.tags).toEqual(tags)
      })
    })

    describe("When an empty list of tags is provided", () => {
      beforeAll(async () => {
        await Blog.saveTags(blog.id, [])
      })

      it("Does nothing", async () => {
        const blogWithTags = await Blog.where(blog.id)
        expect(blogWithTags.tags).toEqual([null])
      })
    })
  })

  describe("When given an invalid blog id", () => {
    it("Throws an error with code 500", async () => {
      let threwError = true
      try {
        await Blog.saveTags("3f55e384-9347-49e8-ac00-6c110ade859e", tags)
        threwError = false
      } catch (err) {
        const castErr = err as BackendError
        expect("unknownError" in castErr).toBe(true)
      }
      // Ensure an error was actually thrown
      expect(threwError).toBe(true)
    })
  })
})

describe("removeTags", () => {
  describe("When a valid blog id is given", () => {
    describe("When the blog has one or more tags", () => {
      const tags = ["Tag1", "Tag2"]
      // Add some test tags
      beforeAll(async () => {
        await Blog.saveTags(blog.id, tags)
      })

      it("Deletes them and returns a list of the deleted tags", async () => {
        // Remove the tags
        const removedTags = await Blog.removeTags(blog.id)
        // Check which tags have been removed
        const removedTagsList = removedTags.map((tag) => tag.tag)
        expect(removedTagsList).toEqual(tags)
        // Now get the blog again
        const blogWithTagsRemoved = await Blog.where(blog.id)
        // Ensure that there are no tags on the database
        expect(blogWithTagsRemoved.tags).toEqual([null])
      })
    })

    describe("When the blog has no tags", () => {
      it("Does nothing", async () => {
        // Remove tags
        const removedTags = await Blog.removeTags(blog.id)
        // Check that nothing war removed
        expect(removedTags).toEqual([])
        // Get the blog again
        const blogWithoutTags = await Blog.where(blog.id)
        // Ensure it still has not tags
        expect(blogWithoutTags.tags).toEqual([null])
      })
    })
  })

  describe("When an invalid blog id is given", () => {
    it("Returns an empty array of deleted tags", async () => {
      expect(await Blog.removeTags("dab1606e-6e27-4e71-84ec-57db25a44c71")).toEqual([])
    })
  })
})

describe("extractSummary", () => {
  describe("When the given blog has a valid summary", () => {
    describe("When the given blog has a summary and tags", () => {
      it("Extracts all of them and returns them", () => {
        const html = `
          <head>
            <meta property="og:title" content="Summary Title" />
            <meta property="og:description" content="Summary description" />
            <meta property="og:image" content="http://somedomain.com/image" />
            <meta name="keywords" content="Tag1, Tag2, Tag3" />
          </head>
        `
        const summary = Blog.extractSummary(html)

        expect(summary.title).toBe("Summary Title")
        expect(summary.description).toBe("Summary description")
        expect(summary.image).toBe("http://somedomain.com/image")
        expect(summary.tags).toEqual(["Tag1", "Tag2", "Tag3"])
      })
    })

    describe("When the given blog only has a summary", () => {
      it("Extracts the summaries and return them", () => {
        const html = `
          <head>
            <meta property="og:title" content="Summary Title" />
            <meta property="og:description" content="Summary description" />
            <meta property="og:image" content="http://somedomain.com/image" />
          </head>
        `
        const summary = Blog.extractSummary(html)

        expect(summary.title).toBe("Summary Title")
        expect(summary.description).toBe("Summary description")
        expect(summary.image).toBe("http://somedomain.com/image")
        expect(summary.tags).toEqual([])
      })
    })

    describe("When the given blog only has tags", () => {
      it("Extracts and return the tags", () => {
        const html = `
          <head>
            <meta name="keywords" content="Tag1, Tag2, Tag3" />
          </head>
        `
        const summary = Blog.extractSummary(html)

        expect(summary.title).toBe("")
        expect(summary.description).toBe("")
        expect(summary.image).toBe("")
        expect(summary.tags).toEqual(["Tag1", "Tag2", "Tag3"])
      })
    })
  })

  describe("When the given blog does not have a valid summary", () => {
    it("Returns empty fields for tags and all summaries", () => {
      const html = `
        <head>
          <meta property="og:invalid" content="Some content" />
          <meta property="invalid" content="Some content 2" />
          <meta property="og:title" invalid="Some content 3" />
          <meta name="invalid" content="Some content 4" />
          <meta name="keyword" invalid="Some content 5" />
          <invalid name="keyword" content="Tag1, Tag2" />
        </head>
      `
      const summary = Blog.extractSummary(html)

      expect(summary.title).toBe("")
      expect(summary.description).toBe("")
      expect(summary.image).toBe("")
      expect(summary.tags).toEqual([])
    })
  })
})

describe("delete", () => {
  describe("When an invalid blog id is provided", () => {
    const invalidBlogId = "e52abf44-f8ff-49df-a1ab-bfd067e7669d"
    describe("When the user id is valid", () => {
      it("Throws an error with code 404", async () => {
        let deletedId: string | undefined = undefined
        try {
          deletedId = await Blog.delete(invalidBlogId, userId)
        } catch (err) {
          expect(err).toEqual({ simpleError: "No blog with matching id found", code: 404 } as BackendError)
        }
        expect(deletedId).toBeUndefined()
      })
    })

    describe("When the user id is invalid", () => {
      it("Throws an error with code 404", async () => {
        let deletedId: string | undefined = undefined
        try {
          deletedId = await Blog.delete(invalidBlogId, "331af49d-2df8-4a17-92c5-3891dd5a81d2")
        } catch (err) {
          expect(err).toEqual({ simpleError: "No blog with matching id found", code: 404 } as BackendError)
        }
        expect(deletedId).toBeUndefined()
      })
    })
  })

  describe("When a valid blog id is provided", () => {
    describe("When an invalid user id is provided", () => {
      describe("When the given user id is a valid user but does not have permission to delete this blog", () => {
        // Create a test user
        let newUser: User
        beforeAll(async () => {
          newUser = await User.create("testUser3", "password3")
        })

        // Delete test user once done
        afterAll(async () => {
          await User.delete(newUser.id)
        })

        it("Throws an error with code 403", async () => {
          let deletedId: string | undefined = undefined
          try {
            deletedId = await Blog.delete(blog.id, newUser.id)
          } catch (err) {
            expect(err).toEqual({ simpleError: "User cannot edit or delete this blog", code: 403 } as BackendError)
          }
          expect(deletedId).toBeUndefined()
        })
      })

      describe("When the given user id is not a valid user", () => {
        it("Throws an error with code 403", async () => {
          let deletedId: string | undefined = undefined
          try {
            deletedId = await Blog.delete(blog.id, "e65dfa7b-9473-4a3b-a66a-3779697e4e63")
          } catch (err) {
            expect(err).toEqual({ simpleError: "User cannot edit or delete this blog", code: 403 } as BackendError)
          }
          expect(deletedId).toBeUndefined()
        })
      })
    })

    describe("When a valid user id is provided", () => {
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
})

describe("mostRecent", () => {
  // beforeAll(async () => {
  //   const user = await User.create("Hello123", "abc")
  //   const blog = await Blog.save(user.id, "Some html", "Some css")
  // })

  // it("nothing", () => {
  //   expect(1).toBe(1)
  // })
})