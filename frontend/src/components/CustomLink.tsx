import "./CustomLink.css"

interface CustomLinkProps {
  href: string;
  text: string;
}

export default function CustomLink({ href, text }: CustomLinkProps) {
  return (
    <a className="custom-link" href={href} target="_blank" rel="noreferrer">{text}</a>
  )
}