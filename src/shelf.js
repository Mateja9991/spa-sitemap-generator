const crypto = require('crypto');
const fsSync = require('fs');
const fs = fsSync.promises;
const delimeter = ':::';
class HashShelf {
  static #map = null;
  static #path = './.sitemap.snapshots';
  static setPath(path) {
    this.#path = path;
  }
  static async initialize() {
    this.#map = new Map();
    if (!fsSync.existsSync(this.#path)) return;
    const data = await fs.readFile(this.#path, 'utf-8');
    data
      .split('\n')
      .map((entry) => entry.split(delimeter))
      //   .filter((el) => el)
      .forEach(([key, hash]) => {
        this.#map.set(key, hash);
      });
  }
  static async #dropSnapshot() {
    await fs.writeFile(this.#path, '', { flag: 'w+' });
  }
  static async #updateSnapshot() {
    await this.#dropSnapshot();
    for (const [key, hash] of await this.#map) {
      await fs.writeFile(this.#path, this.#generateEntry(key, hash), {
        flag: 'a+',
      });
    }
  }
  static #generateEntry(key, hash) {
    return `${key}${delimeter}${hash}\n`;
  }
  static async set(key, content) {
    const hashedContent = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
    const oldHash = this.#map.get(key);
    this.#map.set(key, hashedContent);
    if (oldHash !== hashedContent) await this.#updateSnapshot();
  }
  static get(url) {
    return this.#map.get(url);
  }
  static isKeyModified(key, newContent) {
    const hashedContent = crypto
      .createHash('sha256')
      .update(newContent)
      .digest('hex');
    return hashedContent !== this.get(key);
  }

  static async writeContent(url, content) {
    try {
      await fs.writeFile(
        `./page-contents/${url.replace(new RegExp(/(\/|:)+/g), '')}`,
        content,
        {
          flag: 'w+',
        }
      );
    } catch (err) {
      console.log(err);
    }
  }
  static async getContent(url) {
    try {
      const data = await fs.readFile(
        `./pages-content/${url.replace(new RegExp(/(\/|:)+/g), '')}`,
        'utf-8'
      );
      return data;
    } catch (err) {
      return '';
    }
  }
  static async compareContents(url, content) {
    try {
      const savedContent = await this.getContent(url);
      if (!savedContent) {
        return await this.writeContent(url, content);
      }
      const splitContent = content.match(/.{1,30}/g);
      const splitIndex = splitContent.map((el, index) => ({
        line: el,
        index,
      }));
      const diff = splitIndex.filter(({ line }) => {
        return savedContent.indexOf(line) === -1;
      });
      const splitSavedContent = savedContent.match(/.{1,30}/g);
      if (diff.length) {
        console.log('---------------------------------');
        console.log(url);
        console.log(
          `Content len: ${splitContent.length} --- Diff len: ${diff.length}`
        );
        const oldDiff = diff.map(({ index }) => splitSavedContent[index]);
        console.log(diff);
        console.log('~~~~~~~~~~~~~~~~~~~~~~~~');
        console.log(oldDiff);
        console.log('---------------------------------');
        await this.writeContent(url, content);
      }
    } catch (err) {
      console.log(err);
    }
  }
}
module.exports = HashShelf;
