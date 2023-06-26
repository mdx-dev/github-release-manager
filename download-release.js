const BRANCH_OR_TAG = process.argv[2];
const GH_TOKEN = process.argv[3];
const OWNER = process.argv[4];
const REPO = process.argv[5];
const HEADERS = {headers: {'User-Agent': 'request', 'Authorization': `token ${GH_TOKEN}`, 'Accept': 'application/vnd.github.v3+json'}};
let HttpWrapper = require('./http-wrapper.js');
let _ = require('lodash');
const { exec } = require('child_process');
let http = new HttpWrapper();
let date = Date.now();
let fs = require('fs');

const RELEASE_DIR = 'release';
const TAR_FILE = 'release.tar.gz';

class GithubReleaseDownloader {

  downloadRelease() {
    console.log(`GitHub Release Downloader...`);
    console.log(`Repo: "${REPO}"`);
    console.log(`Branch/Tag: "${BRANCH_OR_TAG}"`);

    this.deleteReleaseDir();
    this.deleteTarFile();
    this.getReleases();
  }

  getReleaseData() {
    return JSON.stringify({
      tag_name: `release-${BRANCH_OR_TAG}-${date}`,
      target_commitish: BRANCH_OR_TAG
    });
  }

  getReleases(page = 1) {
    console.log(`Searching for "${BRANCH_OR_TAG}" on page "${page}"...`);

    if (!BRANCH_OR_TAG || !GH_TOKEN || !OWNER || !REPO) {
      console.log(`Error: Missing argument. Required: <branch> <github_token> <owner> <repo>`);
      process.exit(1);
    }

    http.makeGetRequest(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases?page=${page}`,
      HEADERS
    ).then(res => {
      if (!res || !res.body) {
        console.log(`Error: GitHub Release: Unexpected response "${res}"`);
        process.exit(1);
      }

      let resBody = [];
      try {
        resBody = JSON.parse(res.body);
      } catch(e) {
        console.log(`Error: GitHub Release: Failed to parse response JSON. Message: "${e}"`);
        process.exit(1);
      }

      let releasesFound;
      let releaseRegex = new RegExp(`^release-${BRANCH_OR_TAG.replace('.', '\\.')}-\\d+$`);
      if (resBody.length > 0) {
        releasesFound = resBody.filter(release => releaseRegex.test(release.name));
        if (!releasesFound || !releasesFound.length) {
          // Look for release on the next page
          return this.getReleases(page + 1);
        }
      }

      if (!releasesFound) {
        console.log(`Error: No releases found for "${BRANCH_OR_TAG}"`);
        process.exit(1);
      }

      const releasesSorted = _.sortBy(releasesFound, release => release.created_at);
      const lastRelease = releasesSorted[ releasesSorted.length -1 ];

      console.log('Using asset id: ' + lastRelease.assets[0].id);
      console.log('Release created at: ' + lastRelease.created_at);

      return this.download(lastRelease.assets[0].id)
        .then(() => this.makeReleaseDir())
        .then(() => this.unzipRelease())
        .then(() => {
          console.log(`Success: GitHub release "${lastRelease.name}" downloaded!`);
          process.exit(0);
        });
    })
    .catch((error) => console.log(`Error: ${error}`));
  }

  download(assetId) {
    console.log('Downloading release...');
    return new Promise(resolve => {
      const command = `curl -s -H "Authorization: token ${GH_TOKEN}" -H "Accept:application/octet-stream" https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${assetId} -w "%{redirect_url}" | xargs curl -so ${TAR_FILE}`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: Download Failed: ${error.message}`);
          resolve();
          process.exit(1);
        }
        if (stderr) {
          console.log(`stderr: Download Failed: ${stderr}`);
          resolve();
          process.exit(1);
        }
        console.log('Download Success.');
        resolve();
      });
    });
  }

  deleteReleaseDir() {
    try {
      fs.rmdirSync(RELEASE_DIR, { recursive: true });
      console.log(`"${RELEASE_DIR}" has been deleted!`);
    } catch (err) { }
  }

  deleteTarFile() {
    try {
      fs.unlinkSync(TAR_FILE);
      console.log(`"${TAR_FILE}" has been deleted!`);
    } catch (err) { }
  }

  makeReleaseDir() {
    console.log(`Making "${RELEASE_DIR}" directory...`);
    return new Promise(resolve => {
      const command = `mkdir ${RELEASE_DIR}`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: Directory Make Failed: ${error.message}`);
          resolve();
          process.exit(1);
        }
        if (stderr) {
          console.log(`stderr: Directory Make Failed: ${stderr}`);
          resolve();
          process.exit(1);
        }
        console.log('Directory Make Success.');
        resolve();
      });
    });
  }

  unzipRelease() {
    console.log('Extracting release...');
    return new Promise(resolve => {
      const command = `tar -zvxf ${TAR_FILE}`;
      exec(command, (error) => {
        if (error) {
          console.log(`error: Extraction Failed: ${error.message}`);
          resolve();
          process.exit(1);
        }
        console.log('Extraction Success.');
        resolve();
      });
    });
  }

}

let downloader = new GithubReleaseDownloader();
downloader.downloadRelease();
