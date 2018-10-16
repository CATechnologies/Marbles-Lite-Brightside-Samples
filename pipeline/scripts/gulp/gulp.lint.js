const {logResultBoolean, logResultRC, getProjectRoot} = require('../common/utils');
const {executeGradleScript, executeNpmCommand} = require('../common/terminal');

const common = require('../common/common');
const error = common.generatePluginError('lint');
const gulp = common.gulp;
const colors = require('gulp-util').colors;
const path = require('path');
const eslint = require('gulp-eslint');
const eslintIfFixed = require('gulp-eslint-if-fixed');
const flags = require('../common/flags');

gulp.task('lint', 'Lints the scripting files used by gulp tasks.', async() => {
  // Get all the global task flags first.
  // Client, Gulp, and Server flags will be true if all were not passed
  const verbose = flags.getFlag(['verbose']);
  const {clientAlias, gulpAlias, serverAlias} = {
    clientAlias: ['client', 'c'],
    gulpAlias  : ['gulp', 'g'],
    serverAlias: ['server', 's']
  };

  const doesRunAllByDefault = flags.areFlagsMissing.apply(null, [].concat(clientAlias, gulpAlias, serverAlias));
  const {client, gulpFlag, server} = {
    client  : flags.getFlag(clientAlias, doesRunAllByDefault),
    gulpFlag: flags.getFlag(gulpAlias, doesRunAllByDefault),
    server  : flags.getFlag(serverAlias, doesRunAllByDefault)
  };

  let passed = true;

  // Lint the gulp file
  if (gulpFlag) {
    passed = await new Promise(resolve => {
      let files = ['gulpfile.js', './scripts/**/*.js'];
      const file = flags.getFlag(['file'], '');

      // Fix the files if the fix flag was present
      const lintOptions = {
        fix: flags.getFlag(['fix'])
      };

      if (file.length > 0) {
        files = path.join('./', file);
      }

      if (verbose) {
        console.log(`File: ${colors.cyan(files)}`);
      }

      // Define a gulp processor that runs asynchronously when executing eslint
      gulp.src(files, {base: './'})
        .pipe(eslint(lintOptions))
        .pipe(eslint.format())
        .pipe(eslintIfFixed('./'))
        .pipe(eslint.results(results => {
          // Output the results of which files were fixed.
          if (lintOptions.fix) {
            let wasAFileFixed = false;

            console.group('Files Fixed:');

            // Loop through each result and check to see if the fixed flag is true.
            for (const result of results) {
              if (result.fixed) {
                wasAFileFixed = true;
                console.log(colors.magenta.bold(path.relative(getProjectRoot(), result.filePath)));
              }
            }

            if (!wasAFileFixed) {
              console.log(colors.yellow.bold('NONE'));
            }
            console.groupEnd();
            console.log();
          }

          if (verbose) {
            console.group('Stats');
            console.log(`${colors.yellow.bold('Warnings:')} ${results.warningCount}`);
            console.log(`${colors.red.bold('Errors  :')} ${results.errorCount}`);
            console.log();
            console.groupEnd();
          }

          if (results.errorCount > 0) {
            resolve(false);
          } else {
            resolve(true);
          }
        }))
        .pipe(eslint.failAfterError());
    });

    logResultBoolean('Gulp Linting', passed);
  }

  // Lint the server
  if (server && passed) {
    passed = logResultRC('Server Linting', executeGradleScript(['checkstyleMain', 'checkstyleTest']));
  }

  if (client && passed) {
    passed = logResultRC('Client Linting', executeNpmCommand(['run', 'lint'], 'webserver/src/main/client'));
  }

  if (!passed) {
    throw error('Linting Failed');
  }
}, {
  options: {
    client         : 'Indicates that the client code should be linted. [Aliases: -c]',
    server         : 'Indicates that the server code should be linted. [Aliases: -s]',
    gulp           : 'Indicates that the gulp script should be linted. [Aliases: -g]',
    'file <string>': 'Indicates the file path to run through the linter. Only use in conjunction with --gulp',
    fix            : 'Attepmt to fix linting errors automatically. Only use in conjunction with --gulp'
  }
});
