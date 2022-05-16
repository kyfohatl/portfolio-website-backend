import express, { Request } from "express"
import { Query } from 'express-serve-static-core';
import { BackendError } from "../custom"
import { sendErrorResponse, sendSuccessResponse } from "../lib/sendResponse"
import { AuthenticatedResponse, authenticateToken } from "../middleware/auth"
import Blog from "../models/blog"

export const router = express.Router()
router.use(express.json())

interface TypedRequestBody<T> extends Request {
  body: T
}

interface TypedRequestQuery<T extends Query> extends Request {
  query: T
}

// Respond with a list of the most recently created blogs, in order, on the given page number
router.get("/", async (req: TypedRequestQuery<{ page: string, limit: string }>, res) => {
  const pageNum = parseInt(req.query.page)
  if (pageNum === undefined || pageNum === null) return res.sendStatus(400)

  let limit = parseInt(req.query.limit)
  if (!limit) limit = 8

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

// Create a new blog with the given information
router.post("/create", authenticateToken, async (req: TypedRequestBody<CreateBlogProps>, res: AuthenticatedResponse) => {
  const userId = res.locals.authUser.id
  const html = req.body.html
  const css = req.body.css
  let blogId = req.body.blogId

  if (!userId || !html) {
    return sendErrorResponse(res, { simpleError: "Missing details!", code: 400 })
  }

  try {
    blogId = await Blog.save(userId, html, css, blogId)
    sendSuccessResponse(res, { id: blogId })
  } catch (err) {
    sendErrorResponse(res, err as BackendError)
  }
})