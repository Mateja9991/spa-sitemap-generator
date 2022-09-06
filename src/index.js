#! /usr/bin/env node
const { program } = require('commander');
const Crawler = require('./crawler');
const HashShelf = require('./shelf');
const SitemapGenerator = require('./sitemap-generator');
const { rebasePaths } = require('./utils');

program.option('-f, --file-name <value>', 'name of generated xml file');
program.option('--path <value>', 'path to the generated xml file');
program.option('-s --snapshots <value>', 'name of snapshots file');
program.option('-b, --base-url <value>', 'base url if used locally');
program.option('-r, --react', 'react app');
program.option(
  '-d, --dynamic-class <value>',
  'dynamic content class to be removed.'
);
program.option('-p, --pagination-class <value>', 'class used for pagination.');
program.parse();
const options = program.opts();
const {
  fileName,
  path,
  baseUrl,
  dynamicClass,
  paginationClass,
  snapshots: snapshotFileName,
  react: isReactApp,
} = options;
const toCssClass = (cssClass) => cssClass && `.${cssClass.replace(/^\./)}`;
const generateSitemapXML = async (url, path, fileName) => {
  if (snapshotFileName) HashShelf.setPath(snapshotFileName);
  const crawler = new Crawler(
    url,
    toCssClass(dynamicClass) || '.recomended-cards',
    toCssClass(paginationClass) || '.kasta-page-selector__steps__step',
    isReactApp ? '#root' : 'body'
  );
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
  if (!program.args.length) throw new Error('You need to pass url as argument');
  const url = program.args[0];
  generateSitemapXML(url, path, fileName);
} catch (err) {
  console.log(err);
}
