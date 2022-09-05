const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs/promises');
const HashShelf = require('./shelf');
const UrlMap = require('./url-map');
const { removeProtocol, shrinkDomain } = require('./utils');

class Crawler {
  baseUrl = '';
  #urlMap = null;
  #browser = null;
  pages = [];
  pageMap = new Map();
  pendingPages = [];
  loadedPages = [];
  #dynamicClass = '';
  #nextPageClass = '';
  constructor(baseUrl, dynamicClass, nextPageClass) {
    const urlObject = new URL(baseUrl);
    this.baseUrl = urlObject.origin;
    this.#urlMap = new UrlMap(urlObject.pathname);
    this.#dynamicClass = dynamicClass;
    this.#nextPageClass = nextPageClass;
  }
  page(url) {
    return this.pageMap.get(url);
  }
  setPage(url, page) {
    if (!this.pageMap.has(url)) this.pendingPages.push(page);
    this.pageMap.set(url, page);
  }
  removePage(url) {
    this.pageMap.delete(url);
    this.pendingPages.pop();
  }
  get validPaths() {
    return this.#urlMap.validPaths;
  }
  get pathsWithStatus() {
    return this.#urlMap.pathsWithStatus;
  }

  async startCrawling(url = this.baseUrl) {
    try {
      if (!this.#browser) await this.#startBrowser();
      await HashShelf.initialize();
      const { href, pathname } = new URL(url);
      this.#urlMap.addNewUrl(href);
      this.#urlMap.markAsVisited(pathname);
      await this.#loadPage(new URL(url).href);
      await this.resolveAllPages();
      console.log(this.#urlMap.numOfUrls);
      await this.#closeBrowser();
    } catch (err) {
      console.log(err);
    }
  }
  async #clickOnNextPage(url) {
    return await this.page(url).evaluate(async (nextPageClass) => {
      const pageElements = Array.from(document.querySelectorAll(nextPageClass));
      const el = pageElements.pop();
      await el?.click();
      el?.remove();
      return el?.innerHTML;
    }, this.#nextPageClass);
  }
  async #getAvailablePageLinks(url) {
    return await this.page(url).evaluate(() =>
      Array.from(document.querySelectorAll('a'), (element) => element.href)
    );
  }
  async #getAllPageLinks(url) {
    const directLinks = await this.#getAvailablePageLinks(url);
    while (await this.#clickOnNextPage(url)) {
      const newLinks = await this.#getAvailablePageLinks(url);
      newLinks.forEach((link) => {
        if (directLinks.indexOf(link) === -1) directLinks.push(link);
      });
    }
    return directLinks;
  }
  #isRedirect(url) {
    return shrinkDomain(this.page(url).url()) !== shrinkDomain(url);
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
    if (HashShelf.isKeyModified(url, await this.#getCurrentPageContent(url))) {
      console.log(`${url} WAS MODIFIED.`);
      console.log('---------------------');
      this.#urlMap.markAsModified(pathname);
    }
    const content = await this.#getCurrentPageContent(url);
    await HashShelf.compareContents(url, content);
    await HashShelf.set(url, await this.#getCurrentPageContent(url));
  }
  async #getCurrentPageContent(url) {
    return await this.page(url).evaluate((dynamicClass) => {
      document.querySelector(dynamicClass)?.remove();
      return document.querySelector('*').innerHTML;
    }, this.#dynamicClass);
  }
  async #processNewUrls() {
    for (const urlPath of this.#urlMap.pathsToVisit) {
      const newUrl = new URL(urlPath, this.baseUrl);
      this.#urlMap.markAsVisited(urlPath);
      await this.#loadPage(newUrl.href);
    }
  }
  #updateMaps(link) {
    if (!this.#isValidHostname(link)) return;
    if (this.#urlMap.isMarkedForVisit(new URL(link).pathname)) return;
    this.#urlMap.addNewUrl(link);
  }
  async processPage({ href: url, pathname }) {
    if (!(await this.#validateUrl({ url, pathname }))) return;
    console.log(url);
    const links = await this.#getAllPageLinks(url);
    await this.#checkForModifications({ url, pathname });
    links.forEach((link) => this.#updateMaps(link));
    await this.#processNewUrls();
  }
  async resolveAllPages() {
    return new Promise((resolve, reject) => {
      try {
        const intervalId = setInterval(() => {
          if (!this.pendingPages.length && this.#urlMap.isBufferEmpty) {
            clearInterval(intervalId);
            resolve();
          }
        }, 500);
      } catch (err) {
        reject(err);
      }
    });
  }
  async #startBrowser() {
    try {
      console.log('Opening the browser......');
      this.#browser = await puppeteer.launch({
        headless: true,
        args: ['--disable-setuid-sandbox'],
        ignoreHTTPSErrors: true,
      });
    } catch (err) {
      console.log('Could not create a browser instance => : ', err);
    }
    const page = await this.#browser.newPage();
  }
  async #closeBrowser() {
    try {
      console.log('Closing the browser......');
      await this.#browser.close();
    } catch (err) {
      console.log('Could not close the browser instance => : ', err);
    }
  }

  async waitTillHTMLRendered(url, timeout = 30000) {
    const checkDurationMsecs = 600;
    const maxChecks = timeout / checkDurationMsecs;
    let lastHTML = '';
    let checkCounts = 1;
    let countStableSizeIterations = 0;
    const minStableSizeIterations = 4;
    while (checkCounts++ <= maxChecks) {
      let html = await this.page(url).content();
      let currentHTML = html;
      if (lastHTML && currentHTML == lastHTML) countStableSizeIterations++;
      else countStableSizeIterations = 0;
      if (countStableSizeIterations >= minStableSizeIterations) break;
      lastHTML = currentHTML;
      await this.page(url).waitForTimeout(checkDurationMsecs);
    }
  }

  async #loadPage(url) {
    const newPage = await this.#browser.newPage();
    await newPage.setDefaultNavigationTimeout(0);
    this.setPage(url, newPage);

    await newPage.goto(url);
    (async () => {
      await newPage.waitForNetworkIdle({ idleTime: 0 });
      await this.waitTillHTMLRendered(url);
      await this.processPage(new URL(url));
      await newPage.close();
      this.removePage(url);
    })();
  }

  async waitForNetworkIdle(page, timeout, maxInflightRequests = 0) {
    page.on('request', onRequestStarted);
    page.on('requestfinished', onRequestFinished);
    page.on('requestfailed', onRequestFinished);

    let inflight = 0;
    let fulfill;
    let promise = new Promise((x) => (fulfill = x));
    let timeoutId = setTimeout(onTimeoutDone, timeout);
    return promise;

    function onTimeoutDone() {
      page.removeListener('request', onRequestStarted);
      page.removeListener('requestfinished', onRequestFinished);
      page.removeListener('requestfailed', onRequestFinished);
      fulfill();
    }

    function onRequestStarted() {
      ++inflight;
      if (inflight > maxInflightRequests) clearTimeout(timeoutId);
    }

    function onRequestFinished() {
      if (inflight === 0) return;
      --inflight;
      if (inflight === maxInflightRequests)
        timeoutId = setTimeout(onTimeoutDone, timeout);
    }
  }
}

module.exports = Crawler;
