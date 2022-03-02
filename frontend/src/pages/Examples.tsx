import Navbar from "../components/Navbar"
import "./Examples.css"
import cataLogCreateAccImg from "../assets/images/catalog-create-acc.png"

import CustomLink from "../components/CustomLink"
import LinkBlock from "../components/LinkBlock"

export default function Examples() {
  return (
    <div className="examples-background">
      <Navbar />
      <div className="examples-content">
        <div className="examples-content-block">
          <article className="examples-article">
            <h2>CataLog</h2>
            <LinkBlock
              links={[
                <CustomLink href="https://github.com/bawses/it-project-crm" text="Github" />,
                <CustomLink href="https://it-project-crm.vercel.app/welcome" text="Deployment" />,
              ]}
            />
            <p>
              CataLog is an online CRM (Customer Relationship Management software) created for the capstone
              comp sci subject. To create this product, I had to work in a team of 5, follow agile development
              methodology, and negotiate requirements with a client. Highlights include:
            </p>
            <ul className="examples-list">
              <li>
                <p>Creating and customizing user profiles</p>
                <img src={cataLogCreateAccImg} alt="Creating and account" width="50%" height="50%" />
              </li>
              <li>Searching for and adding contacts on the CataLog network</li>
              <li>Creating manual contact entries for contacts not on the CataLog network</li>
              <li>Creating and interacting with organizations</li>
              <li>Fully functional on both desktop and mobile devices</li>
              <li>Deployed on Vercel Cloud</li>
            </ul>
          </article>
        </div>
      </div>
    </div>
  )
}