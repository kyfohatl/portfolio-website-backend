import backgroundImage from "../assets/images/backgroundImage.jpg"
import "./Home.css"
import Navbar from "../components/Navbar"

export default function Home() {
  console.log(backgroundImage)
  return (
    <>
      <div className="background">
        <Navbar />
        <p className="welcome-text">Welcome to my website</p>
      </div>
    </>
  )
}