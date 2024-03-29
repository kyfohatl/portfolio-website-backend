import express from "express"
import { BackendError, TypedRequestBody, TypedRequestQuery } from "../custom"
import { sendErrorResponse, sendSuccessResponse } from "../lib/sendResponse"
import { AuthenticatedResponse, authenticateToken } from "../middleware/auth"
import Blog from "../models/blog"

export const router = express.Router()

export const DEFAULT_BLOGS_LIMIT = 8

// Respond with a list of the most recently created blogs, in order, on the given page number
router.get("/", async (req: TypedRequestQuery<{ page: string, limit: string }>, res) => {
  const pageNum = parseInt(req.query.page)
  if (pageNum === undefined || pageNum === null) return res.sendStatus(400)

  let limit = parseInt(req.query.limit)
  if (!limit) limit = DEFAULT_BLOGS_LIMIT

  try {
    const blogs = await Blog.mostRecent(limit, pageNum)
    sendSuccessResponse(res, { blogs: blogs })
  } catch (err) {
    sendErrorResponse(res, err as BackendError)
  }
})

// Respond with the content of the requested blog if it exists
router.get("/:blogId", async (req, res) => {
  try {
    const blog = await Blog.where(req.params.blogId)
    sendSuccessResponse(res, { blog: blog })
  } catch (err) {
    sendErrorResponse(res, err as BackendError)
  }
})

interface CreateBlogProps {
  html: string,
  css: string,
  blogId?: string | null
}

export const MISSING_DETAILS_TXT = "Missing details!"

// Create a new blog or edit an existing blog with the given information
router.post("/create", authenticateToken, async (req: TypedRequestBody<CreateBlogProps>, res: AuthenticatedResponse) => {
  const userId = res.locals.authUser.id
  const html = req.body.html
  const css = req.body.css
  let blogId = req.body.blogId

  if (!userId || !html) {
    return sendErrorResponse(res, { simpleError: MISSING_DETAILS_TXT, code: 400 })
  }

  try {
    blogId = await Blog.save(userId, html, css, blogId)
    sendSuccessResponse(res, { id: blogId }, 201)
  } catch (err) {
    sendErrorResponse(res, err as BackendError)
  }
})

// Delete the blog with the given id
router.delete("/:blogId", authenticateToken, async (req, res) => {
  const userId = res.locals.authUser.id

  // Ensure a blog id has been provided
  if (!req.params.blogId) {
    return sendErrorResponse(res, { simpleError: "Blog id required", code: 400 } as BackendError)
  }

  try {
    const deletedBlogId = await Blog.delete(req.params.blogId, userId)
    sendSuccessResponse(res, { id: deletedBlogId })
  } catch (err) {
    sendErrorResponse(res, err as BackendError)
  }
})