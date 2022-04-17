import express, { Request } from "express"
import Blog from "../models/blog"

export const router = express.Router()
router.use(express.json())

interface TypedRequestBody<T> extends Request {
  body: T
}

// Respond with a list of the most recently created blogs, in order, on the given page number
router.get("/", async (req: TypedRequestBody<{ pageNum: number }>, res) => {
  const pageNum = req.body.pageNum
  if (pageNum === undefined || pageNum === null) return res.sendStatus(400)

  try {
    const blogs = await Blog.mostRecent(8, pageNum)
    res.json({ success: { blogs: blogs } })
  } catch (err) {
    res.status(500).json({ error: { generic: err } })
  }
})

interface CreateBlogProps {
  userId: string,
  html: string,
  css: string,
  creationDate: string
}

// Create a new blog with the given information
router.post("/create", async (req: TypedRequestBody<CreateBlogProps>, res) => {
  const userId = req.body.userId
  const html = req.body.html
  const css = req.body.css
  const creationDate = req.body.creationDate

  if (!userId || html || creationDate) return res.status(400).json({ error: { generic: "Missing details!" } })

  try {
    await Blog.create(userId, html, css, creationDate)
    res.sendStatus(201)
  } catch (err) {
    res.status(500).json({ error: { generic: err } })
  }
})