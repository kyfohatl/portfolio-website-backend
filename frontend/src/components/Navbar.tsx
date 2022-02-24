import { Link } from "react-router-dom"

import "./Navbar.css"

export default function Navbar() {
  return (
    <nav className="navbar">
      <li className="navbar-logo">Ehsan's Portfolio</li>
      <li className="navbar-button"><Link to="/techstack">Techstack</Link></li>
      <li className="navbar-button">Link2</li>
      <li className="navbar-button">Link3</li>
    </nav>
  )
}