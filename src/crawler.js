const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs/promises');

const protocolRegexp = new RegExp('^(http|https)://');
const removeProtocol = (url) => url.replace(protocolRegexp, '');

class Crawler {
  baseUrl = '';
  visitedUrls = new Map();
  counter = 0;
  urlsToMap = new Map();
  browser = null;
  pages = [];
  constructor(baseUrl, filePath, fileName) {
    this.baseUrl = new URL(baseUrl).origin;
    this.urlsToMap.set(baseUrl, true);
  }
  get page() {
    return (this.pages || [])[0];
  }
  set page(value) {
    this.pages.unshift(value);
  }
  async #startBrowser() {
    try {
      console.log('Opening the browser......');
      this.browser = await puppeteer.launch({
        headless: false,
        args: ['--disable-setuid-sandbox'],
        ignoreHTTPSErrors: true,
      });
    } catch (err) {
      console.log('Could not create a browser instance => : ', err);
    }
    const page = await this.browser.newPage();
  }
  async getUrlsToMap() {
    const validUrls = [];
    for (const [pathname, isValid] of this.urlsToMap) {
      if (isValid) validUrls.push(new URL(pathname, this.baseUrl).href);
    }
    return validUrls;
  }
  #isRedirect(url) {
    return this.page.url() !== url;
  }
  #wasURLVisited(url) {
    return this.visitedUrls.get(new URL(url).pathname);
  }
  #isValidHostname(url) {
    return removeProtocol(url).match(
      new RegExp(`^${removeProtocol(this.baseUrl)}.*`)
    );
  }
  async #closeBrowser() {
    try {
      console.log('Closing the browser......');
      await this.browser.close();
    } catch (err) {
      console.log('Could not close the browser instance => : ', err);
    }
  }

  #updateMaps(link) {
    if (!this.#isValidHostname(link)) return;
    if (!this.#wasURLVisited(link)) {
      const { pathname } = new URL(link);
      this.visitedUrls.set(pathname, false);
      this.urlsToMap.set(pathname, true);
    }
  }
  async #getAllPageLinks() {
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll('a'), (element) => element.href)
    );
  }
  async startCrawling(url = this.baseUrl) {
    try {
      if (!this.browser) await this.#startBrowser();
      await this.#crawl(new URL(url));
      await this.#closeBrowser();
    } catch (err) {
      console.log(err);
    }
  }
  async #visitAndValidateUrl(url) {
    await this.page.goto(url, { waitUntil: 'load' });
    if (this.#isRedirect(url)) {
      this.urlsToMap.set(url, false);
      if (this.#wasURLVisited(url)) return false;
    }
    return true;
  }
  async #processNewUrls() {
    for (const [urlPath, isVisited] of this.visitedUrls) {
      if (isVisited) continue;
      const newUrl = new URL(urlPath, this.baseUrl);
      console.log(newUrl.pathname);
      await this.#crawl(newUrl);
    }
  }
  async #crawl({ href: url, pathname } = new URL(this.baseUrl)) {
    try {
      if (!this.browser) {
        throw new Error('Browser is not open.');
      }
      if (!this.page) {
        this.page = await this.browser.newPage();
        await this.page.setDefaultNavigationTimeout(0);
      }
      // console.log(url);
      if (!(await this.#visitAndValidateUrl(url))) return;
      this.visitedUrls.set(pathname, true);
      const links = await this.#getAllPageLinks();
      links.forEach((link) => this.#updateMaps(link));
      await this.#processNewUrls();
    } catch (err) {
      console.log('Error in crawl: ', err);
    }
  }
}

module.exports = Crawler;
