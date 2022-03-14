import Navbar from "../components/Navbar"
import "./Examples.css"

import cataLogCreateAccImg from "../assets/images/catalog-create-acc.png"
import cataLogHomeImg from "../assets/images/catalog-home.png"
import cataLogSearchImg from "../assets/images/catalog-search.png"
import cataLogManualContactImg from "../assets/images/catalog-manual-contact.png"
import cataLogMergeImg from "../assets/images/catalog-merge.png"
import cataLogCreateOrgImg from "../assets/images/catalog-create-org.png"
import cataLogMobileHomeImg from "../assets/images/catalog-mobile-home.png"
import cataLogMobileContactImg from "../assets/images/catalog-mobile-contact.png"
import cataLogMobileCreateContactImg from "../assets/images/catalog-mobile-create-contact.png"
import vercelLogoImg from "../assets/images/vercel-logo.jpg"

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
                <img src={cataLogCreateAccImg} alt="Creating an account" width="80%" height="80%" />
              </li>
              <li>
                <p>Categorizing and filtering added contacts</p>
                <img src={cataLogHomeImg} alt="Home page" width="80%" height="80%" />
              </li>
              <li>
                <p>Searching for and adding contacts on the CataLog network</p>
                <img src={cataLogSearchImg} alt="Search page" width="80%" height="80%" />
              </li>
              <li>
                <p>Creating manual contact entries for contacts not on the CataLog network</p>
                <img src={cataLogManualContactImg} alt="Create manual contact page" width="80%" height="80%" />
              </li>
              <li>
                <p>Merging newly-added CataLog profiles with existing manual profiles</p>
                <img src={cataLogMergeImg} alt="Create manual contact page" width="80%" height="80%" />
              </li>
              <li>
                <p>Creating and interacting with organizations</p>
                <img src={cataLogCreateOrgImg} alt="Create organization page" width="80%" height="80%" />
              </li>
              <li>
                <p>Fully functional on both desktop and mobile devices</p>
                <div className="examples-mobile-images">
                  <img src={cataLogMobileHomeImg} alt="Mobile home page" width="25%" height="25%" />
                  <img src={cataLogMobileContactImg} alt="Mobile contact page" width="25%" height="25%" />
                  <img src={cataLogMobileCreateContactImg} alt="Mobile create contact page" width="25%" height="25%" />
                </div>
              </li>
              <li>
                <p>Deployed in a serverless environment on Vercel Cloud</p>
                <img src={vercelLogoImg} alt="Vercel cloud" width="80%" height="80%" />
              </li>
            </ul>
          </article>
        </div>
      </div>
    </div>
  )
}