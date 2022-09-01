const { Command, program } = require("commander");
const Crawler = require("./crawler");

program.option("-f, --file-name <value>", "name of generated xml file");
program.option("-p, --path <value>", "path to the generated xml file");
program.parse();
const options = program.opts();
const { fileName, path } = options;
try {
    if (!program.args.length)
        throw new Error("You need to pass url as argument");
    const url = program.args[0];
    console.log(options);
    const crawler = new Crawler(url, path, fileName);
    crawler.startCrawling();
} catch (err) {
    console.log(err);
}
