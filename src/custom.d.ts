// The declarations below are used for typescript's Declaration Merging

import { Request } from "express"

// so that a Request object also can contain an AuthUser
export interface AuthUser {
  id: string
}

declare global {
  namespace Express {
    export interface Request {
      authUser?: AuthUser
    }
  }
}

// Error types
export type BackendError =
  { simpleError: string, code: number } |
  { complexError: Record<string, string>, code: number } |
  { unknownError: unknown, code: number }

export type BackendResponse =
  { success: any, code?: number } |
  BackendError

// Types requests
export interface TypedReqCookies<T> extends Request {
  cookies: T
}

// Third party authentication services
type AuthService = "google" | "facebook"