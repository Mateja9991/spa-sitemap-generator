#! /usr/bin/env node
const { program } = require('commander');
const Crawler = require('./crawler');
const SitemapGenerator = require('./sitemap-generator');

program.option('-f, --file-name <value>', 'name of generated xml file');
program.option('-p, --path <value>', 'path to the generated xml file');
program.parse();
const options = program.opts();
const { fileName, path } = options;
const generateSitemapXML = async (url, path, fileName) => {
  const crawler = new Crawler(url);
  await crawler.startCrawling(url);
  await SitemapGenerator.generateSitemapXML(crawler.validUrls, path, fileName);
};
try {
  if (!program.args.length) throw new Error('You need to pass url as argument');
  const url = program.args[0];
  generateSitemapXML(url, path, fileName);
} catch (err) {
  console.log(err);
}
