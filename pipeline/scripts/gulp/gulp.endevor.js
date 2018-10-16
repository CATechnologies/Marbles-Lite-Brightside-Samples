const brightUtils = require('../common/brightside/utils');
const colors = require('gulp-util').colors;
const fs = require('fs');
const common = require('../common/common');
let args;
const endv = require('../common/brightside/endevor');
const getMyLine = common.getMyLine;
const utils = require('../common/utils');
const gulp = common.gulp;
const path = require('path');
const props = common.loadConfigProperties();
const rimraf = require('rimraf');
const throwError = common.throwError;

const endevorOptions = {
  createProj       : 'Create a Git-to-Endevor project (one-time setup)',
  pushSource       : 'Commit and push local source changes to Endevor',
  uploadCicdRexx   : 'Upload REXX program that triggers CI/CD pipelines',
  uploadCicdProps  : 'Upload properties to configure REXX program',
  uploadCicdUrl    : 'Add CI/CD URL of this Git branch to URLs for Endevor sandbox',
  uploadCicdFiles  : 'Upload all CI/CD related data files',
  startCicd        : 'Start CI/CD pipeline like an Endevor promotion would',
  designCastPackage: 'Design and Case Marbles Lite Package',
  executePackage   : 'Execute Marbles Lite Package'
};

gulp.task('endevor', 'Perform actions to Endevor', [], () => {
  args = require('../common/flags').get();

  if (utils.isFalsy(
    args.createProj,
    args.pushSource,
    args.uploadCicdRexx,
    args.uploadCicdProps,
    args.uploadCicdUrl,
    args.uploadCicdFiles,
    args.startCicd,
    args.designCastPackage,
    args.executePackage
  )) {
    console.log('You must specify one of the following options.');
    Object.entries(endevorOptions).forEach(
      ([key, value]) => console.log('  --' + key, '\t' + value)
    );
  } else {
    if (!props) {
      throwError('endevor',
        'No properties exist.\nStopping ' +
        getMyLine(new Error()));
    }

    if (args.createProj) {
      createEndvProj('endevor --createProj');
    }

    if (args.pushSource) {
      endv.pushSrcToEndevor('endevor --pushSource');
    }

    if (args.uploadCicdRexx) {
      uploadCicdRexx('endevor --uploadCicdRexx');
    }

    if (args.uploadCicdProps) {
      uploadCicdProps('endevor --uploadCicdProps');
    }

    if (args.uploadCicdUrl) {
      uploadCicdUrl('endevor --uploadCicdUrl');
    }

    if (args.uploadCicdFiles) {
      uploadCicdFiles('endevor --uploadCicdFiles');
    }

    if (args.startCicd) {
      startCicd('endevor --startCicd');
    }

    // design and cast of Endevor package
    if (args.designCastPackage) {
      endv.designAndCastPackage('endevor --designCastPackage');
    }

    // execute Endevor package
    if (args.executePackage) {
      endv.executePackage('endevor --executePackage');
    }
  }
}, {options: endevorOptions});

// ____________________________________________________________________________
/**
 * Create a Endevor project.
 *
 * @param {string} taskName The name of the task that called this function
 */
function createEndvProj(taskName) {
  // delete any existing project directory
  if (fs.existsSync(props.endevorProj.ndvrProjDir)) {
    // we must start from an empty directory so delete the current one
    rimraf(props.endevorProj.ndvrProjDir, error => {
      if (error) {
        throwError(taskName, colors.red.bold(
          '\nFailed to delete existing project directory due to the following error:\n' +
          error + '\nStopping ' + getMyLine(new Error())
        ));
      }

      console.log('Deleted existing directory = ' + props.endevorProj.ndvrProjDir);
      createEndvProjWhenNoDir(taskName);
    });
  } else {
    createEndvProjWhenNoDir(taskName);
  }
}

// ____________________________________________________________________________
/**
 * Create a Endevor project when the project directory
 * does not exist.
 *
 * @param {string} taskName The name of the task that called this function
 */
