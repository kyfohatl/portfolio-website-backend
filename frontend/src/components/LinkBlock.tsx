import "./LinkBlock.css"

interface LinkBlockProps {
  links: JSX.Element[];
}

export default function LinkBlock({ links }: LinkBlockProps) {
  return (
    <div className="link-block">{links}</div>
  )
}