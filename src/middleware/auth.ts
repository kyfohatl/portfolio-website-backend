import { Request, Response, NextFunction } from "express"
import { Issuer } from "openid-client"
import { AuthService, AuthUser, BackendResponse } from "../custom"
import { sendErrorResponse } from "../lib/sendResponse"
import { expressStorage } from "../lib/storage"
import Token, { VerifyTokenReturn } from "../models/token"

export interface AuthenticatedResponse extends Response {
  locals: { authUser: AuthUser }
}

export function makeAuthenticateToken(verifyAccToken: (accessToken: string) => VerifyTokenReturn) {
  // Express middleware function. Will respond with a 403 if failed to authenticate, otherwise
  // will add authenticated information to the request object
  return function authenticateToken(req: Request, res: AuthenticatedResponse, next: NextFunction) {
    let token: string | undefined = undefined
    // First try to get access token from cookies
    if (req.cookies && "accessToken" in req.cookies) token = req.cookies.accessToken
    else {
      // Otherwise try to get it from the authorization header
      const authHeader = req.headers['authorization']
      token = authHeader && authHeader.split(" ")[1]
    }

    if (!token) return res.status(401).json({ simpleError: "No token given", code: 401 } as BackendResponse)

    const data = verifyAccToken(token)
    if (data.isValid) {
      res.locals.authUser = data.user
      next()
    } else {
      sendErrorResponse(res, { simpleError: "Token invalid", code: 401 })
    }
  }
}

export const GOOGLE_CALLBACK_ADDR = `${process.env.BACKEND_SERVER_ADDR}/auth/login/google/callback`
export const FACEBOOK_CALLBACK_ADDR = `${process.env.FRONTEND_SERVER_ADDR}/signin/facebook`

async function initializeClient(type: AuthService) {
  let discoveryAddr: string
  let clientId: string
  let callBackAddr: string

  switch (type) {
    case "google":
      discoveryAddr = "https://accounts.google.com"
      clientId = "755324419331-u4ekk67a3s3hato95ng9vb45hc837vpl.apps.googleusercontent.com"
      callBackAddr = GOOGLE_CALLBACK_ADDR
      break
    case "facebook":
      discoveryAddr = "https://www.facebook.com/.well-known/openid-configuration/"
      clientId = "396361625604894"
      callBackAddr = FACEBOOK_CALLBACK_ADDR
      break
    default:
      throw new Error("Given auth client type has not been implemented")
  }

  // Get the issuer
  const issuer = await Issuer.discover(discoveryAddr)
  // Now initialize the client
  const client = new issuer.Client({
    client_id: clientId,
    redirect_uris: [callBackAddr],
    response_types: ["id_token"]
  })

  if (!client) throw new Error("Could not initialize auth client")

  // Save the client in express storage for future use
  expressStorage[type + "AuthClient"] = client
}

// Initializes the google client needed for google open id client authentication
export async function initializeAuthClients(req: Request, res: Response, next: NextFunction) {
  try {
    // Initialize all auth clients if they have not already been initialized
    const clientTypes: AuthService[] = ["facebook", "google"]
    for (const clientType of clientTypes) {
      if ((clientType + "AuthClient") in expressStorage) continue
      await initializeClient(clientType)
    }

    next()
  } catch (err) {
    // Something went wrong
    res.status(500).json({ unknownError: err, code: 500 } as BackendResponse)
  }
}