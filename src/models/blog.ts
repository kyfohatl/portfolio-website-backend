import database from "../herokuClient"

export default class Blog {
  id: string
  userId: string
  html: string
  css: string
  creationDate: string

  constructor(id: string, userId: string, html: string, css: string, creationDate: string) {
    this.id = id
    this.userId = userId
    this.html = html
    this.css = css
    this.creationDate = creationDate
  }

  // Returns a list of the most recently created blogs, limited by the given limit and starting from the
  // given offset
  static mostRecent(limit: number, offset: number) {
    const queryStr = `
      SELECT user_id, html, css, created
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
        creationDate: string
      }>(queryStr, queryVals, (err, data) => {
        if (err) return reject(err)
        const blogs = data.rows.map((blog) => {
          return new Blog(blog.id, blog.userId, blog.html, blog.css, blog.creationDate)
        })

        return resolve(blogs)
      })
    })

    return promise
  }

  // extractSummary(html: string) {
  //   html.match(/<meta\s+[\w\W]*content=/g)
  // }

  static create(userId: string, html: string, css: string, creationDate: string) {
    const queryStr = `
      INSERT INTO blogs(user_id, html, css, created)
      VALUES($1, $2, $3, $4)
    `
    const queryVals = [userId, html, css, creationDate]

    const promise = new Promise<true>((resolve, reject) => {
      database.query(queryStr, queryVals, (err, data) => {
        if (err) return reject(err)
        return resolve(true)
      })
    })

    return promise
  }
}