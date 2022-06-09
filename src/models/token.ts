import dotenv from "dotenv"
dotenv.config()

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

const ACC_TOKEN_EXPIRY_MINUTES = 1
const ACC_TOKEN_EXPIRY_SECONDS = ACC_TOKEN_EXPIRY_MINUTES * 60

const REF_TOKEN_EXPIRY_DAYS = 90
const REF_TOKEN_EXPIRY_SECONDS = REF_TOKEN_EXPIRY_DAYS * 86400

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
          console.log("jwtData:", jwtData)
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

  static generateAccessToken(authUser: AuthUser) {
    return {
      token: jwt.sign(
        authUser,
        process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: ACC_TOKEN_EXPIRY_MINUTES + "m" }
      ),
      expiresInSeconds: ACC_TOKEN_EXPIRY_SECONDS
    }
  }

  static generateRefreshToken(authUser: AuthUser) {
    const refreshToken = jwt.sign(
      authUser,
      process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: REF_TOKEN_EXPIRY_DAYS + "d" }
    )

    // Add refresh token to the database
    const queryStr = `
      INSERT INTO refresh_tokens(token)
      VALUES ($1);
    `
    const queryVals = [refreshToken]
    database.query(queryStr, queryVals, (err, data) => {
      if (err) throw err
    })

    return {
      token: refreshToken,
      expiresInSeconds: REF_TOKEN_EXPIRY_SECONDS
    }
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

  static async deleteRefreshToken(refreshToken: string) {
    const queryStr = `
      DELETE FROM refresh_tokens
      WHERE token = $1;
    `
    const queryVals = [refreshToken]
    const promise = new Promise<void>((resolve, reject) => {
      database.query(queryStr, queryVals, (err, data) => {
        if (err) return reject(err)
        return resolve()
      })
    })

    return promise
  }
}