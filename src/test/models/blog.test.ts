import { BackendError } from "../../custom"
import database from "../../herokuClient"
import Blog from "../../models/blog"

// Setup database
beforeAll(async () => {
  await database.connect()
})
// Close connection once done
afterAll(async () => {
  await database.end()
})

describe("save", () => {
  const summaryTitle = "<meta property=\"og:title\" content=\"Sample altered summary title\" />"
  const summaryDescription = "<meta property\"og:description\" content=\"Sample altered summary description\" />"
  const html = `
    <head>
      ${summaryTitle}
      ${summaryDescription}
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
  const userId = "687f93c5-8280-4862-bbeb-fcabbe5631c5"
  let blogId = ""

  describe("When a valid blog is provided", () => {
    describe("When a new blog with no blog id is given", () => {
      it("Creates a new blog entry and returns the blog id", async () => {
        // First create the blog
        const summaryTitle = "<meta property=\"og:title\" content=\"Sample summary title\" />"
        const summaryDescription = "<meta property\"og:description\" content=\"Sample summary description\" />"
        const html = `
          <head>
            ${summaryTitle}
            ${summaryDescription}
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
        const blog = await Blog.where(blogId)

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
        const blog = await Blog.where(blogId)

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

  describe("When an invalid blog id is provided", () => {
    describe("When a blog is provided with an invalid blog id", () => { })

    describe("When a blog is provided with an invalid user id", () => {
      describe("When the given user is a valid user but cannot edit the given blog id", () => { })

      describe("When the given user does not exist", () => { })
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