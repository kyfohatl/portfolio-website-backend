import { AuthService, BackendError } from "../../custom"
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

describe("createThirdPartyAuthEntry", () => {
  const PROVIDER = "facebook"
  const PROVIDER_ID = "facebookId1234"
  let userId: string

  // Setup
  const USERNAME = "testABC"
  beforeAll(async () => {
    // Create a test user
    const user = await User.create(USERNAME)
    userId = user.id

    // Create a test entry
    await User.createThirdPartyAuthEntry(PROVIDER, PROVIDER_ID, userId)
  })

  // Teardown
  afterAll(async () => {
    // Remove test user
    await User.delete("username", USERNAME)
    // Remove test entry
    await User.deleteThirdPartyAuthEntry(PROVIDER, PROVIDER_ID)
  })

  function itBehavesLikeValidEntry(provider: AuthService, providerId: string) {
    it("Creates an entry for the user", async () => {
      // Create the entry
      await User.createThirdPartyAuthEntry(provider, providerId, userId)

      // Check if the entry has been correctly created
      const entry = await User.getThirdPartyAuthEntry(provider, providerId)
      expect(entry.provider).toBe(provider)
      expect(entry.provider_user_id).toBe(providerId)
      expect(entry.user_id).toBe(userId)
    })
  }

  describe("When valid parameters are given", () => {
    const NEW_PROVIDER_ID = "someOtherFacebookId"
    // Clean up test entry
    afterAll(async () => {
      await User.deleteThirdPartyAuthEntry(PROVIDER, NEW_PROVIDER_ID)
    })

    itBehavesLikeValidEntry(PROVIDER, NEW_PROVIDER_ID)
  })

  describe("When a valid provider and user id is given but the provider id already exists", () => {
    const NEW_PROVIDER = "google"

    // Clean up test entry
    afterAll(async () => {
      await User.deleteThirdPartyAuthEntry(NEW_PROVIDER, PROVIDER_ID)
    })

    itBehavesLikeValidEntry(NEW_PROVIDER, PROVIDER_ID)
  })

  describe("When invalid username or provider id are given", () => {
    function itBehavesLikeThrowError(provider: AuthService, providerId: string, userId: string) {
      it("Throws an error with code 500", async () => {
        let threwErr = true
        try {
          await User.createThirdPartyAuthEntry(provider, providerId, userId)
          threwErr = false
        } catch (err) {
          const castErr = err as BackendError
          expect("unknownError" in castErr).toBeTruthy()
          expect(castErr.code).toBe(500)
        }
      })
    }

    describe("When the given entry (provider and provider id) already exists", () => {
      itBehavesLikeThrowError(PROVIDER, PROVIDER_ID, userId)
    })

    const NEW_PROVIDER_ID = "testFacebookId456"

    describe("When the given user id is not a valid uuid", () => {
      itBehavesLikeThrowError(PROVIDER, NEW_PROVIDER_ID, "invalid")
    })

    describe("When the given user id is a valid uuid but not a valid user", () => {
      itBehavesLikeThrowError(PROVIDER, NEW_PROVIDER_ID, "2595fc7c-878b-432f-b00a-29c89835bd65")
    })
  })
})

describe("getThirdPartyUserOrCreate", () => {
  describe("When the given parameters are valid", () => {
    function itBehavesLikeValidUserCreate(username: string, provider: AuthService, providerId: string) {
      it("Creates or finds the user in the database and returns it", async () => {
        const user = await User.getThirdPartyUserOrCreate(provider, providerId, username)
        expect(user.id).toBeTruthy()
        expect(user.username).toBe(username)
  
        // Ensure a third party entry exists
        const entry = await User.getThirdPartyAuthEntry(provider, providerId)
        expect(entry.provider).toBe(provider)
        expect(entry.provider_user_id).toBe(providerId)
        expect(entry.user_id).toBe(user.id)
      })
    }

    const USERNAME = "testThirdParty"
    const PROVIDER = "facebook"
    const PROVIDER_ID = "someID"

    describe("When the user already exists", () => {
      // Create test user
      beforeAll(async () => {
        const user = await User.create(USERNAME)
        await User.createThirdPartyAuthEntry(PROVIDER, PROVIDER_ID, user.id)
      })
  
      // Delete test user
      afterAll(async () => {
        await User.deleteThirdPartyAuthEntry(PROVIDER, PROVIDER_ID)
        await User.delete("username", USERNAME)
      })
  
      itBehavesLikeValidUserCreate(USERNAME, PROVIDER, PROVIDER_ID)
    })
  
    describe("When the user does not exist", () => {
      // Remove test users
      afterAll(async () => {
        await User.deleteThirdPartyAuthEntry(PROVIDER, PROVIDER_ID)
        await User.delete("username", USERNAME)
      })

      itBehavesLikeValidUserCreate(USERNAME, PROVIDER, PROVIDER_ID)
    })
  })

  describe("When the given parameters are invalid", () => {
    describe("When the username already exists, but does not have a third party auth entry", () => {
      const USERNAME = "test000"

      // Create test user
      beforeAll(async () => {
        await User.create(USERNAME)
      })

      // Delete test user
      afterAll(async () => {
        await User.delete("username", USERNAME)
      })

      it("Throws an error with code 500", async () => {
        let user: User | undefined = undefined
        try {
          user = await User.getThirdPartyUserOrCreate("facebook", "noneExistentId", USERNAME)
        } catch (err) {
          const castErr = err as BackendError
          expect("unknownError" in castErr).toBe(true)
          expect(castErr.code).toBe(500)
        }
        expect(user).toBeUndefined()
      })
    })
  })
})