function createEndvProjWhenNoDir(taskName) {
  const startingDir = process.cwd();

  // Create the project directory
  fs.mkdirSync(props.endevorProj.ndvrProjDir);

  // List all members with bright command
  const endvrElements = brightUtils.issueCommand([
    'endevor',
    'list',
    'elements',
    props.endevorProj.element,
    '--instance',
    props.endevorProj.instance,
    '--environment',
    props.endevorProj.ndrvenv,
    '--system',
    props.endevorProj.ndvrsystem,
    '--subsystem',
    props.endevorProj.ndvrsubsys,
    '--rfj',
    '--endevor-p',
    brightUtils.profiles.endevor
  ]);
  console.log(endvrElements);
  // Download each element
  endvrElements.data.forEach(ndvrElement => {
    brightUtils.issueCommand([
      'endevor',
      'retrieve',
      'element',
      ndvrElement.elmName,
      '--instance',
      props.endevorProj.instance,
      '--environment',
      ndvrElement.envName,
      '--stage-number',
      ndvrElement.stgNum,
      '--system',
      ndvrElement.sysName,
      '--subsystem',
      ndvrElement.sbsName,
      '--type',
      ndvrElement.typeName,
      '--ccid',
      ndvrElement.elmLastLLCcid,
      '--to-file',
      `${props.endevorProj.ndvrProjDir}/${ndvrElement.elmName}.${ndvrElement.typeName}`,
      '--comment',
      '"Fake comment from demo script."',
      '--endevor-p',
      brightUtils.profiles.endevor
    ]);
  });

  // after initially creating a project, populate z/OS files to trigger CICD pipeline
  process.chdir(startingDir);
  uploadCicdFiles(taskName);
  console.log('\n' + colors.green.bold('Project successfully created.'));
}

// ____________________________________________________________________________
/**
 * Get the root directory of our NodeJs project.
 * @returns {string} full path to our project directory
 */
function getProjRootDir() {
  return path.resolve(__dirname, '../../');
}

// ____________________________________________________________________________
/**
 * Start the CI/CD pipeline from a z/OS batch job. This operation is typically
 * performed by an Endevor promotion processor. This gulp task is used to
 * test the batch job which triggers CI/CD pipelines without having to promote
 * an Endevor sandbox.
 *
 * @param {string} taskName The name of the task that called this function
 */
function startCicd(taskName) {
  console.log(
    '\n---------------------------------------------\n' +
    'Starting z/OS batch job to trigger our CI/CD pipeline (simulating Endevor)' +
    '\nusing a command like:\n    ' +
    colors.yellow.bold('bright zos-jobs submit <JCL> ... ') + '\n'
  );
  const jclTemplateFileNm = path.join(
    getProjRootDir(),
    'mainframe/cicdTrigger/strtcicd-template.jcl'
  );

  /*
   * Variable names in our template JCL that we want to replace
   * with user-configured property values.
   */
  const varToValMap = {
    '{job_name_prefix}': props.zos_jobs.job_name_prefix,
    '{job_class}'      : props.zos_jobs.job_class,
    '{msgclass}'       : props.zos_jobs.msgclass,
    '{account}'        : props.system.account,
    '{cicdPds}'        : props.cicd.hiLevQual + '.' + props.cicd.pdsQual,
    '{rexxMem}'        : props.cicd.rexxMem,
    '{ndrvenv}'        : props.endevorProj.ndrvenv,
    '{ndvrHlq}'        : props.endevorProj.ndvrHlq,
    '{ndrvstage}'      : props.endevorProj.ndrvstage,
    '{ndvrsystem}'     : props.endevorProj.ndvrsystem,
    '{ndvrsubsys}'     : props.endevorProj.ndvrsubsys
  };

  // transform our template JCL into runnable JCL
  const jclToRun = common.replaceVarsInFile(jclTemplateFileNm, varToValMap);

  const childCmd = brightUtils.issueCommand([
    'zos-jobs',
    'submit',
    'stdin',
    '--print-all',
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ], false, jclToRun);
  if (!childCmd || childCmd.success === false) {
    common.throwError(taskName, colors.red.bold(
      'Failed run JCL to start our CI/CD pipeline\n' +
      (childCmd.stderr ? 'due to the following brightside error:\n' + childCmd.stderr : 'No error available.') +
      '.\nStopping ' + common.getMyLine(new Error())
    ));
  }

  console.log(childCmd.stdout);

  // we must look at JCL output for success
  const goodPattern = /Successfully posted/;
  if (childCmd.stdout.search(goodPattern) === -1) {
    console.log(childCmd.stderr);
    common.throwError(taskName,
      colors.red.bold(
        'Failed to start our CI/CD pipeline' +
        '\nWe were unable to find the following good pattern in the output above:\n    ' +
        goodPattern +
        '\nStopping ' + common.getMyLine(new Error())
      ));
  }
  console.log(colors.green.bold('Successfully ran job to trigger CI/CD pipelines.'));
}

// ____________________________________________________________________________
/**
 * Upload all CI/CD files to the mainframe.
 *
 * @param {string} taskName The name of the task that called this function
 */
function uploadCicdFiles(taskName) {
  uploadCicdRexx(taskName);
  uploadCicdProps(taskName);
  uploadCicdUrl(taskName);
}

// ____________________________________________________________________________
/**
 * Upload our CI/CD related properties to a z/OS data set.
 * these properties are used by the STRTCICD Rexx program..
 *
 * @param {string} taskName The name of the task that called this function
 */
