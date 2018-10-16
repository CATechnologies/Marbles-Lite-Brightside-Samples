/**
 * Creates the cucumber config file and sets some of the options.
 * @file
 */

const flags = require('../../common/flags');
const path = require('path');
const {getProjectRoot} = require('../../common/utils');
const colors = require('gulp-util').colors;
const jsonfile = require('jsonfile');

// Get the url flag
const url = flags.getFlag(['url'], '');
const width = flags.getFlag(['width'], 1920);
const height = flags.getFlag(['height'], 1080);

if (url.length > 0) {
  const configLocation = path.join(getProjectRoot(), 'webserver/src/main/cucumber/features/support');
  const config = jsonfile.readFileSync(path.join(configLocation, 'config-sample.json'));

  config.url = url;
  config.size.width = width;
  config.size.height = height;

  jsonfile.writeFileSync(path.join(configLocation, 'config.json'), config);
} else {
  console.error(colors.red.bold('Missing the --url flag'));

  // Exit with code 1 to indicate that you are missing the url flag
  process.exitCode = 1;
}

