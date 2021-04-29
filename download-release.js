const TRAVIS_BRANCH_OR_TAG = process.argv[2];
const GH_TOKEN = process.argv[3];
const OWNER = process.argv[4];
const REPO = process.argv[5];
const HEADERS = {headers: {'User-Agent': 'request', 'Authorization': `token ${GH_TOKEN}`, 'Accept': 'application/vnd.github.v3+json'}};
let HttpWrapper = require('./http-wrapper.js');
let _ = require('lodash');
const { exec } = require('child_process');
let http = new HttpWrapper();
let date = Date.now();

class GithubReleaseDownloader {

  downloadRelease() {
    this.getReleases();
  }

  getReleaseData() {
    return JSON.stringify({
      tag_name: 'release-' + TRAVIS_BRANCH_OR_TAG + '-' + date,
      target_commitish: TRAVIS_BRANCH_OR_TAG
    });
  }

  getReleases() {
    console.log('GitHub Release Downloader...');

    if (!TRAVIS_BRANCH_OR_TAG || !GH_TOKEN || !OWNER || !REPO) {
      console.log(`Error: Missing argument. Required: <branch> <github_token> <owner> <repo>`);
      return;
    }

    console.log(`Repo: "${REPO}"`);
    console.log(`Branch/Tag: "${TRAVIS_BRANCH_OR_TAG}"`);

    http.makeGetRequest(
      'https://api.github.com/repos/' + OWNER + '/' + REPO + '/releases',
      HEADERS
    ).then(res => {
      if (!res || !res.body) {
        console.log(`Error: GitHub Release: Unexpected response "${res}"`);
        return;
      }

      let resBody = [];
      try {
        resBody = JSON.parse(res.body);
      } catch(e) {
        console.log(`Error: GitHub Release: Failed to parse response JSON. Message: "${e}"`);
        return;
      }

      const releasesFound = resBody.filter(release => release.tag_name.indexOf( 'release-' + TRAVIS_BRANCH_OR_TAG ) > -1);
      if (!releasesFound || !releasesFound.length) {
        console.log(`Error: No releases found for "release-${TRAVIS_BRANCH_OR_TAG}"`);
        return;
      }

      const releasesSorted = _.sortBy(releasesFound, release => release.created_at);
      const lastRelease = releasesSorted[ releasesSorted.length -1 ];

      console.log('Using asset id: ' + lastRelease.assets[0].id);
      console.log('Release created at: ' + lastRelease.created_at);

      return this.download(lastRelease.assets[0].id)
        .then(() => this.makeReleaseDir())
        .then(() => this.unzipRelease())
        .then(() => console.log('Success: GitHub release downloaded!'));
    })
    .catch((error) => console.log(`Error: ${error}`));
  }

  download(assetId) {
    console.log('Downloading release...');
    return new Promise(resolve => {
      const command = `curl -s -H "Authorization: token ${GH_TOKEN}" -H "Accept:application/octet-stream" https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${assetId} -w "%{redirect_url}" | xargs curl -so release.tar.gz`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: Download Failed: ${error.message}`);
          resolve();
          return;
        }
        if (stderr) {
          console.log(`stderr: Download Failed: ${stderr}`);
          resolve();
          return;
        }
        console.log('Download Success.');
        resolve();
      });
    });
  }

  makeReleaseDir() {
    console.log('Making "release" directory...');
    return new Promise(resolve => {
      const command = `mkdir release`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: Directory Make Failed: ${error.message}`);
          resolve();
          return;
        }
        if (stderr) {
          console.log(`stderr: Directory Make Failed: ${stderr}`);
          resolve();
          return;
        }
        console.log('Directory Make Success.');
        resolve();
      });
    });
  }

  unzipRelease() {
    console.log('Extracting release...');
    return new Promise(resolve => {
      const command = `tar -zvxf release.tar.gz`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: Extraction Failed: ${error.message}`);
          resolve();
          return;
        }
        if (stderr) {
          console.log(`stderr: Extraction Failed: ${stderr}`);
          resolve();
          return;
        }
        console.log('Extraction Success.');
        resolve();
      });
    });
  }

}

let downloader = new GithubReleaseDownloader();
downloader.downloadRelease();
