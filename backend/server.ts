import express from "express"

const app = express()
app.use(express.json())

interface User {
  name: String,
  password: String
}

const users: User[] = []

app.get("/users", (req, res) => {
  res.json(users)
})

app.post("/users", (req, res) => {
  const user: User = {
    name: req.body.name,
    password: req.body.password
  }

  users.push(user)
  res.send("User added with name " + req.body.name)
})

app.listen(8000, () => {
  console.log("Listening on port 8000")
})