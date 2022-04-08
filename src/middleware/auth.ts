import { Request, Response, NextFunction } from "express"
import { AuthUser } from "../custom"
import Token from "../models/token"

// Express middleware function. Will respond with a 403 if failed to authenticate, otherwise will add 
// authenticated information to the request object
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(" ")[1]

  if (token == null) return res.sendStatus(401)

  const data = Token.verifyAccToken(token)
  if (data.isValid) {
    req.authUser = data.user as AuthUser
    next()
  } else {
    res.sendStatus(403)
  }
}