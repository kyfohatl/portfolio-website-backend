import backgroundImage from "../assets/images/backgroundImage.jpg"
import "./Home.css"

export default function Home() {
  console.log(backgroundImage)
  return (
    <div className="background">
      <p className="welcome-text">Welcome to my website</p>
    </div>
  )
}