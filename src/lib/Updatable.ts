export default class Updatable<T> {
  #content: T | undefined

  constructor() {
    this.#content = undefined
  }

  update(newValue: T) {
    this.#content = newValue
  }

  getContent() {
    if (typeof this.#content === "undefined") throw new Error("Content is undefined!")
    return this.#content
  }
}