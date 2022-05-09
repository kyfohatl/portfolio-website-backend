import { BackendError } from "../custom"
import database from "../herokuClient"

export default class User {
  id: string
  username: string
  password: string

  constructor(id: string, username: string, password: string) {
    this.id = id
    this.username = username
    this.password = password
  }

  // Will return a list of users matching given parameters
  static where(username: string) {
    const queryStr = `
      SELECT id, username, password FROM users
      WHERE username=$1;
    `
    const queryVals = [username]

    const promise = new Promise<User[]>((resolve, reject) => {
      database.query<{ id: string, username: string, password: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknown: err } as BackendError)
        if (data.rowCount <= 0) return reject({ simple: { code: 400, message: "No users found" } } as BackendError)

        // Create a new User class instance for each row that is returned
        resolve(data.rows.map((row) => new User(row.id, row.username, row.password)))
      })
    })

    return promise
  }

  // Will create a user with the given information in the database and return the result
  static create(username: string, password: string) {
    const queryStr = `
      INSERT INTO users(username,password)
      VALUES ($1, $2)
      RETURNING id;
    `
    const queryVals = [username, password]

    const promise = new Promise<User>((resolve, reject) => {
      database.query<{ id: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknown: err } as BackendError)
        if (!data || data.rows.length !== 1) return reject({
          simple: { code: 500, message: "User creation failed" }
        } as BackendError)

        resolve(new User(data.rows[0].id, username, password))
      })
    })

    return promise
  }
}