import { BackendError } from "../custom"
import Database from "../lib/Database"

interface TagProps {
  blog_id: string,
  tag: string
}

interface BlogProps {
  id: string,
  user_id: string,
  html: string,
  css: string,
  created: string,
  summary_title: string,
  summary_description: string,
  summary_img: string,
  tags: string[]
}

export const NEGATIVE_OFFSET_OR_LIMIT_TXT = "Offset or limit cannot be a negative number"
export const NO_BLOGS_TXT = "No more blogs to show"
export const BLOG_NOT_EXIST_TXT = "Given blog id does not exist!"
export const NOT_AUTH_TO_EDIT_TXT = "User cannot edit or delete this blog"
export const INVALID_BLOG_ID_TXT = "No blog with matching id found"

export default class Blog {
  id: string
  userId: string
  html: string
  css: string
  creationDate: string
  summaryTitle: string
  summaryDescription: string
  summaryImg: string
  tags: string[]

  constructor(
    id: string,
    userId: string,
    html: string,
    css: string,
    creationDate: string,
    summaryTitle: string,
    summaryDescription: string,
    summaryImg: string,
    tags: string[]
  ) {
    this.id = id
    this.userId = userId
    this.html = html
    this.css = css
    this.creationDate = creationDate
    this.summaryTitle = summaryTitle
    this.summaryDescription = summaryDescription
    this.summaryImg = summaryImg
    this.tags = tags
  }

