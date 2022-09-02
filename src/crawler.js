const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs/promises');
const Shelve = require('./shelve');

const protocolRegexp = new RegExp('^(http|https)://');
const wwwRegexp = new RegExp('^((http|https)://)?(www.)?');
const removeProtocol = (url) => url.replace(protocolRegexp, '');
const shrinkDomain = (url) => url.replace(wwwRegexp, '');
class Crawler {
  baseUrl = '';
  visitedUrls = new Map();
  modifiedUrls = new Map();
  urlsToMap = new Map();
  browser = null;
  pages = [];
  constructor(baseUrl) {
    this.baseUrl = new URL(baseUrl).origin;
    this.urlsToMap.set(baseUrl, true);
  }
  get page() {
    return (this.pages || [])[0];
  }
  set page(value) {
    this.pages.unshift(value);
  }
  get validUrls() {
    const validUrls = [];
    for (const [pathname, isValid] of this.urlsToMap) {
      if (isValid) validUrls.push(new URL(pathname, this.baseUrl).href);
    }
    return validUrls;
  }
  async #startBrowser() {
    try {
      console.log('Opening the browser......');
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--disable-setuid-sandbox'],
        ignoreHTTPSErrors: true,
      });
    } catch (err) {
      console.log('Could not create a browser instance => : ', err);
    }
    const page = await this.browser.newPage();
  }
  #isRedirect(url) {
    return this.page.url() !== url;
  }
  #wasURLVisited(url) {
    return this.visitedUrls.get(new URL(url).pathname);
  }
  #isValidHostname(url) {
    return shrinkDomain(url).match(
      new RegExp(`^${shrinkDomain(this.baseUrl)}.*`)
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
  async #getCurrentPageContent() {
    return await this.page.evaluate(() => {
      document.querySelector('.recomended-cards')?.remove();
      return document.querySelector('*').innerHTML;
    });
  }
  async #processNewUrls() {
    for (const [urlPath, isVisited] of this.visitedUrls) {
      if (isVisited) continue;
      const newUrl = new URL(urlPath, this.baseUrl);
      console.log(newUrl.href);
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
      if (!(await this.#visitAndValidateUrl(url))) return;
      if (
        await Shelve.isPageModified(url, await this.#getCurrentPageContent())
      ) {
        console.log(`${url} was modified.`);
        this.modifiedUrls.set(url, true);
      }
      await Shelve.savePageContent(url, await this.#getCurrentPageContent());
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
