import express from "express"
import bcrypt from "bcrypt"

const app = express()
app.use(express.json())

interface User {
  name: string,
  password: string
}

const users: User[] = []

app.get("/users", (req, res) => {
  res.json(users)
})

// Create a new user with the given username and password
app.post("/users", async (req, res) => {

  try {
    const passHash: string = await bcrypt.hash(req.body.password, 10)
    const user: User = {
      name: req.body.name,
      password: passHash
    }

    users.push(user)
    res.status(201).send("New user added")
  } catch {
    res.status(500).send()
  }
})

// Login the given user with the given username and password, if correct
app.post("/users/login", async (req, res) => {
  // Check if username exists
  const user = users.find(user => user.name === req.body.name)
  if (user == null) {
    return res.status(400).send("Username or password is incorrect")
  }

  // Check if password hashes match
  try {
    if (await bcrypt.compare(req.body.password, user.password)) {
      // Correct credentials
      res.send("Login Success")
    } else {
      // Incorrect credentials
      res.status(400).send("Username or password is incorrect")
    }
  } catch {
    res.status(500).send()
  }
})

app.listen(8000, () => {
  console.log("Listening on port 8000")
})