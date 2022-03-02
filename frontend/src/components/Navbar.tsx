import { Link } from "react-router-dom"

import "./Navbar.css"

export default function Navbar() {
  return (
    <nav className="navbar">
      <li className="navbar-logo">Ehsan's Portfolio</li>
      <li className="navbar-button"><Link to="/techstack" className="router-link">Techstack</Link></li>
      <li className="navbar-button"><Link to="/about" className="router-link">About</Link></li>
      <li className="navbar-button"><Link to="/skills" className="router-link">Skills &amp; Qualifications</Link></li>
      <li className="navbar-button"><Link to="/examples" className="router-link">Examples of Work</Link></li>
    </nav>
  )
}