import cookieParser from "cookie-parser"
import express, { Request, Response } from "express"

export const router = express.Router()

router.get("/reqAndRes", (req: Request, res: Response) => {
  res.json({ req: "Yo", res: "1234" })
})