// A collection of common functions used by our gulp tasks.
const brightUtils = require('./utils');
const fs = require('fs');
const common = require('../common');
const utils = require('../utils');
// const colors = require('gulp-util').colors;
// const getMyLine = common.getMyLine;
const path = require('path');
const props = common.loadConfigProperties();
// const throwError = common.throwError;

const successReturnCode = 4;
// _________________________________________________________________________
/**
 * Get the directory of our Endevor-controlled source.
 *
 * @returns {string} The Endevor source directory
 */
function getEndvDirPath() {
  return path.join(
    utils.getProjectRoot(),
    props.endevorProj.ndvrProjDir,
    props.endevorProj.ndvrsystem.toLowerCase(),
    props.endevorProj.ndrvenv.toLowerCase(),
    props.endevorProj.ndvrsubsys.toLowerCase(),
    props.endevorProj.ndrvstage.toString(),
    '/' + props.endevorProj.elemType
  );
}

// ____________________________________________________________________________
/**
 * Get the name of our Endevor element's source file.
 *
 * @returns {string} The element's source file name
 */
function getEndvElemSrcFileNm() {
  return path.normalize(
    props.endevorProj.element.toLowerCase() + props.endevorProj.elemExt
  );
}

// ____________________________________________________________________________
/**
 * Get the path to our Endevor element's source file.
 *
 * @returns {string} The path to the Endevor controlled source file
 */
function getEndvElemSrcFilePath() {
  return path.join(getEndvDirPath(), getEndvElemSrcFileNm());
}

// ____________________________________________________________________________
/**
 * Push local changes to Endevor.
 */
function pushSrcToEndevor() {
  // Upload files to endevor
  fs.readdir(props.endevorProj.ndvrProjDir, (err, dir) => {
    for(const filePath of dir) {
      const fileDestination = path.normalize(`${__dirname}../../../../${props.endevorProj.ndvrProjDir}/${filePath}`);
      const elementName = filePath.substr(0, filePath.lastIndexOf('.'));
      const elementType = filePath.substr(filePath.lastIndexOf('.') + 1, filePath.last);
      brightUtils.issueCommand([
        'endevor',
        'update',
        'element',
        elementName,
        '--instance',
        props.endevorProj.instance,
        '--environment',
        props.endevorProj.ndrvenv,
        '--system',
        props.endevorProj.ndvrsystem,
        '--subsystem',
        props.endevorProj.ndvrsubsys,
        '--type',
        elementType,
        '--comment',
        'DEMO',
        '--ccid',
        'MARBLES',
        '--stage-number',
        props.endevorProj.ndrvstage,
        '--from-file',
        fileDestination,
        '--endevor-p',
        brightUtils.profiles.endevor
      ]);
    }
  });
}

// ____________________________________________________________________________
/**
 * Design and Cast Marbles Lite Package.
 *
 * @param {string} taskName The name of the task that called this function
 */
function designAndCastPackage(taskName) {
  let temp;
  // delete existing package
  temp = brightUtils.issueCommand(
    ['endevor delete package  MARBLESLITE -i WEBSNDVR']
  );
  if (!temp || !temp.success || temp.stderr || Number(temp.data.returnCode) > successReturnCode) {
    const err = 'An error occurred while deleting the Marbles Lite package';
    console.error(err);
    console.error(temp);
    common.throwError(taskName + '- deleting package', err);
  }

  // define the Marbles-Lite package
  temp = brightUtils.issueCommand(
    [
      'endevor create package MARBLESLITE -d "Package to deploy marbles lite" -t S --sharable --promotion ' +
      '--ff "./mainframe/EndevorSCL/MarblesPackageElements.scl" -i WEBSNDVR'
    ]
  );
  if (!temp || !temp.success || temp.stderr || Number(temp.data.returnCode) > successReturnCode) {
    const err = 'An error occurred while defining the Marbles Lite package';
    console.error(err);
    console.error(temp);
    common.throwError(taskName + '- defining package', err);
  }

  // Cast the package
  temp = brightUtils.issueCommand(
    ['endevor cast package MARBLESLITE -i WEBSNDVR']
  );
  if (!temp || !temp.success || temp.stderr || Number(temp.data.returnCode) > successReturnCode) {
    const err = 'An error occurred while casting the Marbles Lite package';
    console.error(err);
    console.error(temp);
    common.throwError(taskName + '- casting package', err);
  }
}

// ____________________________________________________________________________
/**
 * Execute Endevor package.
 *
 * @param {string} taskName The name of the task that called this function
 */
function executePackage(taskName) {
  const temp = brightUtils.issueCommand(
    ['endevor execute package MARBLESLITE -i WEBSNDVR']
  );
  if (!temp || !temp.success || temp.stderr || Number(temp.data.returnCode) > successReturnCode) {
    const err = 'An error occurred while executing the Marbles Lite package';
    console.error(err);
    console.error(temp);
    common.throwError(taskName + '- execute package', err);
  }
}

// ____________________________________________________________________________
module.exports = {
  getEndvDirPath        : getEndvDirPath,
  getEndvElemSrcFileNm  : getEndvElemSrcFileNm,
  getEndvElemSrcFilePath: getEndvElemSrcFilePath,
  pushSrcToEndevor      : pushSrcToEndevor,
  designAndCastPackage  : designAndCastPackage,
  executePackage        : executePackage
};
