const fs = require("fs/promises");
const xml2js = require("xml2js");

const sitemapStart = `<?xml version="1.0" encoding="UTF-8"?>\n\t<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns\:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`;
const sitemapEnd = `\n</urlset>\n`;

class SitemapGenerator {
  static #urlMap = new Map();
  constructor(urls, filePath, fileName) {
    this.filePath = filePath || ".";
    this.fileName = fileName || "sitemap.xml";
    this.urls = urls;
  }
  static async generateSitemapXML({
    urls = this.urls,
    filePath = this.filePath || ".",
    fileName = this.fileName || "sitemap.xml",
  }) {
    const getFullPath = (filePath, fileName) =>
      `${filePath.replace(new RegExp("/$"), "")}/${fileName}`;

    try {
      const path = getFullPath(filePath, fileName);
      console.log(`Generating file ${path}...`);
      await this.#parseSitemapXMLData(path);
      await fs.writeFile(path, sitemapStart, { flag: "w+" });
      await this.#writeUrlsToXML(urls, path);
      await fs.writeFile(path, sitemapEnd, { flag: "a" });
      console.log("File generated sucessfully.");
    } catch (err) {
      console.log(err);
    }
  }
  static async #writeUrlsToXML(urls, path) {
    for (const { url, isModified } of urls) {
      const dt = isModified ? new Date().toISOString() : this.#urlMap.get(url);
      await fs.writeFile(path, this.#generateUrlTag(new URL(url).href, dt), {
        flag: "a",
      });
    }
  }
  static #generateUrlTag(url, date) {
    return `\n\t<url>\n\t\t<loc>\n\t\t\t${url}\n\t\t</loc>\n\t\t<lastmod>\n\t\t\t${date}\n\t\t</lastmod>\n\t</url>`;
  }
  static async #loadMapFromSitemapFile(path) {
    this.#parseSitemapXMLData(path);
  }
  static async #parseSitemapXMLData(path) {
    try {
      const data = await fs.readFile(path, "utf-8");
      const xmlObj = await xml2js.parseStringPromise(data);
      // console.log(xmlObj.urlset);
      xmlObj.urlset.url.forEach((urlTag) => {
        const [url] = urlTag.loc;
        const [lastMod] = urlTag.lastmod;
        this.#urlMap.set(url.trim(), lastMod.trim());
      });
      // console.log(this.#urlMap);
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = SitemapGenerator;
