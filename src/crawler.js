const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs/promises');
const HashShelf = require('./shelf');
const UrlMap = require('./url-map');
const { removeProtocol, shrinkDomain } = require('./utils');

class Crawler {
  baseUrl = '';
  #urlMap = null;
  browser = null;
  pages = [];
  #dynamicClass = '';
  constructor(baseUrl, dynamicClass) {
    const urlObject = new URL(baseUrl);
    this.baseUrl = urlObject.origin;
    this.#urlMap = new UrlMap(urlObject.pathname);
    this.#dynamicClass = dynamicClass;
  }
  get page() {
    return (this.pages || [])[0];
  }
  set page(value) {
    this.pages.unshift(value);
  }
  get validPaths() {
    return this.#urlMap.validPaths;
  }
  get pathsWithStatus() {
    return this.#urlMap.pathsWithStatus;
  }

  async startCrawling(url = this.baseUrl) {
    try {
      if (!this.browser) await this.#startBrowser();
      await HashShelf.initialize();
      await this.#crawl(new URL(url));
      await this.#closeBrowser();
    } catch (err) {
      console.log(err);
    }
  }
  async #getAllPageLinks() {
    return this.page.evaluate(() =>
      Array.from(document.querySelectorAll('a'), (element) => element.href)
    );
  }
  #isRedirect(url) {
    return shrinkDomain(this.page.url()) !== shrinkDomain(url);
  }
  #wasURLVisited(url) {
    return this.#urlMap.wasVisited(new URL(url).pathname);
  }
  #isValidHostname(url) {
    return shrinkDomain(url).match(
      new RegExp(`^${shrinkDomain(this.baseUrl)}.*`)
    );
  }

  async #validateUrl({ url, pathname }) {
    if (this.#isRedirect(url)) {
      this.#urlMap.unmarkForMapping(pathname);
      if (this.#wasURLVisited(url)) return false;
    }
    return true;
  }
  async #checkForModifications({ url, pathname }) {
    if (HashShelf.isKeyModified(url, await this.#getCurrentPageContent())) {
      console.log(`${url} WAS MODIFIED.`);
      console.log('---------------------');
      this.#urlMap.markAsModified(pathname);
    }
    await HashShelf.set(url, await this.#getCurrentPageContent());
  }
  async #getCurrentPageContent() {
    return await this.page.evaluate((dynamicClass) => {
      document.querySelector(dynamicClass)?.remove();
      return document.querySelector('*').innerHTML;
    }, this.#dynamicClass);
  }
  async #processNewUrls() {
    for (const urlPath of this.#urlMap.pathsToVisit) {
      // console.log(urlPath);
      const newUrl = new URL(urlPath, this.baseUrl);
      console.log(newUrl.href);
      await this.#crawl(newUrl);
    }
  }
  #updateMaps(link) {
    if (!this.#isValidHostname(link)) return;
    if (this.#urlMap.isMarkedForVisit(new URL(link).pathname)) return;
    this.#urlMap.addNewUrl(link);
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
      await this.#loadPage(url);
      if (!(await this.#validateUrl({ url, pathname }))) return;
      const links = await this.#getAllPageLinks();
      await this.#checkForModifications({ url, pathname });
      this.#urlMap.markAsVisited(pathname);

      // const pageCnt = await this.#getCurrentPageContent();
      // await HashShelf.compareContents(url, pageCnt);
      // await HashShelf.writeContent(url, pageCnt);

      links.forEach((link) => this.#updateMaps(link));
      await this.#processNewUrls();
    } catch (err) {
      console.log('Error in crawl: ', err);
    }
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
  async #closeBrowser() {
    try {
      console.log('Closing the browser......');
      await this.browser.close();
    } catch (err) {
      console.log('Could not close the browser instance => : ', err);
    }
  }

  async #reload() {
    this.page.goto(this.page.url(), { waitUntil: 'load' });
    await this.waitTillHTMLRendered();
  }

  async waitTillHTMLRendered(timeout = 30000) {
    const checkDurationMsecs = 10;
    const maxChecks = timeout / checkDurationMsecs;
    let lastHTMLSize = 0;
    let checkCounts = 1;
    let countStableSizeIterations = 0;
    const minStableSizeIterations = 30;
    while (checkCounts++ <= maxChecks) {
      let html = await this.page.content();
      let currentHTMLSize = html.length;
      if (lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize)
        countStableSizeIterations++;
      else countStableSizeIterations = 0; //reset the counter

      if (countStableSizeIterations >= minStableSizeIterations) {
        // console.log("Page rendered fully..");
        break;
      }
      lastHTMLSize = currentHTMLSize;
      await this.page.waitForTimeout(checkDurationMsecs);
    }
  }

  async #loadPage(url) {
    await this.page.goto(url, { waitUntil: 'networkidle0' });
    // await this.page.waitForNavigation({ waitUntil: "networkidle0" });
    await this.waitTillHTMLRendered();
  }
}

module.exports = Crawler;
