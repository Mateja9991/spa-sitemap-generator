class UrlMap {
  #visitedUrls = new Map();
  #modifiedUrls = new Map();
  #urlsToMap = new Map();
  #baseUrl = "";
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
  get pathsWithStatus() {
    return this.validPaths.map((path) => ({
      path,
      isModified: !!this.#modifiedUrls.get(path),
    }));
  }
  *#genPaths() {
    for (const [urlPath, isVisited] of this.#visitedUrls) {
      if (!isVisited) yield urlPath;
    }
  }
  get pathsToVisit() {
    return this.#genPaths();
  }
  addNewUrl(url) {
    const { pathname } = new URL(url);
    this.#visitedUrls.set(pathname, false);
    this.#urlsToMap.set(pathname, true);
  }
  markAsVisited(path) {
    this.#visitedUrls.set(path, true);
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
