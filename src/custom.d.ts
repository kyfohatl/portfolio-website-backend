// The declarations below are used for typescript's Declaration Merging
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
  { simple: { code: number, message: string } } |
  { complex: { code: number, object: Record<string, string> } } |
  { unknown: unknown }

// Response types
export type BackendResponse =
  { success: any, code?: number } |
  { simpleError: string } |
  { complexError: Record<string, string> } |
  { unknownError: unknown }