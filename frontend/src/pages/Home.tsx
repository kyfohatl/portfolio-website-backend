import backgroundImage from "../assets/images/backgroundImage.jpg"
import "./Home.css"
import Navbar from "../components/Navbar"

export default function Home() {
  console.log(backgroundImage)
  return (
    <>
      <div className="home-background">
        <Navbar />
        <p className="welcome-text">
          Welcome to my website!<br />
          Explore using the navigation links
        </p>
      </div>
    </>
  )
}