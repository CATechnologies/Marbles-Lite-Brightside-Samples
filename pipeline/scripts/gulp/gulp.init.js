/**
 * This file represents the gulp task to initialize all of the underlying source environments.
 * Currently this just does an npm install in:
 *
 * ./webserver/src/main/client/
 * ./webserver/src/main/cucumber/
 *
 * @file
 */
const common = require('../common/common');
const gulp = common.gulp;

const {generatePluginError} = common;
const {getFlag} = require('../common/flags');
const {logResultRC} = require('../common/utils');
const {executeNpmCommand} = require('../common/terminal');

const error = generatePluginError('init');

gulp.task('init', 'Initialize the source environments', [], () => {
  // If the only flag is set then the default for non-passed flags becomes false instead of true
  const flagDefault = !getFlag(['only']);

  if (getFlag(['client'], flagDefault)) {
    console.log('Executing npm install for client');

    if(!logResultRC('Client Install', executeNpmCommand(['install'], 'webserver/src/main/client'))) {
      throw error('Client Install Failed');
    }
  }

  if (getFlag(['cucumber'], flagDefault)) {
    console.log('Executing npm install for cucumber');

    if(!logResultRC('Cucumber Install', executeNpmCommand(['install'], 'webserver/src/main/cucumber'))) {
      throw error('Cucumber Install Failed');
    }
  }
}, {
  options: {
    client  : 'Initialize the client source environment. Default: true',
    cucumber: 'Initialize the cucumber source environment. Default: true',
    only    : 'Specifies that we should only set up the environments passed by flags.'
  }
});
