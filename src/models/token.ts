import dotenv from "dotenv"
dotenv.config()

import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import database from "../herokuClient"

import { AuthUser } from "../custom"

interface VerifyTokenReturnFailure {
  isValid: false
}

interface VerifyTokenReturnSuccess {
  isValid: true,
  user: AuthUser
}

type VerifyTokenReturn = VerifyTokenReturnFailure | VerifyTokenReturnSuccess

export default class Token {
  // Returns true along with the verified token data if the given access token is valid, and false otherwise
  static verifyAccToken(token: string): VerifyTokenReturn {
    if (!token) return { isValid: false }

    try {
      const data = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string)
      return { isValid: true, user: data as AuthUser }
    } catch (err) {
      return { isValid: false }
    }
  }

  // Returns true along with the verified token data if the given refresh token is valid, and false 
  // if not. Throws error if something goes wrong while verifying
  static async verifyRefToken(token: string): Promise<VerifyTokenReturn> {
    if (!token) return { isValid: false }

    const queryStr = `
      SELECT EXISTS(
        SELECT 1
        FROM refresh_tokens
        WHERE token = $1
      );
    `
    const queryVals = [token]

    try {
      const data = await database.query(queryStr, queryVals)
      if (data.rows[0].exist) {
        // Token exists in database. Verify it
        try {
          const jwtData = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string)
          if (jwtData == undefined) return { isValid: false }
          // Refresh token exists and has been verified. Return true
          return { isValid: true, user: jwtData as AuthUser }
        } catch (jwtErr) {
          // Refresh token failed to verify
          return { isValid: false }
        }
      } else {
        // Refresh token does not exist in the database
        return { isValid: false }
      }
    } catch (err) {
      // Database operation failed. Throw error
      throw err
    }
  }

  // Express middleware function. Will respond with a 403 if failed to authenticate, otherwise will add 
  // authenticated information to the request object
  static authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(" ")[1]

    if (token == null) return res.sendStatus(401)

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err, authUser) => {
      if (err) return res.sendStatus(403)

      req.authUser = authUser as AuthUser
      next()
    })
  }

  static generateAccessToken(authUser: AuthUser) {
    return jwt.sign(authUser, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: "15m" })
  }

  static generateRefreshToken(authUser: AuthUser) {
    const refreshToken = jwt.sign(authUser, process.env.REFRESH_TOKEN_SECRET as string)

    // Add refresh token to the database
    const queryStr = `
      INSERT INTO refresh_tokens(token)
      VALUES ($1);
    `
    const queryVals = [refreshToken]
    database.query(queryStr, queryVals, (err, data) => {
      if (err) throw err
    })

    return refreshToken
  }

  static generateTokenPair(authUser: AuthUser) {
    try {
      const accessToken = Token.generateAccessToken(authUser)
      const refreshToken = Token.generateRefreshToken(authUser)
      return { accessToken: accessToken, refreshToken: refreshToken }
    } catch (err) {
      throw err
    }
  }

  static deleteRefreshToken(refreshToken: string) {
    const queryStr = `
      DELETE FROM refresh_tokens
      WHERE token = $1;
    `
    const queryVals = [refreshToken]
    database.query(queryStr, queryVals, (err, data) => {
      if (err) throw err
    })
  }
}