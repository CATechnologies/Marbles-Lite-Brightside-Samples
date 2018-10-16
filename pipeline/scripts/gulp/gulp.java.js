// build tasks related to java deployed on the mainframe

const cp = require('child_process');
// var ftp = require( 'vinyl-ftp' );
const common = require('../common/common');
const ftpUtils = require('../common/ftp-utils');
const gulp = common.gulp;

const props = common.loadConfigProperties();
const flags = require('../common/flags');

let cicsHandler;

// TODO: Check if region is active ----- bright zos-jobs list all --name A23ICICA

gulp.task('java', 'Tasks used to manage the Java-related CICS resources', [], async() => {
  cicsHandler = require('../common/brightside/cics');

  if (!flags.get().define &&
      !flags.get().compile &&
      !flags.get().deploy &&
      !flags.get().refresh) {
    defineJavaResources();
    compileJavaMarbles('java:build');
    await deployJavaMarbles('java:deploy');
    refreshJavaMarbles('java:refresh');
  } else {
    if (flags.get().define) {
      defineJavaResources();
    }

    if (flags.get().compile) {
      compileJavaMarbles('java:build');
    }

    if (flags.get().deploy) {
      await deployJavaMarbles('java:deploy');
    }

    if (flags.get().refresh) {
      refreshJavaMarbles('java:refresh');
    }
  }
}, {
  options: {
    compile: 'Compiles the Java source code and creates corresponding jar file',
    define : 'Defines all necessary CICS resources to support Java transaction',
    deploy : 'Uploads the OSGi bundle related files to USS',
    refresh: 'Refreshes the bundle CICS resource'
  }
});

/**
 * Define all java resources needed
 */
function defineJavaResources() {
  const jvmServer = props.javaMarble.jvmServer;
  const jvmProfile = props.javaMarble.jvmProfile;
  const bundleName = props.javaMarble.bundleName;
  const bundleDir =
    props.javaMarble.bundleDir +
    props.javaMarble.bundlePackage + '_' +
    props.javaMarble.bundleVersion + '/';
  const programName = props.javaMarble.programName;
  const programClass = props.javaMarble.programClass;
  const transactionName = props.javaMarble.transactionName;

  console.log('Defining and enabling all necessary resources...');

  cicsHandler.prepareResource('JVMSERVER', jvmServer, 'JVMPROFILE(' + jvmProfile + ')');

  cicsHandler.prepareResource('BUNDLE', bundleName, 'BUNDLEDIR(' + bundleDir + ')');

  cicsHandler.prepareResource(
    'PROGRAM',
    programName,
    'JVM(YES)',
    'JVMCLASS(' + programClass + ')',
    'JVMSERVER(' + jvmServer + ')'
  );

  cicsHandler.prepareResource('TRANSACTION', transactionName, 'PROGRAM(' + programName + ')');
}

/**
 * Compile java marbles bundle
 * @param {string} taskName The name of the task that called this function.
 */
function compileJavaMarbles(taskName) {
  if (!props) {
    const err = 'An error occurred while reading your properties file';
    console.error(err);
    common.throwError(taskName, err);
  }

  /**
   * Compile java source code
   */
  console.log('Compiling java source code...');
  let temp = cp.spawnSync('javac',
    [
      '-cp ' + props.javaMarble.location + '/lib/com.ibm.cics.server.jar ',
      '-d ' + props.javaMarble.location + '/inside-jar ',
      props.javaMarble.location + '/src/com/ca/marbles/*.java'
    ], {
      encoding                : 'utf8',
      env                     : process.env,
      windowsVerbatimArguments: true
    });

  if (temp.status !== 0 || temp.stderr) {
    const err = 'An error occurred while compiling the java source';
    console.error(err);
    console.error('Status:', temp.status);
    console.error('Stderr:', temp.stderr);
    common.throwError(taskName, err);
  }

  console.log('Stdout:', temp.stdout);
  console.log('Java source code was compiled successfully!');

  /**
   * Generate the Java archive file
   */
  console.log('Generating the java archive file...');
  temp = cp.spawnSync('jar',
    [
      'cvfM',
      props.javaMarble.location + '/outside-jar/com.ca.marbles_1.0.0.jar',
      '-C ',
      props.javaMarble.location + '/inside-jar/',
      '.'
    ], {
      encoding                : 'utf8',
      env                     : process.env,
      windowsVerbatimArguments: true
    });

  if (temp.status !== 0 || temp.stderr) {
    const err = 'An error occurred while generating the java archive';
    console.error(err);
    console.error('Status:', temp.status);
    console.error('Stderr:', temp.stderr);
    common.throwError(taskName, err);
  }

  console.log('Stdout:', temp.stdout);
  console.log('JAR file was generated successfully!');
}

/**
 * Deploy java marbles bundle
 * @param {string} taskName The name of the task that called this function.
 */
async function deployJavaMarbles(taskName) {
  if (!props) {
    const err = 'An error occurred while reading your properties file';
    console.error(err);
    common.throwError(taskName, err);
  }

  console.log('Transfering java bundle...');

  const srcDir = props.javaMarble.location + '/outside-jar/';
  const destDir =
    props.javaMarble.bundleDir +
    props.javaMarble.bundlePackage + '_' +
    props.javaMarble.bundleVersion + '/';

  console.log('Source directory:', srcDir);
  console.log('Destination directory:', destDir);

  const transferStatus = ftpUtils.ftpFolder(srcDir, destDir);
  if (await transferStatus === true) {
    console.log('Transfer succeeded!');
  } else {
    common.throwError(taskName, 'Transfer failed');
  }
}

/**
 * Refresh the java bundle
 * @param {string} taskName The name of the task that called this function.
 */
function refreshJavaMarbles(taskName) {
  const type = 'BUNDLE';
  const bundleName = props.javaMarble.bundleName;

  console.log('Disabling the bundle ' + bundleName + ' ...');
  let rc = cicsHandler.setResourceState(type, bundleName, 'disabled');
  if (rc === 0) { // Resource state changed
    console.log('Bundle ' + bundleName + ' successfully disabled!');

    console.log('Discarding the bundle ' + bundleName + ' ...');
    if (cicsHandler.discardResource(type, bundleName) < 0) { // Resource not discarded
      common.throwError(taskName, 'Bundle ' + bundleName + ' failed to discard!');
    }
    console.log('Bundle ' + bundleName + ' successfully discarded!');
  } else if (rc === -1) { // Resource state not changed
    common.throwError(taskName, 'Bundle ' + bundleName + ' failed to disable!');
  } else if (rc === -2) { // Resource not found
    console.log('Bundle ' + bundleName + ' not found!');
  }

  console.log('Installing the bundle ' + bundleName + ' ...');
  rc = cicsHandler.installModifyResource(type, bundleName);
  if(rc === -2) { // Resource failed to install
    common.throwError(taskName, 'Bundle ' + bundleName + ' failed to install!');
  } else if (rc === -1) { // Resource definition not found
    common.throwError(taskName, 'Bundle ' + bundleName + ' definition not found!');
  } else if (rc >= 0) {
    console.log('Bundle ' + bundleName + ' successfully installed!');

    console.log('Enabling the bundle ' + bundleName + ' ...');
    if (cicsHandler.setResourceState(type, bundleName, 'enabled') < 0) {
      common.throwError(taskName, 'Bundle ' + bundleName + ' failed to enable!');
    }
    console.log('Bundle ' + bundleName + ' successfully enabled!');
  }
}
