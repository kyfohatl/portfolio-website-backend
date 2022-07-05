import express, { Request, Response } from "express"

export const router = express.Router()

router.get("/reqAndRes", (req: Request, res: Response) => {
  res.json({ req: "Hello", res: "1234" })
})