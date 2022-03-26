// The declarations below are used for typescript's Declaration Merging
// so that a Request object also can contain an AuthUser
export interface AuthUser {
  name: string
}

declare global {
  namespace Express {
    export interface Request {
      authUser?: AuthUser
    }
  }
}