function uploadCicdProps(taskName) {
  const cicdPropsText =
    'verbose ' + props.cicd.verbose +
    '\nuserName ' + props.system.user +
    '\npassword ' + props.system.pass;

  const zosFileNm = '"' + props.cicd.hiLevQual + '.' + props.cicd.pdsQual + '(' + props.cicd.propsMem + ')"';
  uploadToMf(taskName, 'var', cicdPropsText, zosFileNm);
}

// ____________________________________________________________________________
/**
 * Upload our REXX program used to start a CICD pipeline to a z/OS data set.
 * When an Endevor sandbox is promoted, Endevor will run this REXX in a job.
 *
 * @param {string} taskName The name of the task that called this function
 */
function uploadCicdRexx(taskName) {
  const localFileNm = path.join(
    getProjRootDir(),
    'mainframe/cicdTrigger',
    props.cicd.rexxMem.toLowerCase() + '.rex'
  );
  const zosFileNm = '"' + props.cicd.hiLevQual + '.' + props.cicd.pdsQual + '(' + props.cicd.rexxMem + ')"';
  uploadToMf(taskName, 'file', localFileNm, zosFileNm);
}

// ____________________________________________________________________________
/**
 * Upload the URI host and requestPath for the CI/CD pipeline for the
 * current git branch.
 *
 * If the z/OS file already exists, and our URL is not already in the file,
 * we add the URL information to that file.
 *
 * If the z/OS file does not exist, we allocate it and upload our URL into
 * that file.
 *
 * @param {string} taskName The name of the task that called this function
 */
function uploadCicdUrl(taskName) {
  const gitBranchNm = 'master';

  /*
  // Get the set of available Git branches
  const localBranches = common.runGitCmd(taskName, ['branch'], true);

  // identify and extract the current branch (marked with *) from the full set
  const curBranchMatcher = /^\* *(.*)/;
  let gitBranchNm = '';
  const branchArray = localBranches.split(/\r\n|\n/);
  for (const branch of branchArray) {
    if (branch.search(curBranchMatcher) !== -1) {
      gitBranchNm = branch.replace(curBranchMatcher, '$1');
      break;
    }
  }

  if (gitBranchNm === '') {
    throwError(taskName,
      colors.red.bold(
        '\nFailed to get the current Git branch name.\n' +
        'Stopping ' + getMyLine(new Error())
      ));
  }
 */

  // replace the branch name in the CICD request path template
  const varToValMap = {'{branchName}': gitBranchNm};
  const reqPath = common.replaceVarsInString(props.cicd.reqPathTemplate, varToValMap);

  // form our entry for the CICD URLs file
  const urlFileEntry = props.cicd.serverUri + '   ' + reqPath;

  // to determine if our URL file exists on z/OS, we try to list it
  let setOfUrls = '';
  const zosUrlFileNm = props.cicd.hiLevQual + '.' +
    props.endevorProj.ndvrsystem + '.' + props.endevorProj.ndvrsubsys + '.' +
    props.endevorProj.ndrvenv + props.endevorProj.ndrvstage + '.' +
    props.cicd.urlQual;
  let childCmd = brightUtils.issueCommand([
    'zos-files',
    'list',
    'data-set',
    '"' + zosUrlFileNm + '"',
    '--response-format-json',
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ]);
  if (!childCmd || childCmd.success === false) {
    throwError(taskName, colors.red.bold(
      '\nFailed trying to list existing CICD URL file named\n   ' + zosUrlFileNm +
      (childCmd.stderr ? '\ndue to the following brightside error:\n' + childCmd.stderr : 'No error available.') +
      '\nStopping ' + getMyLine(new Error())
    ));
  }
  console.log(childCmd);
  if (childCmd.stderr) {
    throwError(taskName, colors.red.bold(
      'Unable to detect if a CICD URL file exists named:\n   ' + zosUrlFileNm +
      (childCmd.stdout ? '\nBrightside results were:\n' + childCmd.stdout : 'No results available.') +
      '\nStopping ' + getMyLine(new Error())
    ));
  }

  /* If our list command reported zero files, we must create the file.
   * Otherwise we must download, update, and re-upload the file.
   */
  if (childCmd.stdout === '') {
    // create the file
    childCmd = brightUtils.issueCommand([
      'zos-files',
      'create',
      'data-set-sequential',
      `"${zosUrlFileNm}"`,
      '--allocation-space-unit',
      'TRK',
      '--primary-space',
      10,
      '--secondary-space',
      5,
      '--record-format',
      'FB',
      '--block-size',
      1500,
      '--record-length',
      150,
      '--zosmf-p',
      brightUtils.profiles.zosmf
    ]);
    if (!childCmd || childCmd.success === false) {
      throwError(taskName, colors.red.bold(
        '\nFailed trying to create CICD URL file named\n   ' + zosUrlFileNm +
        (childCmd.stderr ? '\ndue to the following brightside error:\n' + childCmd.stderr : 'No error available.') +
        '\nStopping ' + getMyLine(new Error())
      ));
    }

    // ensure that we later add our current file entry into the set of URLS
    setOfUrls = '';
  } else {
    // download the existing CICDURLS file
    const urlTempFileNm = path.join(getProjRootDir(), '/build/cicdUrlsTemp.txt');
    childCmd = brightUtils.issueCommand([
      'zos-files',
      'download',
      'data-set',
      `"${zosUrlFileNm}"`,
      '--file',
      urlTempFileNm,
      '--zosmf-p',
      brightUtils.profiles.zosmf
    ]);
    if (!childCmd) {
      throwError(taskName,
        colors.red.bold(
          '\nFailed to download existing CICD URL file due to previous brightside error.\nStopping ' +
          getMyLine(new Error())
        ));
    }
    if (childCmd.stdout) {
      console.log(childCmd.stdout);
    }
    if (childCmd.stderr) {
      throwError(taskName,
        colors.red.bold(
          '\nFailed to download existing CICD URL file due to this brightside error:\n' +
          childCmd.stderr +
          '\nStopping ' + getMyLine(new Error())
        ));
    }

    // Read the downloaded URLs, then delete the temp file that is no longer needed.
    setOfUrls = fs.readFileSync(urlTempFileNm, 'utf8');
    rimraf(urlTempFileNm, ['unlinkSync'], error => {
      if (error) {
        console.log(colors.orange(taskName + ' failed to delete temp file due to the following error:'));
        console.log(error);
      }
    });

    /* Replace any Windows newlines with Unix newlines.
     * The windows newlines introduce blank lines in the z/OS file.
     */
    setOfUrls = setOfUrls.replace(/\r\n/, '\n');
  }

  // if our new entry does not exist in the set of URLs, add it
  if (setOfUrls.search(urlFileEntry) === -1) {
    setOfUrls += urlFileEntry + '\n';

    // upload the new content to z/OS file
    uploadToMf(taskName, 'var', setOfUrls, zosUrlFileNm);
  }

  console.log(
    '\nThe following URL entry will trigger the CI/CD pipeline for your Git branch:' +
    '\n    ' + urlFileEntry +
    '\nand is contained in the following file:' +
    '\n    ' + zosUrlFileNm +
    '\n\n' + taskName + ' completed successfully.'
  );
} // end uploadCicdUrl

