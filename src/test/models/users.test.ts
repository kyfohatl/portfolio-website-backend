import { BackendError } from "../../custom"
import User, { UserSearchParam } from "../../models/user"
import runTestEnvSetup from "../setup"
import runTestEnvTeardown from "../teardown"

// Perform setup
beforeAll(async () => {
  await runTestEnvSetup()
})

// Perform teardown
afterAll(async () => {
  await runTestEnvTeardown()
})

describe("where", () => {
  function itBehavesLikeInvalidParam(type: UserSearchParam, param: string) {
    it("Throws an error with code 400", async () => {
      let user: User | undefined = undefined
      try {
        user = await User.where(type, param)
      }
      catch (err) {
        expect(err).toEqual({ simpleError: "No users found", code: 400 } as BackendError)
      }
      expect(user).toBeUndefined()
    })
  }

  describe("When there are users in the database", () => {
    const users: User[] = []

    // Create some test users
    beforeAll(async () => {
      const userInfoList: { username: string, password: string }[] = [
        { username: "john", password: "68776" },
        { username: "bob", password: "3234" },
        { username: "alice", password: "1234" },
        { username: "molly", password: "fdf" },
        { username: "matt", password: "dsfdfs" },
        { username: "dave", password: "344" },
        { username: "sam", password: "ghhjj" }
      ]

      for (const userInfo of userInfoList) {
        users.push(await User.create(userInfo.username, userInfo.password))
      }
    })

    // Remove test users
    afterAll(async () => {
      for (const user of users) {
        await User.delete(user.id)
      }
    })

    describe("When a valid username is provided", () => {
      it("Returns the user with the given username", async () => {
        const USERNAME = "alice"
        const user = await User.where("username", USERNAME)
        expect(user.id).toBe(users[2].id)
        expect(user.username).toBe(USERNAME)
        expect(user.password).toBe("1234")
      })
    })

    describe("When a valid id is provided", () => {
      it("Returns the user with the given id", async () => {
        const USER_INDEX = 4
        const user = await User.where("id", users[USER_INDEX].id)
        expect(user.id).toBe(users[USER_INDEX].id)
        expect(user.username).toBe(users[USER_INDEX].username)
        expect(user.password).toBe(users[USER_INDEX].password)
      })
    })

    describe("When an invalid id is provided", () => {
      itBehavesLikeInvalidParam("id", "366a5af3-69e2-4793-a89e-ca8a4ecb4b24")
    })

    describe("When an invalid username is provided", () => {
      itBehavesLikeInvalidParam("username", "invalidUsername")
    })
  })

  describe("When there are no users in the database", () => {
    describe("When an id is given", () => {
      itBehavesLikeInvalidParam("id", "f188b44b-4eaa-4a48-9dc8-6835f313d973")
    })

    describe("When a username is given", () => {
      itBehavesLikeInvalidParam("username", "someUsername")
    })
  })
})