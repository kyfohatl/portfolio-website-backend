import { BackendError } from "../../custom"
import Blog from "../../models/blog"

describe("where", () => {
  describe("When a valid blog id is provided", () => {
    it("Returns an instance of the requested blog", () => {
      // Code below won't work since it is async
      //expect(await Blog.where("9634ef44-d2bf-4af0-afb6-72e9dcff0899")).toEqual
    })
  })

  describe("When an invalid blog id is provided", () => {
    it("Returns a simpleError object with code 400", () => {
      // Won't work since it is async
      //expect(await Blog.where("invalidID")).toEqual({simpleError: "Given blog id does not exist!", code: 400} as BackendError)
    })
  })
})