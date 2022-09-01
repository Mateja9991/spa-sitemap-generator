#! /usr/bin/env node
const { Command, program } = require('commander');
const Crawler = require('./crawler');
const SitemapGenerator = require('./sitemap-generator');

program.option('-f, --file-name <value>', 'name of generated xml file');
program.option('-p, --path <value>', 'path to the generated xml file');
program.parse();
const options = program.opts();
const { fileName, path } = options;
const generateSitemapXML = async (url, path, fileName) => {
  const crawler = new Crawler(url, path, fileName);
  await crawler.startCrawling(url);
  const mapper = new SitemapGenerator(
    await crawler.getUrlsToMap(),
    path,
    fileName
  );
  await mapper.generateSitemapXML();
};
try {
  if (!program.args.length) throw new Error('You need to pass url as argument');
  const url = program.args[0];
  generateSitemapXML(url, path, fileName);
} catch (err) {
  console.log(err);
}
