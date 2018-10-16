/**
 Gulp tasks that deal with the webserver gradle build
 */

const {executeCommand, executeGradleScript, executeNpmCommand} = require('../common/terminal');
const {logResultRC, getProjectRoot} = require('../common/utils');

const shell = require('shelljs');
const fs = require('fs');
const common = require('../common/common');
const path = require('path');
const gulp = common.gulp;
const gutil = require('gulp-util');
const colors = gutil.colors;
const flags = require('../common/flags');
const error = common.generatePluginError('test');
const reporter = require('cucumber-html-reporter');
const cucumberJunit = require('cucumber-junit');
const through = require('through2');
const jsonfile = require('jsonfile');

const cucumberXmlReport = opts => through.obj((file, enc, cb) => {
  // If tests are executed against multiple browsers/devices
  const suffix = file.path.match(/\/cucumber-?(.*)\.json/);
  if (suffix) {
    opts.prefix = suffix[1] + ';';
  }

  const xml = cucumberJunit(file.contents, opts);
  file.contents = new Buffer(xml);
  file.path = gutil.replaceExtension(file.path, '.xml');
  cb(null, file);
});


gulp.task('test', 'Tasks that interact with the webserver/ui code.', [], () => {
  let passed = true;

  // These are the flags that specify the tasks to run
  const {integrationFlags, unitFlags} = {
    integrationFlags: ['integration', 'i'],
    unitFlags       : ['unit', 'u']
  };

  // First checks if the all flag is passed, if so then all test tasks will run.
  const doesDefaultRunAll = flags.getFlag(['all']);

  // If --all was not passed then we need to check if all of the task flags are missing. If they all
  // are then the defaultTask will be configured to run
  const doesDefaultTaskRun = doesDefaultRunAll ||
    flags.areFlagsMissing.apply(null, [].concat(integrationFlags, unitFlags));


  // Set the 3 flags accordingly
  const {integration, unit} = {
    integration: flags.getFlag(integrationFlags, doesDefaultRunAll),
    unit       : flags.getFlag(unitFlags, doesDefaultTaskRun)
  };

  /* Run the unit tests */
  if (unit) {
    // Run server unit tests if the run-server flag is true (default)
    if (flags.getFlag(['run-server'], true)) {
      const gradleTask = 'test';

      console.log('Executing ' + colors.cyan(`gradle ${gradleTask}`) + ' task');
      passed = logResultRC('Server Unit Test', executeGradleScript([gradleTask]));
    }

    // Run client unit tests if the run-client flag is true (default)
    if (passed && flags.getFlag(['run-client'], true)) {
      passed = logResultRC(
        'Client Unit Test',
        executeNpmCommand(['run', 'test-coverage-singlerun'], 'webserver/src/main/client')
      );
    }
  }

  /* Run the automated integration test(s) */
  if (integration && passed) {
    // Check if tag specification has been provided.
    // These are defined in the 'cucumber\package.json' file under 'scripts'
    const cucumberTask = path.join('.', 'node_modules', '.bin', 'cucumber-js');

    // Remove previous reports
    shell.rm('-fR', path.join(getProjectRoot(), 'webserver/build/reports/cucumber'));

    // Make the directory where the reports go
    shell.mkdir('-p', path.join(getProjectRoot(), 'webserver', 'build', 'reports', 'cucumber'));
    shell.mkdir('-p', path.join(getProjectRoot(), 'webserver/build/reports/cucumber/screenshots'));

    const configLocation = path.join(getProjectRoot(), 'webserver/src/main/cucumber/features/support/config.json');
    const config = jsonfile.readFileSync(configLocation);


    // Set the proper screenshot path
    config.screenshots = path.join(getProjectRoot(), 'webserver/build/reports/cucumber/screenshots');

    jsonfile.writeFileSync(configLocation, config, {spaces: 2});

    const args = ['--format', 'json:../../../build/reports/cucumber/report.json'];
    const tag = flags.getFlag(['tag'], '');

    if (tag.length > 0) {
      console.log(`Sending tag ${colors.cyan.bold(tag)} to cucumber`);
      args.push('--tags');
      args.push(tag);
    }

    passed = logResultRC('Integration Test', executeCommand(
      cucumberTask,
      args,
      {
        cwd: 'webserver/src/main/cucumber'
      }
    ));

    if(fs.existsSync('webserver/build/reports/cucumber/report.json')) {
      reporter.generate({
        theme                 : 'bootstrap',
        jsonFile              : 'webserver/build/reports/cucumber/report.json',
        output                : 'webserver/build/reports/cucumber/report.html',
        reportSuiteAsScenarios: true,
        launchReport          : flags.getFlag(['launch-report'], true)
      });
    } else {
      console.error(colors.yellow('Unable to process cucumber report'));
    }

    if (flags.getFlag(['junit-report'])) {
      gulp.src('webserver/build/reports/cucumber/report.json')
        .pipe(cucumberXmlReport({strict: true}))
        .pipe(gulp.dest('webserver/build/reports/cucumber'));
    }
  }


  console.log();

  if (!passed) {
    throw error('TESTS FAILED');
  }
}, {
  options: {
    all            : 'Run all tests.',
    integration    : 'Run the integration tests. [Aliases: -i]',
    'launch-report': 'Indicate if the html generated report should auto launch. Default: true',
    'junit-report' : 'Specifies that a junit output should also be produced. Default: true',
    unit           : 'Run the unit tests.        [Aliases: -u]',
    'run-client'   : 'Run the client unit tests. Default: true',
    'run-server'   : 'Run the server unit tests. Default: true'
  }
});
