/**
 * This file represents the npm run global-install functionality.
 *
 * This script can accept 1 flag:
 *
 * --brightside true|false (--no-brightside)
 * Turn off the install of BrightSide to speed things up when it isn't needed.
 *
 * @file
 */
const bintray = 'https://api.bintray.com/npm/ca/brightside/';
// const brightVersion = 'next';
const gulpVersion = '1.4.0';
const hasCorrect = {
  registry     : false,
  brightside   : false,
  pluginDb2    : false,
  pluginEndevor: false,
  pluginCICS   : false,
  gulp         : false
};

const {executeNpmCommand} = require('../common/terminal');

const exec = require('child_process').execSync;

const argv = require('../common/flags').get();
const {isDefined} = require('../common/utils');

console.log('Install Started');
console.log('Checking global versions');

let result;

// Check NPM registry for brightside
try {
  result = exec('npm config get @brightside:registry');
} catch (e) {
  result = 'undefined';
}
hasCorrect.registry = result.indexOf(bintray) >= 0;

try {
  result = exec('npm list -g gulp-cli brightside --depth=0');
} catch (e) {
  // Because apparently when they all don't exist, npm throws a f**king error.
  result = '';
}

// Allows the --brightside flag to be defaulted to true.
const installBrightside = isDefined(argv.brightside) ? argv.brightside : true;

hasCorrect.brightside = result.indexOf(`@brightside/core`) >= 0;
hasCorrect.gulp = result.indexOf(`gulp-cli@${gulpVersion}`) >= 0;

console.log();

if (hasCorrect.registry) {
  console.log(`\nSetting up registry...already done`);
} else if (installBrightside) {
  console.log(`\nSetting up registry...`);
  executeNpmCommand([
    'config',
    'set',
    '@brightside:registry',
    bintray
  ]);
} else {
  console.log('Skipping registry setup');
}

/*
if (hasCorrect.brightside) {
  console.log(`\nInstalling @brightside/core@${brightVersion}...already exists`);
} else if (installBrightside) {
  console.log(`\nInstalling @brightside/core@${brightVersion}...`);
  executeNpmCommand([
    'install',
    '-g',
    `@brightside/core@${brightVersion}`,
    '--unsafe-perm'
  ]);
} else {
  console.log('Skipping Brightside install');
}
*/
// At this step CA Brightside should be installed.
// Check for plugins
try {
  result = exec('bright plugins list');
} catch (e) {
  result = '';
}
// Check installed plugins
hasCorrect.pluginCICS = result.indexOf('pluginName: @brightside/cics') >= 0;
hasCorrect.pluginDb2 = result.indexOf('pluginName: @brightside/db2') >= 0;
hasCorrect.pluginEndevor = result.indexOf('pluginName: @brightside/endevor') >= 0;

// Install plugins if needed

if (hasCorrect.pluginCICS) {
  console.log(`\nInstalling @brightside/cics plugin...already exists`);
} else if (installBrightside) {
  console.log(`\nInstalling @brightside/cics plugin...`);
  exec('bright plugins install @brightside/cics');
} else {
  console.log('Skipping CICS plugin install');
}


if (hasCorrect.pluginDb2) {
  console.log(`\nInstalling @brightside/db2 plugin...already exists`);
} else if (installBrightside) {
  console.log(`\nInstalling @brightside/db2 plugin...`);
  exec('bright plugins install @brightside/db2');
} else {
  console.log('Skipping DB2 plugin install');
}

if (hasCorrect.pluginEndevor) {
  console.log(`\nInstalling @brightside/endevor plugin...already exists`);
} else if (installBrightside) {
  console.log(`\nInstalling @brightside/endevor plugin...`);
  exec('bright plugins install @brightside/endevor');
} else {
  console.log('Skipping Endevor plugin install');
}

if (hasCorrect.gulp) {
  console.log(`\nInstalling gulp-cli@${gulpVersion}...already exists`);
} else {
  console.log(`\nInstalling gulp-cli@${gulpVersion}`);
  executeNpmCommand([
    'install',
    '-g',
    `gulp-cli@${gulpVersion}`
  ]);
}

console.log('\nInstall Completed');
