const TRAVIS_BRANCH_OR_TAG = process.argv[2];
const GH_TOKEN = process.argv[3];
const OWNER = process.argv[4];
const REPO = process.argv[5];
const TOKEN = '?access_token=' + GH_TOKEN;

let HttpWrapper = require('./http-wrapper.js');
let http = new HttpWrapper();
let date = Date.now();

class GithubReleaseCreator {
  
  getReleaseData() {
    return JSON.stringify({
      tag_name: 'release-' + TRAVIS_BRANCH_OR_TAG + '-' + date,
      target_commitish: TRAVIS_BRANCH_OR_TAG
    });
  }
  
  uploadReleaseZip(id) {

    console.log('Uploading release...')

    http.makeFileUploadRequest(
      './release.tar.gz',
      'https://uploads.github.com/repos/' + OWNER + '/' + REPO + '/releases/' + id + '/assets' + TOKEN + '&name=release.tar.gz'
    ).then(res => {

      console.log(res.body);
      console.log('Release successfully uploaded...')
      process.exit(0);

    }, error => {

      console.log(error);
      process.exit(1);

    });
  }
  
  createRelease() {

    http.makePostRequest(
      'https://api.github.com/repos/' + OWNER + '/' + REPO + '/releases' + TOKEN,
      this.getReleaseData()
    ).then(res => {

      console.log(res.body);
      this.uploadReleaseZip(JSON.parse(res.body).id);
  
    });
  }

}

let creator = new GithubReleaseCreator();
creator.createRelease()
