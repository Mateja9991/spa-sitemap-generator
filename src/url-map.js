class UrlMap {
  #visitedUrls = new Map();
  #modifiedUrls = new Map();
  #urlsToMap = new Map();
  #arrToVisit = [];
  #baseUrl = "";
  #gen = null;
  constructor(baseUrl) {
    this.#baseUrl = baseUrl;
    this.markForMapping(baseUrl);
  }
  get validPaths() {
    const validPaths = [];
    for (const [pathname, isValid] of this.#urlsToMap) {
      if (isValid) validPaths.push(pathname);
    }
    return validPaths;
  }
  get numOfUrls() {
    let counter = 0;
    for (const val of this.#urlsToMap.values()) {
      val && counter++;
    }
    return counter;
  }
  get isBufferEmpty() {
    return !this.#arrToVisit.length;
  }
  get pathsWithStatus() {
    console.log(this.#arrToVisit);
    return this.validPaths.map((path) => ({
      path,
      isModified: !!this.#modifiedUrls.get(path),
    }));
  }
  get gen() {
    if (!this.#gen || this.#gen.next().done) this.#gen = this.#genPaths();
    return this.#gen;
  }
  *#genPaths() {
    let index = -1;
    while (this.#arrToVisit.length) {
      const result = this.#arrToVisit[0];
      this.#arrToVisit.push(this.#arrToVisit.shift());
      yield result;
    }
  }
  get pathsToVisit() {
    return this.gen;
  }
  addNewUrl(url) {
    const { pathname } = new URL(url);
    // console.log(this.#visitedUrls);
    this.#visitedUrls.set(pathname, false);
    this.#arrToVisit.push(pathname);
    this.#urlsToMap.set(pathname, true);
    // console.log(this.#visitedUrls);
  }
  markAsVisited(path) {
    this.#visitedUrls.set(path, true);
    const index = this.#arrToVisit.indexOf(path);
    if (index !== -1) this.#arrToVisit.splice(index, 1);
  }
  isMarkedForVisit(path) {
    return this.#visitedUrls.has(path);
  }
  markForMapping(path) {
    this.#urlsToMap.set(path, true);
  }
  unmarkForMapping(path) {
    this.#urlsToMap.set(path, false);
  }
  markAsModified(path) {
    this.#modifiedUrls.set(path, true);
  }
  wasVisited(path) {
    return this.#visitedUrls.get(path);
  }
}

module.exports = UrlMap;
