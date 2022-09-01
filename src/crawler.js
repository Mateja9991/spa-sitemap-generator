const puppeteer = require("puppeteer");
const crypto = require("crypto");
const fs = require("fs/promises");

const sitemapStart = `<?xml version="1.0" encoding="UTF-8"?>\n\t<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns\:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`;
const sitemapEnd = `\n</urlset>\n`;
const generateUrlTag = (url) => {
    return `\n\t<url>\n\t\t<loc>\n\t\t\t${url}\n\t\t</loc>\n\t\t<lastmod>\n\t\t\t${new Date().toISOString()}\n\t\t</lastmod>\n\t</url>`;
};
const removeProtocol = (url) => url.replace(new RegExp("^(http|https)://"), "");

class Crawler {
    baseUrl = "";
    urls = new Map();
    browser = null;
    constructor(baseUrl, filePath, fileName) {
        this.baseUrl = baseUrl;
        this.filePath = filePath || ".";
        this.fileName = fileName || "sitemap.xml";
    }
    async startBrowser() {
        try {
            console.log("Opening the browser......");
            this.browser = await puppeteer.launch({
                headless: true,
                args: ["--disable-setuid-sandbox"],
                ignoreHTTPSErrors: true,
            });
        } catch (err) {
            console.log("Could not create a browser instance => : ", err);
        }
    }
    async closeBrowser() {
        try {
            console.log("Closing the browser......");
            await this.browser.close();
        } catch (err) {
            console.log("Could not close the browser instance => : ", err);
        }
    }
    isValidHostname(url) {
        return removeProtocol(url).match(
            new RegExp(`^${removeProtocol(this.baseUrl)}.*`)
        );
    }
    async generateSitemapXML() {
        try {
            const path = `${this.filePath.replace(new RegExp("/$"), "")}/${
                this.fileName
            }`;
            console.log(`Generating file ${path}...`);
            await fs.writeFile(path, sitemapStart, { flag: "w+" });
            for (const [url, _] of this.urls) {
                await fs.writeFile(path, generateUrlTag(url), { flag: "a" });
            }
            await fs.writeFile(path, sitemapEnd, { flag: "a" });
            console.log("File generated sucessfully.");
        } catch (err) {
            console.log(err);
        }
    }
    async startCrawling() {
        try {
            if (!this.browser) await this.startBrowser();
            await this.crawl(this.baseUrl);
            await this.closeBrowser();
            await this.generateSitemapXML();
        } catch (err) {
            console.log(err);
        }
    }
    async crawl(url = this.baseUrl) {
        try {
            if (!this.browser) {
                throw new Error("Browser is not open.");
            }
            this.urls.set(url, true);
            const page = await this.browser.newPage();
            await page.goto(url, { waitUntil: "load" });
            const pageContent = await page.evaluate(
                () => document.querySelector("*").outerHTML
            );
            // const hash = crypto
            //     .createHash("sha256")
            //     .update(pageContent)
            //     .digest("hex");
            //provera da li se stranica menjala...

            const links = await page.evaluate(() =>
                Array.from(
                    document.querySelectorAll("a"),
                    (element) => element.href
                )
            );
            // console.log(links);
            links.forEach(
                (link) =>
                    this.isValidHostname(link) &&
                    !this.urls.get(link) &&
                    this.urls.set(link, false)
            );
            for (const [url, isVisited] of this.urls) {
                !isVisited && (await this.crawl(url));
                console.log(url);
            }
        } catch (err) {
            console.log("Error in crawl: ", err);
        }
    }
}

module.exports = Crawler;
