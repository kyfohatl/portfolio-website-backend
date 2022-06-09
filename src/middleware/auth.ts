import { Request, Response, NextFunction } from "express"
import { AuthUser, BackendResponse } from "../custom"
import Token from "../models/token"

export interface AuthenticatedResponse extends Response {
  locals: { authUser: AuthUser }
}

// Express middleware function. Will respond with a 403 if failed to authenticate, otherwise will add 
// authenticated information to the request object
export function authenticateToken(req: Request, res: AuthenticatedResponse, next: NextFunction) {
  let token: string | undefined = undefined
  console.log("cookies", req.cookies)
  // First try to get access token from cookies
  if (req.cookies && "accessToken" in req.cookies) token = req.cookies.accessToken
  else {
    // Otherwise try to get it from the authorization header
    const authHeader = req.headers['authorization']
    token = authHeader && authHeader.split(" ")[1]
  }

  console.log("acc token", token)

  if (!token) return res.status(401).json({ simpleError: "No token given", code: 401 } as BackendResponse)

  const data = Token.verifyAccToken(token)
  console.log("verify acc", data)
  if (data.isValid) {
    res.locals.authUser = data.user
    next()
  } else {
    res.status(401).json({ simpleError: "Token invalid", code: 401 } as BackendResponse)
  }
}