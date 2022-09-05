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
  constructor(baseUrl, dynamicClass) {
    const urlObject = new URL(baseUrl);
    this.baseUrl = urlObject.origin;
    this.#urlMap = new UrlMap(urlObject.pathname);
    this.#dynamicClass = dynamicClass;
  }
  // get page() {
  //   return (this.pages || [])[0];
  // }
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
  // set page(value) {
  //   this.pages.unshift(value);
  // }
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
  async #getAllPageLinks(url) {
    return await this.page(url).evaluate(() =>
      Array.from(document.querySelectorAll('a'), (element) => element.href)
    );
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
      await HashShelf.compareContents(
        url,
        await this.#getCurrentPageContent(url)
      );
      // await HashShelf.writeContent(url, await this.#getCurrentPageContent(url));
      this.#urlMap.markAsModified(pathname);
    }
    await HashShelf.set(url, await this.#getCurrentPageContent(url));
  }
  async #getCurrentPageContent(url) {
    return await this.page(url).evaluate((dynamicClass) => {
      document.querySelector(dynamicClass)?.remove();
      return document.querySelector('*');
    }, this.#dynamicClass);
    // const minStableIterations = 50;
    // let iter = 0;
    // let lastContent = "";
    // let content = await this.page(url).content();
    // while (iter <= minStableIterations) {
    //   if (lastContent != "" && lastContent === content) ++iter;
    //   else iter = 0;
    //   lastContent = content;
    //   content = await this.page(url).content();
    // }
    // console.log(content);
    // const body = await this.page(url).evaluate(() => {
    //   return document.querySelector('body').innerHTML;
    // });
    // console.log(body);
    // return body;
  }
  async #processNewUrls() {
    for (const urlPath of this.#urlMap.pathsToVisit) {
      // console.log(urlPath);
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
          if (
            !this.pendingPages.length &&
            this.#urlMap.isBufferEmpty &&
            // false
            true
          ) {
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
        headless: false,
        args: ['--disable-setuid-sandbox'],
        ignoreHTTPSErrors: true,
        defaultViewport: {
          width: 1200,
          height: 900,
          deviceScaleFactor: 1,
        },
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
      else countStableSizeIterations = 0; //reset the counter

      if (countStableSizeIterations >= minStableSizeIterations) {
        // console.log("Page rendered fully..");
        break;
      }
      lastHTML = currentHTML;
      await this.page(url).waitForTimeout(checkDurationMsecs);
    }
  }

  async #loadPage(url) {
    const newPage = await this.#browser.newPage();
    await newPage.setDefaultNavigationTimeout(0);
    this.setPage(url, newPage);
    newPage.on('load', async () => {
      // await this.page(url).waitForNetworkIdle({ idleTime: 0 });
      // await this.waitForNetworkIdle(this.page(url), 500, 0);
      // console.log("pre");
      await this.waitTillHTMLRendered(url);
      // console.log("posle");
      await this.processPage(new URL(url));
      await newPage.close();
      this.removePage(url);
    });
    await newPage.goto(url);
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