// ____________________________________________________________________________
/**
 * Upload a file or text from a variable to a z/OS dataset.
 *
 * @param {string} taskName
 *        The name of the task that called this function
 * @param {string} fileOrVar
 *        Indicator of whether the next parameter is a filename ('file') or
 *        a variable holding text to be uploaded ('var')
 * @param {string} dataToUpload
 *        The name of a local file or a variable holding text to upload
 * @param {string} zosFileNm
 *        The name of the z/OS file to write to
 */
function uploadToMf(taskName, fileOrVar, dataToUpload, zosFileNm) {
  const brightCmdArray = ['zos-files', 'upload'];
  let stdinText = null;
  let uploadMsgPhrase = '';

  if (fileOrVar === 'file') {
    brightCmdArray.push('file-to-data-set', dataToUpload);
    stdinText = null;
    uploadMsgPhrase = 'file = ' + dataToUpload;
  } else if (fileOrVar === 'var') {
    brightCmdArray.push('stdin-to-data-set');
    stdinText = dataToUpload;
    uploadMsgPhrase = 'dynamic text';
  } else {
    throwError(taskName,
      colors.red.bold(
        '\nParameter "fileOrVar" contains invalid value = ' + fileOrVar +
        '\nStopping ' + getMyLine(new Error())
      ));
  }
  brightCmdArray.push(zosFileNm, '--zosmf-p', brightUtils.profiles.zosmf);

  console.log(
    'Uploading ' + uploadMsgPhrase + ' to\n    ' +
    zosFileNm +
    '\nusing a command like:\n    ' +
    colors.yellow.bold('bright zos-files upload ...')
  );

  const childCmd = brightUtils.issueCommand(brightCmdArray, false, stdinText);
  if (!childCmd) {
    throwError(taskName,
      colors.red.bold(
        '\nFailed to upload due to previous brightside error.\nStopping ' +
        getMyLine(new Error())
      ));
  }
  if (childCmd.stdout) {
    console.log(childCmd.stdout);
  }
  if (childCmd.stderr) {
    throwError(taskName,
      colors.red.bold(
        '\nFailed to upload due to the following brightside error:\n' +
        childCmd.stderr +
        '\nStopping ' + getMyLine(new Error())
      ));
  }
}
