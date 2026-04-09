const fs = require('fs');
const parse = require('url').parse;
const path = require('path');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const readline = require('readline');
const Crawler = require('simplecrawler');
const root = process.cwd();
const noop = () => { };

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
  const outputPath = path.resolve(root, output);

  // Safety check: ensure outputPath is not the current working directory
  if (path.resolve(outputPath) === path.resolve(root)) {
    throw new Error(`Error: Output path cannot be the current working directory. Please specify a subdirectory like "./output" or an absolute path.`);
  }

  // Safety check: ensure outputPath is within or adjacent to root, not outside it
  // This prevents accidental deletion of parent directories
  const relativeFromRoot = path.relative(root, outputPath);
  if (relativeFromRoot.startsWith('..')) {
    throw new Error(`Error: Output path cannot be outside the working directory. Please use a path relative to the current directory.`);
  }

  return new Promise((resolve, reject) => {
    // Check if output directory exists and has files
    fs.stat(outputPath, (statError) => {
      if (statError && statError.code === 'ENOENT') {
        // Directory doesn't exist, proceed with crawl
        resolve(crawl(url, outputPath));
      } else if (!statError) {
        // Directory exists, prompt user before deleting
        fs.readdir(outputPath, (readError, files) => {
          if (readError) {
            return reject(readError);
          }

          if (files.length === 0) {
            // Directory is empty, proceed with deletion
            rimraf(outputPath, (error) => {
              if (error) {
                return reject(error);
              }
              resolve(crawl(url, outputPath));
            });
          } else {
            // Directory has files, ask user for confirmation
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });

            rl.question(`Found ${files.length} file(s) in "${outputPath}". Delete them? (yes/no) `, (answer) => {
              rl.close();

              if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
                rimraf(outputPath, (error) => {
                  if (error) {
                    return reject(error);
                  }
                  resolve(crawl(url, outputPath));
                });
              } else {
                reject(new Error('User cancelled deletion of existing files.'));
              }
            });
          }
        });
      } else {
        reject(statError);
      }
    });
  });
}

function crawl(url, outputPath) {
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
      // outputPath is now the full absolute path

      // Get directory name in order to create any nested dirs
      const dirname = outputPath + parsed.pathname.replace(/\/[^\/]+$/, '');

      // Path to save file
      const filepath = outputPath + parsed.pathname;

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
