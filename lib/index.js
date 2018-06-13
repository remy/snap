const fs = require('fs');
const parse = require('url').parse;
const path = require('path');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const Crawler = require('simplecrawler');
const root = process.cwd();
const noop = () => {};

module.exports = (args, settings) => {
  let url = args._[0];

  if (url && !url.startsWith('http')) {
    // assume http
    url = `http://${url}`;
  }

  if (!url) {
    throw new Error('snap <url> [--output <dir>]');
  }

  const output = args.output || parse(url).hostname;

  return new Promise((resolve, reject) => {
    rimraf(path.join(root, output), (error) => {
      if (error) {
        return reject(error);
      }

      resolve(crawl(url, output));
    })
  });
}

function crawl(url, output) {
  return new Promise((resolve, reject) => {
    console.error('fetching %s', url);

    const crawler = new Crawler(url);

    if (url.includes('localhost')) {
      crawler.interval = 0;
      crawler.maxConcurrency = 100;
      crawler.respectRobotsTxt = false;
      crawler.stripQuerystring = true;
    }

    // crawler.addDownloadCondition((queueItem, response, callback) => {
    //   callback(null,
    //     queueItem.stateData.contentType.startsWith('text/html')
    //   );
    // });

    crawler.on('fetchclienterror', (queueItem, error) => {
      console.error("Client error, could not fetch %s", queueItem.url);
      throw error;
    });

    crawler.on('fetchcomplete', (queueItem, responseBuffer, response) => {

      // Parse url
      const parsed = parse(queueItem.url);

      // Rename / to index.html
      if (parsed.pathname === '/') {
        parsed.pathname = '/index.html';

      // this ensures that we have .html suffix hidden and directories instead
      } else if (response.headers['content-type'].includes('text/html')) {
        if (parsed.pathname.match(/.html?$/)) {
          // Do nothing as the .html file is directly pointed to.
        } else if (parsed.pathname.match(/\/$/)) {
          // Trailing slash so the link points to a directory.
          parsed.pathname += 'index.html';
        } else {
          // A pretty URL
          parsed.pathname += '/index.html';
        }
      }

      // Where to save downloaded data
      const outputDirectory = path.join(root, output);

      // Get directory name in order to create any nested dirs
      const dirname = outputDirectory + parsed.pathname.replace(/\/[^\/]+$/, '');

      // Path to save file
      const filepath = outputDirectory + parsed.pathname;

      // Check if DIR exists
      fs.exists(dirname, exists => {
        // If DIR exists, write file
        if (exists) {
          fs.writeFile(filepath, responseBuffer, noop);
        } else {
          // Else, recursively create dir using node-fs, then write file
          mkdirp(dirname, () => {
            fs.writeFile(filepath, responseBuffer, noop);
          });
        }
      });

      console.error('%s (%s %d bytes)', queueItem.url, response.headers['content-type'], responseBuffer.length);
    });

    crawler.start();
  });
}
