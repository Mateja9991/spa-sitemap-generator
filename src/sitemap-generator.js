const fs = require('fs/promises');

const sitemapStart = `<?xml version="1.0" encoding="UTF-8"?>\n\t<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns\:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`;
const sitemapEnd = `\n</urlset>\n`;
const generateUrlTag = (url) => {
  return `\n\t<url>\n\t\t<loc>\n\t\t\t${url}\n\t\t</loc>\n\t\t<lastmod>\n\t\t\t${new Date().toISOString()}\n\t\t</lastmod>\n\t</url>`;
};

class SitemapGenerator {
  urls = [];
  constructor(urls, filePath, fileName) {
    this.filePath = filePath || '.';
    this.fileName = fileName || 'sitemap.xml';
    this.urls = urls;
  }
  async generateSitemapXML() {
    try {
      const path = `${this.filePath.replace(new RegExp('/$'), '')}/${
        this.fileName
      }`;
      console.log(`Generating file ${path}...`);
      await fs.writeFile(path, sitemapStart, { flag: 'w+' });
      for (const url of this.urls) {
        await fs.writeFile(path, generateUrlTag(new URL(url)), { flag: 'a' });
      }
      await fs.writeFile(path, sitemapEnd, { flag: 'a' });
      console.log('File generated sucessfully.');
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = SitemapGenerator;
