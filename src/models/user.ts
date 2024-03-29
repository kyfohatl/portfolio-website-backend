import { QueryResult } from "pg"
import { AuthService, BackendError } from "../custom"
import Database from "../lib/Database"

export type UserSearchParam = "username" | "id"

interface UserProps {
  id: string
  username: string
  password?: string
}

interface ThirdPartyAuthEntry {
  user_id: string,
  provider: AuthService,
  provider_user_id: string
}

export default class User {
  id: string
  username: string
  password?: string

  constructor(id: string, username: string, password?: string) {
    this.id = id
    this.username = username
    this.password = password
  }

  // Will return the user matching the given parameter, or throws an error if no such user is found
  static where(type: UserSearchParam, param: string) {
    const queryStr = `
      SELECT id, username, password FROM users
      WHERE ${type}=$1;
    `
    const queryVals = [param]

    // Now perform the query
    const promise = new Promise<User>((resolve, reject) => {
      Database.getClient().query<{ id: string, username: string, password: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0) return reject({ simpleError: "No users found", code: 400 } as BackendError)

        // Return the user
        resolve(new User(data.rows[0].id, data.rows[0].username, data.rows[0].password))
      })
    })

    return promise
  }

  // Will create a user with the given information in the database and return the result
  static create(username: string, password?: string) {
    let queryStr: string
    let queryVals: string[]

    // Ensure username is not an empty string
    if (!username) throw ({ simpleError: "No username given!", code: 400 } as BackendError)

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
      Database.getClient().query<{ id: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (!data || data.rows.length !== 1) return reject({
          simpleError: "User creation failed"
        } as BackendError)

        resolve(new User(data.rows[0].id, username, password))
      })
    })

    return promise
  }

  // Deletes user with the given id
  static delete(type: UserSearchParam, param: string) {
    const queryStr = `
      DELETE FROM users
      WHERE ${type} = $1
      RETURNING id, username, password;
    `
    const queryVals = [param]

    const promise = new Promise<User>((resolve, reject) => {
      Database.getClient().query<UserProps>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0)
          return reject({ simpleError: "Given user does not exist!", code: 400 } as BackendError)

        const userProps = data.rows[0]
        resolve(new User(userProps.id, userProps.username, userProps.password))
      })
    })

    return promise
  }

  // Adds given third party user to the third party auth providers table
  static createThirdPartyAuthEntry(provider: AuthService, providerId: string, userId: string) {
    const queryStr = `
      INSERT INTO auth_providers(user_id, provider, provider_user_id)
      VALUES ($1, $2, $3);
    `
    const queryVals = [userId, provider, providerId]

    const promise = new Promise<void>((resolve, reject) => {
      Database.getClient().query(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        resolve()
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
      data = await Database.getClient().query<{ user_id: string }>(queryStr, queryVals)
    } catch (err) {
      throw ({ unknownError: err, code: 500 } as BackendError)
    }

    try {
      if (data.rowCount <= 0) {
        // User not found, create a new user
        const user = await User.create(email)
        // Add third party user to the third party table
        await User.createThirdPartyAuthEntry(provider, providerUserId, user.id)

        return user
      }

      // User exists already. Return user
      // Notice that we are finding the user based on id and not email, since it is possible for the 
      // given third party email to be incorrect (e.g. user changed their email on the third party service)
      return (await User.where("id", data.rows[0].user_id))
    } catch (err) {
      throw err
    }
  }

  // Returns the third party auth entry with the given id and provider type, or throws an error if not found
  static async getThirdPartyAuthEntry(provider: AuthService, providerId: string) {
    const queryStr = `
      SELECT user_id, provider, provider_user_id
      FROM auth_providers
      WHERE provider = $1 AND provider_user_id = $2;
    `
    const queryVals = [provider, providerId]

    const promise = new Promise<ThirdPartyAuthEntry>((resolve, reject) => {
      Database.getClient().query<ThirdPartyAuthEntry>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0) return reject({ simpleError: "No such entry found!", code: 404 } as BackendError)
        return resolve(data.rows[0])
      })
    })

    return promise
  }

  // Deletes the entry for the given provider type and id if it exists from the auth_providers table
  static async deleteThirdPartyAuthEntry(provider: AuthService, providerId: string) {
    const queryStr = `
      DELETE FROM auth_providers
      WHERE provider = $1 AND provider_user_id = $2;
    `
    const queryVals = [provider, providerId]

    const promise = new Promise<void>((resolve, reject) => {
      Database.getClient().query(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        resolve()
      })
    })

    return promise
  }
}