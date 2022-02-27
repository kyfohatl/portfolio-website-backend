import "../lib/headings.css"
import "./Skills.css"

import Navbar from "../components/Navbar";

export default function Skills() {
  return (
    <div className="skills-background">
      <Navbar />
      <div className="content">
        <div className="content-block">
          <article className="skills-article">
            <h2>Education</h2>
            <p>
              Studied at Computer Science (Bsc) at The University of Melbourne from 2018-2021, graduating with
              a gpa of 5.8, equivalent to a Weighted Average Mark (WAM) of 77.25.
            </p>
            <p>
              In addition to the core Computer Science subject, I also took a number of biology subjects (Chemistry,
              Biochemistry, Genetics, Human Physiology and Anatomy), as I have an interest in simulating biological
              systems in a virtual environment, and believe that combining computing with biology is a fascinating
              field of study.
            </p>
          </article>
          <article className="skills-article">
            <h2>Work Experience</h2>
            <h3>Pharmacy Assistant</h3>
            <h4>
              <span className="workxp-span">Star Pharmacy</span>
              <span className="workxp-span">Melbourne VIC</span>
              <span className="workxp-span">Aug 2015 - Present</span>
            </h4>
            <p>
              I started working at Star Pharmacy before I began my university studies and continued to work there
              throughout my degree, in a part-time capacity. Though initially I felt uncomfortable in a customer-
              facing position, this role greatly helped me develope my people and communication skills, and over
              the years I found it to be a refreshing change from my studies, which was mostly at a computer.
            </p>
            <p>
              I worked both in a Pharmacy Assistant role, and a Medication Delivery role, and had the opportunity
              to work in multiple stores (Kew and Middle Park). I believe that my consistent and professional
              service played a significant role in the flourishing and expansion the delivery side of the business.
              There were quite a few instances of satisfied customers who recommended the service to their
              neighbors, whom I consequently delivered to.
            </p>
          </article>
          <article className="skills-article">
            <h2>Notable Achievements</h2>
            <ul className="skills-list">
              <li>
                <p>
                  Selected as one of the top 3 teams of the Computer Science IT Project capstone subject, and had the
                  honour of presenting my work at the 2021 University of Melbourne CIS conference.
                </p>
              </li>
              <li>
                <p>
                  Final year Software Modeling and Design project, where we designed a card game using object
                  oriented principles and design patterns, scored 100% and was selected as a reference for future
                  year students.
                </p>
              </li>
            </ul>
          </article>
          <article className="skills-article">
            <h2>Skills</h2>
          </article>
        </div>
      </div>
    </div>
  )
}