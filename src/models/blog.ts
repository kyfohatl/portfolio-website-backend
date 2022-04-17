import database from "../herokuClient"

export default class Blog {
  id: string
  userId: string
  html: string
  css: string
  creationDate: string
  summaryTitle: string
  summaryDescription: string
  summaryImg: string

  constructor(
    id: string,
    userId: string,
    html: string,
    css: string,
    creationDate: string,
    summaryTitle: string,
    summaryDescription: string,
    summaryImg: string
  ) {
    this.id = id
    this.userId = userId
    this.html = html
    this.css = css
    this.creationDate = creationDate
    this.summaryTitle = summaryTitle
    this.summaryDescription = summaryDescription
    this.summaryImg = summaryImg
  }

  // Returns a list of the most recently created blogs, limited by the given limit and starting from the
  // given offset
  static mostRecent(limit: number, offset: number) {
    const queryStr = `
      SELECT id, user_id, html, css, created, summary_title, summary_description, summary_img
      FROM blogs
      ORDER BY created
      LIMIT $1 OFFSET $2
    `
    const queryVals = [limit, offset]

    const promise = new Promise<Blog[]>((resolve, reject) => {
      database.query<{
        id: string,
        userId: string,
        html: string,
        css: string,
        creationDate: string,
        summaryTitle: string,
        summaryDescription: string,
        summaryImg: string
      }>(queryStr, queryVals, (err, data) => {
        if (err) return reject(err)
        const blogs = data.rows.map((blog) => {
          return new Blog(
            blog.id,
            blog.userId,
            blog.html,
            blog.css,
            blog.creationDate,
            blog.summaryTitle,
            blog.summaryDescription,
            blog.summaryImg
          )
        })

        return resolve(blogs)
      })
    })

    return promise
  }

  // Extracts and returns the open graph summary of the given html file
  static extractSummary(html: string) {
    let title = ""
    const titleMatch = html.match(/<meta\s+.*?property="og:title"\s+.*?content=(["'])((?:\\.|[^\\])*?)\1/)
    if (titleMatch) title = titleMatch[2]

    let description = ""
    const descriptionMatch = html.match(/<meta\s+.*?property="og:description"\s+.*?content=(["'])((?:\\.|[^\\])*?)\1/)
    if (descriptionMatch) description = descriptionMatch[2]

    let image = ""
    const imageMatch = html.match(/<meta\s+.*?property="og:image"\s+.*?content=(["'])((?:\\.|[^\\])*?)\1/)
    if (imageMatch) image = imageMatch[2]

    return {title: title, description: description, image: image}
  }

  // Stores a new blog with the given information in the database
  static create(userId: string, html: string, css: string) {
    const summary = Blog.extractSummary(html)
    const creationDate = new Date()

    const queryStr = `
      INSERT INTO blogs(user_id, html, css, created, summary_title, summary_description, summary_img)
      VALUES($1, $2, $3, $4, $5, $6, $7)
    `
    const queryVals = [userId, html, css, creationDate, summary.title, summary.description, summary.image]

    const promise = new Promise<true>((resolve, reject) => {
      database.query(queryStr, queryVals, (err, data) => {
        if (err) return reject(err)
        return resolve(true)
      })
    })

    return promise
  }
}