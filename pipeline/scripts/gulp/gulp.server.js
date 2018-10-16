/**
 * Gulp tasks that deal with the webserver gradle build
 */

const {executeGradleScript} = require('../common/terminal');

const common = require('../common/common');
const {isUndefined, isFalsy} = require('../common/utils');
const gulp = common.gulp;
const ftpUtils = require('../common/ftp-utils');
const provisioning = require('../common/brightside/provisioning');
const path = require('path');
const gutil = require('gulp-util');
const colors = gutil.colors;
const gulpError = common.generatePluginError('server');

const props = common.loadConfigProperties();
const flags = require('../common/flags');

/**
 * The local WAR file.
 * @type {string}
 */
const warSrc = path.normalize('./webserver/build/libs/MarblesLite.war');

/**
 * The destination of the WAR file under the server directory.
 * @type {string}
 */
const warDest = path.posix.normalize('dropins/MarblesLite.war');

/**
 * The destination of the WAR file under the server directory.
 * @type {string}
 */
const configDest = path.posix.normalize('resources/config/MarblesLite.yaml');

gulp.task('server', 'Tasks that build and deploy the WAR file.', [], async() => {
  const argv = flags.get();

  if (isUndefined(argv.build)) {
    argv.build = argv.deploy;
  }

  // If everything is falsy, no task can be executed.
  if (isFalsy(argv.build, argv.deploy)) {
    throw gulpError(`At least one of ${colors.cyan.bold('--build')} or ${colors.cyan.bold('--deploy')} must be set`);
  }

  if (argv.build) {
    const gradleTask = 'buildWar';
    const configFile = flags.getFlag(['config-file', 'cf'], 'conf-deploy');

    console.log('Executing ' + colors.cyan(`gradle ${gradleTask}`) + ' task');

    const rc = executeGradleScript([gradleTask, `-PconfigFileName=${configFile}`]);

    if (rc !== 0) {
      throw gulpError('Gradle task exited with non-zero return code: ' + colors.yellow.bold(rc));
    }
  }

  if (argv.deploy) {
    const success = await deploy();
    if (!success) {
      throw gulpError('Server deploy failed.');
    }
  }

  console.log();
  gutil.log(colors.green.bold('SUCCESS'));
}, {
  options: {
    build                 : 'Build the application war file',
    deploy                : 'Build and deploy the war file',
    'no-build'            : '--deploy will not build a war file but will assume one already exists.',
    'config-file <string>': 'Specify which config file to use for the server. Default: conf-deploy. [Aliases: --cf]'
  }
});

/**
 * This function deploys the war file to the provisioned WAS
 * @returns {Promise<boolean>} Resolves to true when deployment is successful. False if not.
 */
function deploy() {
  return new Promise(async resolve => {
    const argv = flags.get();

    console.log('Deploying the WAR to WAS');
    const configFile = flags.getFlag(['config-file', 'cf'], 'conf-deploy');
    const ev = provisioning.getInstanceDetails(props.was.instanceName);
    const uploadRoot = path.posix.join(ev.WLP_USER_DIR, 'servers', ev.JOB_NAME);

    if (argv.verbose) {
      console.log('Upload root: ', colors.magenta.bold(uploadRoot));
    }

    let success = await ftpUtils.ftpFiles([
      {
        source     : path.normalize(`./webserver/src/main/resources/${configFile}.yaml`),
        destination: path.posix.join(uploadRoot, configDest)
      },
      {
        source     : warSrc,
        destination: path.posix.join(uploadRoot, warDest)
      }
    ]);

    if (success) {
      console.log('Stopping WAS');
      success = isSuccessful(provisioning.executeAction(props.was.instanceName, 'stop'));
    }

    if (success) {
      console.log('Starting WAS');
      success = isSuccessful(provisioning.executeAction(props.was.instanceName, 'start'));
    }

    if (success) {
      console.log();
      gutil.log(colors.green('Server Deployed:'));
      gutil.log(colors.cyan.bold(`  http://${props.system.host}:${ev.HTTP_PORT}/MarblesLite`));
      gutil.log('  The server may not be available immediately. Please be patient');
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

/**
 * Log if a boolean is truthful. True means success false means fail.
 * @param {boolean} success The boolean representing pass or fail.
 * @returns {boolean} The boolean passed into the function so methods can be chained.
 */
function isSuccessful(success) {
  if(success) {
    console.log(colors.green.bold('SUCCESS'));
  } else {
    console.error(colors.red.bold('FAIL'));
  }

  return success;
}

