# Snap

Like `wget -r <url>` but specifically designed to support "pretty" URLs. With `wget`, a URL pointing to `/foo` would result in `/foo.html`, but this means the URL has now changed.

With `snap`, it will create the directory `/foo` and save the file to `/foo/index.html` so that the URL `/foo` still works.

## Installation

Via npm:

```
npm install @remy/snap
```

## Usage



```
$ snap <url> # saves to directory matching the domain
$ snap <url> --output <dir>
$ snap <url> -o <dir> # short hand
```

## Example usage

This is how I'm using `snap` in an Express web site to generate a static copy of the site before deploying to Amazon S3.

The scripts section of my `package.json`:

```
{
  "scripts": {
    "start": "node .",
    "prebuild": "NODE_ENV=production PORT=7331 node . & echo $! > .pid; sleep 1",
    "build": "snap http://localhost:7331 -o www; kill $(cat .pid); rm .pid"
  },
  "devDependencies": {
    "@remy/snap": "^1.0.1"
  }
}
```

## Notes and limitations

- If the output directory already exists, it will be removed first by `snap`
- Crawling is limited to the domain specified
- Speed and interval has been set to run as fast as possible, so this is ideally used with local domains
- There are no other arguments to `snap`, if further customisation is needed, please send a PR or look at using [simplecrawler](https://www.npmjs.com/simplecrawler)
