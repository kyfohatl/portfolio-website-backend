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
        await User.delete("id", user.id)
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

describe("create", () => {
  function itBehavesLikeValidParam(username: string, password?: string) {
    it("Creates the user and returns it", async () => {
      // Create the user
      const createReturn = await User.create(username, password)

      // Get the user
      const whereReturn = await User.where("username", username)

      // Now test
      expect(createReturn.id).toBe(whereReturn.id)
      expect(createReturn.username).toBe(whereReturn.username)
      if (password) {
        expect(createReturn.password).toBe(whereReturn.password)
      } else {
        expect(whereReturn.password).toBeFalsy()
      }
    })
  }

  describe("When both a username and password are given", () => {
    const USERNAME = "sample"
    const PASSWORD = "pass1233"

    // Remove test user
    afterAll(async () => {
      await User.delete("username", USERNAME)
    })

    itBehavesLikeValidParam(USERNAME, PASSWORD)
  })

  describe("When only a username is given", () => {
    const USERNAME = "sample2"

    // Remove test user
    afterAll(async () => {
      await User.delete("username", USERNAME)
    })

    itBehavesLikeValidParam(USERNAME)
  })

  describe("When the username given is an empty string", () => {
    it("Throws an error with code 400", async () => {
      let user: User | undefined = undefined
      try {
        user = await User.create("", "pass123")
      } catch (err) {
        expect(err).toEqual({ simpleError: "No username given!", code: 400 } as BackendError)
      }
      expect(user).toBeUndefined()
    })
  })
})

describe("delete", () => {
  function itBehavesLikeDeletingUser(username: string, password: string, id?: string) {
    it("Deletes the user and returns it", async () => {
      let user: User
      if (id) {
        user = await User.delete("id", id)
      } else {
        user = await User.delete("username", username)
      }

      expect(user.username).toBe(username)
      expect(user.password).toBe(password)

      // Make sure user is in fact deleted
      let deletedUser: User | undefined = undefined
      try {
        deletedUser = await User.where("username", username)
      } catch (err) {
        expect(err).toEqual({ simpleError: "No users found", code: 400 } as BackendError)
      }
      expect(deletedUser).toBeUndefined()
    })
  }

  describe("When given a valid username", () => {
    const USERNAME = "test123"
    const PASSWORD = "pass"

    // Create a test user
    beforeAll(async () => {
      await User.create(USERNAME, PASSWORD)
    })

    itBehavesLikeDeletingUser(USERNAME, PASSWORD)
  })

  describe("When given a valid id", () => {
    // Create a test user
    const USERNAME = "test456"
    const PASSWORD = "pass2"
    let id: string = ""
    beforeAll(async () => {
      const user = await User.create(USERNAME, PASSWORD)
      id = user.id
    })

    itBehavesLikeDeletingUser(USERNAME, PASSWORD, id)
  })

  function itBehavesLikeThrowError(type: UserSearchParam, param: string) {
    it("Throws an error with code 400", async () => {
      let user: User | undefined = undefined
      try {
        user = await User.delete(type, param)
      } catch (err) {
        expect(err).toEqual({ simpleError: "Given user does not exist!", code: 400 } as BackendError)
      }
      expect(user).toBeUndefined()
    })
  }

  describe("When given invalid parameters", () => {
    // Create a test user
    const USERNAME = "test789"
    const PASSWORD = "pass3"
    beforeAll(async () => {
      await User.create(USERNAME, PASSWORD)
    })

    // Delete test user
    afterAll(async () => {
      await User.delete("username", USERNAME)
    })

    describe("When given an invalid username", () => {
      itBehavesLikeThrowError("username", "invalidUsername")
    })

    describe("When given an invalid id", () => {
      itBehavesLikeThrowError("id", "7ebbf2cf-37e9-4776-afbc-32cc8d3121d7")
    })
  })

  describe("When the database has no users", () => {
    itBehavesLikeThrowError("username", "invalidUsername2")
  })
})