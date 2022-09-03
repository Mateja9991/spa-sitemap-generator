#! /usr/bin/env node
const { program } = require("commander");
const Crawler = require("./crawler");
const SitemapGenerator = require("./sitemap-generator");
const { rebasePaths } = require("./utils");

program.option("-f, --file-name <value>", "name of generated xml file");
program.option("-p, --path <value>", "path to the generated xml file");
program.option("-b, --base-url <value>", "base url if used locally");
program.parse();
const options = program.opts();
const { fileName, path, baseUrl } = options;

const generateSitemapXML = async (url, path, fileName) => {
  const crawler = new Crawler(url);
  await crawler.startCrawling(url);
  const pathsWithStatus = crawler.pathsWithStatus;
  const urlsToMap = rebasePaths(
    pathsWithStatus,
    baseUrl || new URL(url).origin
  );
  await SitemapGenerator.generateSitemapXML({
    urls: urlsToMap,
    filePath: path,
    fileName,
  });
};
try {
  if (!program.args.length) throw new Error("You need to pass url as argument");
  const url = program.args[0];
  generateSitemapXML(url, path, fileName);
} catch (err) {
  console.log(err);
}
