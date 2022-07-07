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