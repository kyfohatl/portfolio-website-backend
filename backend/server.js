import express from "express"

const app = express()
app.use(express.json())
app.use("/hello", (req, res) => {
  res.send("Hello world")
})

app.listen(8000, () => {
  console.log("Listening on port 8000")
})