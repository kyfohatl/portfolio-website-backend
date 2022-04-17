import { Request, Response, NextFunction } from "express"
import { AuthUser } from "../custom"
import Token from "../models/token"

export interface AuthenticatedResponse extends Response {
  locals: {authUser: AuthUser}
}

// Express middleware function. Will respond with a 403 if failed to authenticate, otherwise will add 
// authenticated information to the request object
export function authenticateToken(req: Request, res: AuthenticatedResponse, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(" ")[1]

  if (token == null) return res.status(401).json({error: {auth: "No token given"}})

  const data = Token.verifyAccToken(token)
  if (data.isValid) {
    res.locals.authUser = data.user
    next()
  } else {
    res.status(401).json({error: {auth: "Token invalid"}})
  }
}