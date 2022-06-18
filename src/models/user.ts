import { QueryResult } from "pg"
import { AuthService, BackendError } from "../custom"
import database from "../herokuClient"

type UserSearchParam = "username" | "id"

export default class User {
  id: string
  username: string
  password?: string

  constructor(id: string, username: string, password?: string) {
    this.id = id
    this.username = username
    this.password = password
  }

  // Will return a list of users matching given parameter
  static where(type: UserSearchParam, param: string) {
    const queryStr = `
      SELECT id, username, password FROM users
      WHERE ${type}=$1;
    `
    const queryVals = [param]

    // Now perform the query
    const promise = new Promise<User[]>((resolve, reject) => {
      database.query<{ id: string, username: string, password: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0) return reject({ simpleError: "No users found", code: 400 } as BackendError)

        // Create a new User class instance for each row that is returned
        resolve(data.rows.map((row) => new User(row.id, row.username, row.password)))
      })
    })

    return promise
  }

  // Will create a user with the given information in the database and return the result
  static create(username: string, password?: string) {
    let queryStr: string
    let queryVals: string[]

    if (password) {
      queryStr = `
        INSERT INTO users(username,password)
        VALUES ($1, $2)
        RETURNING id;
      `
      queryVals = [username, password]
    } else {
      queryStr = `
        INSERT INTO users(username)
        VALUES ($1)
        RETURNING id;
      `
      queryVals = [username]
    }

    const promise = new Promise<User>((resolve, reject) => {
      database.query<{ id: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (!data || data.rows.length !== 1) return reject({
          simpleError: "User creation failed"
        } as BackendError)

        resolve(new User(data.rows[0].id, username, password))
      })
    })

    return promise
  }

  // Returned third party authenticated user account if it exists, or creates and return a new account
  // if it does not
  static async getThirdPartyUserOrCreate(provider: AuthService, providerUserId: string, email: string) {
    const queryStr = `
      SELECT user_id
      FROM auth_providers
      WHERE provider = $1 AND provider_user_id = $2
    `
    const queryVals = [provider, providerUserId]

    // Try to find the user
    let data: QueryResult<{ user_id: string }>
    try {
      data = await database.query<{ user_id: string }>(queryStr, queryVals)
    } catch (err) {
      throw ({ unknownError: err, code: 500 } as BackendError)
    }

    try {
      if (data.rowCount <= 0) {
        // User not found, create a new user
        return await User.create(email)
      }

      // User exists already. Return user
      // Notice that we are finding the user based on id and not email, since it is possible for the 
      // given third party email to be incorrect (e.g. user changed their email on the third party service)
      return (await User.where("id", data.rows[0].user_id))[0]
    } catch (err) {
      throw err
    }
  }
}