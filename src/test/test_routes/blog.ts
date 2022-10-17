import express from "express"
import { TypedRequestBody } from "../../custom"
import { sendErrorResponse, sendSuccessResponse } from "../../lib/sendResponse"
import Blog from "../../models/blog"

export const router = express.Router()

type TestBlogInfo = { userId: string, html: string, css: string }

// Creates all given blogs and sends back the blog ids of the created blogs if successful
router.post("/createall", async (req: TypedRequestBody<{ blogs: TestBlogInfo[] }>, res) => {
  try {
    const promises: Promise<string>[] = []
    for (const blog of req.body.blogs) {
      promises.push(Blog.save(blog.userId, blog.html, blog.css))
    }

    const blogIds = await Promise.all(promises)
    sendSuccessResponse(res, blogIds, 201)
  } catch (err) {
    sendErrorResponse(res, err)
  }
})