  // Returns the blog with the given blogId if it exists, otherwise throws an error
  static where(blogId: string) {
    const queryStr = `
      SELECT id, user_id, html, css, created, summary_title, summary_description, summary_img, array_agg(tag) as tags
      FROM
        (
          SELECT id, user_id, html, css, created, summary_title, summary_description, summary_img
          FROM blogs
          WHERE id = $1
        ) a1
      LEFT JOIN blog_tags
        ON a1.id = blog_tags.blog_id
      GROUP BY id, user_id, html, css, created, summary_title, summary_description, summary_img;
    `
    const queryVals = [blogId]

    const promise = new Promise<Blog>((resolve, reject) => {
      Database.getClient().query<BlogProps>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0) {
          // Could not find given blog id
          return reject({ simpleError: BLOG_NOT_EXIST_TXT, code: 404 } as BackendError)
        }

        const blog: BlogProps = data.rows[0]
        return resolve(new Blog(
          blog.id,
          blog.user_id,
          blog.html,
          blog.css,
          blog.created,
          blog.summary_title,
          blog.summary_description,
          blog.summary_img,
          blog.tags
        ))
      })
    })

    return promise
  }

  // Returns a list of the most recently created blogs, limited by the given limit and starting from the
  // given offset
  static mostRecent(limit: number, offset: number) {
    if (limit < 0 || offset < 0) throw { simpleError: NEGATIVE_OFFSET_OR_LIMIT_TXT, code: 404 } as BackendError

    const queryStr = `
      SELECT id, user_id, html, css, created, summary_title, summary_description, summary_img, array_agg(tag) as tags
      FROM blogs
      LEFT JOIN blog_tags
        ON blogs.id = blog_tags.blog_id
      GROUP BY id
      ORDER BY created
      LIMIT $1 OFFSET $2;
    `
    const queryVals = [limit, offset]

    const promise = new Promise<Blog[]>((resolve, reject) => {
      Database.getClient().query<BlogProps>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0) return reject({ simpleError: NO_BLOGS_TXT, code: 404 } as BackendError)

        const blogs = data.rows.map((blog) => {
          return new Blog(
            blog.id,
            blog.user_id,
            blog.html,
            blog.css,
            blog.created,
            blog.summary_title,
            blog.summary_description,
            blog.summary_img,
            blog.tags
          )
        })

        return resolve(blogs)
      })
    })

    return promise
  }

  // Extracts and returns the open graph summary of the given html file, as well as it's associated tags
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

    const tags: string[] = []

    // Isolate the comma separated list of tags if it exists
    const csTagsMatch = html.match(/<meta\s+.*?name="keywords"\s+.*?content=(["'])((?:\\.|[^\\])*?)\1\s*.*?\/>/)

    if (csTagsMatch) {
      const csTags = csTagsMatch[2]

      // Match every item in the comma separated list of tags and place in the tags array
      const tagMatches = csTags.matchAll(/\s*([^,]+)/g)
      for (const tagMatch of tagMatches) {
        tags.push(tagMatch[1])
      }
    }

    return { title: title, description: description, image: image, tags: tags }
  }

  // Saves the given blog (without tags) into the database
  static async saveBlogWithoutTags(
    userId: string,
    html: string,
    css: string,
    summaryTitle: string,
    summaryDescription: string,
    summaryImg: string,
    blogId?: string | null,
    creationDate?: string
  ) {
    let queryStr: string
    let queryVals: (string | Date)[]
    if (blogId) {
      // We are updating an existing blog
      queryStr = `
          UPDATE blogs
          SET
            html = $1,
            css = $2,
            last_edited = NOW(),
            summary_title = $3,
            summary_description = $4,
            summary_img = $5
          WHERE id = $6
          RETURNING id;
        `
      queryVals = [html, css, summaryTitle, summaryDescription, summaryImg, blogId]
    } else {
      // We are creating a new blog
      queryStr = `
          INSERT INTO blogs(user_id, html, css, created, last_edited, summary_title, summary_description, summary_img)
          VALUES($1, $2, $3, ${creationDate ? `'${creationDate}'` : "NOW()"}, NOW(), $4, $5, $6)
          RETURNING id;
        `
      queryVals = [userId, html, css, summaryTitle, summaryDescription, summaryImg]
    }

    const promise = new Promise<string>((resolve, reject) => {
      Database.getClient().query<{ id: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0) {
          return reject({ simpleError: "Error: Could not save blog into database", code: 500 } as BackendError)
        }

        return resolve(data.rows[0].id)
      })
    })

    return promise
  }

  // Removes old tags of the given blog id (if they exist)
  static async removeTags(blogId: string) {
    const queryStr = `
      DELETE FROM blog_tags
      WHERE blog_id = $1
      RETURNING blog_id, tag;
    `
    const queryVals = [blogId]

    const promise = new Promise<TagProps[]>((resolve, reject) => {
      Database.getClient().query<TagProps>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        return resolve(data.rows)
      })
    })

    return promise
  }

  // Inserts given tags into the database under the given blog id
  static async saveTags(blogId: string, tags: string[]) {
    if (tags.length <= 0) return

    // Start with base query string
    let queryStr = `
      INSERT INTO blog_tags(blog_id, tag)
      VALUES 
    `
    // Build dynamic query string
    let i = 1
    for (let j = 0; j < tags.length; j++) {
      queryStr += `($${i++}, $${i++})`

      if (j === tags.length - 1) queryStr += ";"
      else queryStr += ", "
    }

    // Build dynamic query values
    const queryVals: string[] = []
    for (const tag of tags) {
      queryVals.push(blogId)
      queryVals.push(tag)
    }

    const promise = new Promise<void>((resolve, reject) => {
      Database.getClient().query(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        return resolve()
      })
    })

    return promise
  }

  // Throws an error if the given user id cannot edit the blog with the given blog id
  static async canEdit(blogId: string, userId: string) {
    const queryStr = `
      SELECT user_id
      FROM blogs
      WHERE id = $1
    `
    const queryVals = [blogId]

    const promise = new Promise<void>((resolve, reject) => {
      Database.getClient().query<{ user_id: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0) {
          // Blog id not found
          return (reject({ simpleError: INVALID_BLOG_ID_TXT, code: 404 } as BackendError))
        }

        if (data.rows[0].user_id !== userId) {
          return reject({ simpleError: NOT_AUTH_TO_EDIT_TXT, code: 403 } as BackendError)
        }

        return resolve()
      })
    })

    return promise
  }

  // Saves the given blog with the given information into the database
  // If a blog id is provided, the existing blog will be overridden, otherwise a new blog will be created
  // An existing blog can only be edited by the user that originally created the blog
  static async save(
    userId: string,
    html: string,
    css: string,
    blogId?: string | null,
    creationDate?: string
  ) {
    try {
      // If an existing blog is being edited, ensure that the given user can edit the given blog
      if (blogId) {
        await Blog.canEdit(blogId, userId)
      }

      // Get blog summary
      const summary = Blog.extractSummary(html)

      // Save the blog
      const returningBlogId = await Blog.saveBlogWithoutTags(
        userId,
        html,
        css,
        summary.title,
        summary.description,
        summary.image,
        blogId,
        creationDate
      )

      if (blogId) {
        // Existing blog. Delete old tags
        await Blog.removeTags(blogId)
      }

      // Save blog tags, if any
      await Blog.saveTags(returningBlogId, summary.tags)
      return returningBlogId
    } catch (err) {
      throw err
    }
  }

  // Deletes the blog with the given id in the database, if the request comes from the same user that
  // created the blog
  static async delete(blogId: string, userId: string) {
    // Ensure the user can delete this blog
    await Blog.canEdit(blogId, userId)

    const queryStr = `
      DELETE FROM blogs
      WHERE id = $1
      RETURNING id
    `
    const queryVals = [blogId]

    const promise = new Promise<string>((resolve, reject) => {
      Database.getClient().query<{ id: string }>(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        if (data.rowCount <= 0) {
          // Blog with given id does not exist
          return reject({ simpleError: "No blog with given id found", code: 404 } as BackendError)
        }

        // Blog successfully deleted
        return resolve(data.rows[0].id)
      })
    })

    return promise
  }

  static async deleteAllUserBlogs(userId: string) {
    const queryStr = `
      DELETE FROM blogs
      WHERE user_id = $1;
    `
    const queryVals = [userId]

    const promise = new Promise<void>((resolve, reject) => {
      Database.getClient().query(queryStr, queryVals, (err, data) => {
        if (err) return reject({ unknownError: err, code: 500 } as BackendError)
        resolve()
      })
    })

    return promise
  }
}