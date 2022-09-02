const crypto = require('crypto');
const fs = require('fs/promises');
const delimeter = ':::';
class Shelve {
  static #pageContents = null;
  static #path = './.snapshots';
  static #contents = new Map();
  constructor() {}
  static async getPageContents() {
    if (this.#pageContents === null) {
      this.#pageContents = this.#generateContentMap();
    }
    return this.#pageContents;
  }
  static async #dropSnapshot() {
    await fs.writeFile(this.#path, '', { flag: 'w+' });
  }
  static async #updateSnapshot() {
    await this.#dropSnapshot();
    for (const [url, hash] of await this.getPageContents()) {
      await fs.writeFile(this.#path, this.#generatePageEntry(url, hash), {
        flag: 'a+',
      });
    }
  }
  static async #generateContentMap() {
    const _contentMap = new Map();
    const data = await fs.readFile(this.#path, 'utf-8');
    data
      .split('\n')
      .map((entry) => entry.split(delimeter))
      //   .filter((el) => el)
      .forEach(([url, hash]) => {
        _contentMap.set(url, hash);
      });
    // console.log(_contentMap);
    return _contentMap;
  }
  static #generatePageEntry(url, hash) {
    return `${url}${delimeter}${hash}\n`;
  }
  static #N;
  static async savePageContent(url, pageContent) {
    const hashedContent = crypto
      .createHash('sha256')
      .update(pageContent)
      .digest('hex');
    (await this.getPageContents()).set(url, hashedContent);
    await this.#updateSnapshot();
    // await this.getPageContents();
    // await fs.writeFile(
    //   this.#path,
    //   this.#generatePageEntry(url, hashedContent),
    //   { flag: 'a+' }
    // );
  }
  static async #getSavedPageContent(url) {
    return (await this.getPageContents()).get(url);
  }
  static async isPageModified(url, pageContent) {
    // console.log(pageContent);
    // console.log('TRAZIM SA ' + url);
    const hashedContent = crypto
      .createHash('sha256')
      .update(pageContent)
      .digest('hex');
    // console.log(hashedContent, await this.#getSavedPageContent(url));
    return hashedContent !== (await this.#getSavedPageContent(url));
  }
}
module.exports = Shelve;
