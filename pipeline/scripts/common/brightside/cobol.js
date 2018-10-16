// A collection of common functions used by our gulp tasks.
const common = require('../common');
const utils = require('../utils');
const props = common.loadConfigProperties();
const colors = require('gulp-util').colors;
const path = require('path');
const brightUtils = require('./utils');
const brightProv = require('./provisioning');
const cicsHandler = require('./cics');
const endevor = require('./endevor');

/**
 * Compile the Marbles COBOL program. The source resides in Endevor.
 * We perform these operations:
 *  - Navigate to our Endevor brightside project
 *  - Issue a command to push our local changes to Endevor
 *  - Request an Endevor generate for our element
 *  - Create and run the JCL to bind the DB2 SQL content of our
 *    Marbles program to our DB2 instance.
 *
 * @param {string} taskName The name of the task that called this function
 */
function compileCobolMarbles(taskName) {
  if (!props) {
    common.throwError(taskName,
      colors.red.bold(
        'No properties exist.\nStopping ' + common.getMyLine(new Error())
      ));
  }

  let childCmd;
  let goodPattern;
  let jclToRun;
  let jclTemplateFileNm;
  let varToValMap;

  // get the load library for our dynamically-provisioned CICS region
  const projRootDir = utils.getProjectRoot();
  let dynaProps;
  try {
    dynaProps = require(path.join(projRootDir, props.properties));
  } catch (e) {
    console.log('Properties file not found:', path.join(projRootDir, props.properties));
  }

  let cicsLoadLib;

  if (!dynaProps) {
    console.log('Continuing with Static CICS instance');
    cicsLoadLib = props.cics.loadlib;
  } else if (!dynaProps.instances ||
    !dynaProps.instances.CICS ||
    !dynaProps.instances.CICS.name
  ) {
    common.throwError(taskName,
      colors.red.bold(
        'Our dynamically provisioned properties do not exist.\nStopping ' +
        common.getMyLine(new Error())
      ));
  } else {
    cicsLoadLib = brightProv.getInstanceDetails(dynaProps.instances.CICS.name).DFH_REGION_RPL;
  }

  // Push files back to endevor
  endevor.pushSrcToEndevor();
  console.log(colors.green.bold('Successfully pushed source to Endevor.'));

  console.log(
    '\n---------------------------------------------\n' +
    'Requesting that Endevor generate ' + props.endevorProj.element +
    '\nusing a command like:\n    ' +
    colors.yellow.bold('bright endevor generate element ' + props.endevorProj.element) +
    '\nfrom this directory:\n    ' + process.cwd() + '\n'
  );

  childCmd = brightUtils.issueCommand([
    'endevor',
    'generate',
    'element',
    props.endevorProj.element,
    '--type',
    props.endevorProj.elemType,
    '--instance',
    props.endevorProj.instance,
    '--system',
    props.endevorProj.ndvrsystem,
    '--subsystem',
    props.endevorProj.ndvrsubsys,
    '--environment',
    props.endevorProj.ndrvenv,
    '--stage-number',
    props.endevorProj.ndrvstage,
    '--endevor-p',
    brightUtils.profiles.endevor
  ]);
  if (!childCmd) {
    common.throwError(taskName,
      colors.red.bold(
        'Failed to generate due to previous brightside error.\nStopping ' +
        common.getMyLine(new Error())
      ));
  }

  // Even though bright succeeds, we must look at Endevor output for success
  goodPattern = /(highest endevor rc was 0000)/g;
  const matchedLines = childCmd.stdout.match(goodPattern);
  if (!matchedLines || !matchedLines.length || matchedLines.length < 4) {
    console.log(childCmd.stderr);
    console.log(childCmd.stdout);
    common.throwError(taskName,
      colors.red.bold(
        'Failed to generate. We were unable to find the following good pattern in the output above:\n    ' +
        goodPattern +
        '\nStopping ' + common.getMyLine(new Error())
      ));
  }
  console.log(colors.green.bold('Successfully generated.'));

  console.log(
    '\n---------------------------------------------\n' +
    'Copying Endevor-generated binary to CICS load library\n    ' +
    cicsLoadLib + '.\nusing a command like:\n    ' +
    colors.yellow.bold('bright zos-jobs submit <JCL> ... ') + '\n'
  );

  jclTemplateFileNm = path.normalize(projRootDir +
    '/mainframe/transactions/jcl/copyMarblesToCics-template.jcl');

  /*
   * Variable names in our template JCL that we want to replace
   * with user-configured property values.
   */
  varToValMap = {
    '@@job_name_prefix##': props.zos_jobs.job_name_prefix,
    '@@job_class##'      : props.zos_jobs.job_class,
    '@@msgclass##'       : props.zos_jobs.msgclass,
    '@@account##'        : props.system.account,
    '@@program##'        : props.cics.cobol.program,
    '@@cicsllib##'       : cicsLoadLib,
    '@@ndrvenv##'        : props.endevorProj.ndrvenv,
    '@@ndvrHlq##'        : props.endevorProj.ndvrHlq,
    '@@ndrvstage##'      : props.endevorProj.ndrvstage,
    '@@ndvrsystem##'     : props.endevorProj.ndvrsystem,
    '@@ndvrsubsys##'     : props.endevorProj.ndvrsubsys
  };

  // transform our template JCL into runnable JCL
  jclToRun = common.replaceVarsInFile(jclTemplateFileNm, varToValMap);

  childCmd = brightUtils.issueCommand([
    'zos-jobs',
    'submit',
    'stdin',
    '--print-all',
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ], false, jclToRun);
  if (!childCmd) {
    common.throwError(taskName,
      colors.red.bold(
        'Failed run JCL to copy ' + props.cics.cobol.program + ' to ' + cicsLoadLib +
        '.\nStopping ' + common.getMyLine(new Error())
      ));
  }

  // Even though bright succeeds, we must look at JCL output for success
  goodPattern = /COND CODE 0000/;
  if (childCmd.stdout.search(goodPattern) === -1) {
    console.log(childCmd.stderr);
    console.log(childCmd.stdout);
    common.throwError(taskName,
      colors.red.bold(
        'Failed to copy ' + props.cics.cobol.program + ' to ' + cicsLoadLib +
        '\nWe were unable to find the following good pattern in the output above:\n    ' +
        goodPattern +
        '\nStopping ' + common.getMyLine(new Error())
      ));
  }
  console.log(colors.green.bold('Successfully copied to CICS library.'));

  console.log(
    '\n---------------------------------------------\n' +
    'Binding ' + props.cics.cobol.program +
    ' to DB2 instance ' + props.brightside.db2.region +
    '\nusing a command like:\n    ' +
    colors.yellow.bold('bright zos-jobs submit <JCL> ...\n')
  );

  jclTemplateFileNm = path.normalize(projRootDir +
    '/mainframe/transactions/jcl/bindMarbles-template.jcl');

  /*
   * Variable names in our template JCL that we want to replace
   * with user-configured property values.
   */
  varToValMap = {
    '@@job_name_prefix##'       : props.zos_jobs.job_name_prefix,
    '@@job_class##'             : props.zos_jobs.job_class,
    '@@msgclass##'              : props.zos_jobs.msgclass,
    '@@account##'               : props.system.account,
    '@@owner##'                 : props.system.user,
    '@@plan##'                  : props.cics.cobol.plan,
    '@@program##'               : props.cics.cobol.program,
    '@@cicsllib##'              : cicsLoadLib,
    '@@db2_region_id##'         : props.brightside.db2.region,
    '@@region_data_set_prefix##': props.brightside.db2.hlq,
    '@@ndrvenv##'               : props.endevorProj.ndrvenv,
    '@@ndvrHlq##'               : props.endevorProj.ndvrHlq,
    '@@ndrvstage##'             : props.endevorProj.ndrvstage,
    '@@ndvrsystem##'            : props.endevorProj.ndvrsystem,
    '@@ndvrsubsys##'            : props.endevorProj.ndvrsubsys
  };

  // transform our template JCL into runnable JCL
  jclToRun = common.replaceVarsInFile(jclTemplateFileNm, varToValMap);

  childCmd = brightUtils.issueCommand([
    'zos-jobs',
    'submit',
    'stdin',
    '--print-all',
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ], false, jclToRun);
  if (!childCmd) {
    common.throwError(taskName,
      colors.red.bold(
        'Failed to run JCL to bind ' + props.cics.cobol.program + '.\nStopping ' +
        common.getMyLine(new Error())
      ));
  }

  // Even though bright succeeds, we must look at JCL output for success
  goodPattern = /COND CODE 0000/;
  if (childCmd.stdout.search(goodPattern) === -1) {
    console.log(childCmd.stderr);
    console.log(childCmd.stdout);
    common.throwError(taskName,
      colors.red.bold(
        'Failed to bind ' + props.cics.cobol.program +
        '\nWe were unable to find the following good pattern in the output above:\n    ' +
        goodPattern +
        '\nStopping ' + common.getMyLine(new Error())
      ));
  }

  console.log(colors.green.bold('Successfully completed DB2 bind operation.'));
} // end compileCobolMarbles

/**
 * To use a re-built Marbles COBOL program, we need to refresh the CICS program.
 *
 * @param {string} taskName The name of the task that called this function
 */
function refreshCobolMarbles(taskName) {
  if (!props) {
    common.throwError(taskName,
      colors.red.bold(
        'No properties exist.\nStopping ' + common.getMyLine(new Error())
      ));
  }

  console.log(
    '\n---------------------------------------------\n' +
    'Refreshing CICS program using a command like:\n    ' +
    colors.yellow.bold('bright cics issue modify "CEMT SET PROGRAM(' +
      props.cics.cobol.program + ') NEWCOPY ..."\n')
  );

  const retCode = cicsHandler.refreshProgram(props.cics.cobol.program);
  switch (retCode) {
  case 0:
    console.log(colors.green.bold(
      'Successfully refreshed program = "' + props.cics.cobol.program + '".'
    ));
    break;
  case -1:
  case -2:
    console.log(colors.red.bold(
      'Failed to refresh program = "' + props.cics.cobol.program + '".'
    ));
    break;
  default:
    common.throwError(taskName,
      colors.red.bold(
        'Got unexpected return code = "' + retCode +
        '" from cicsHandler.refreshProgram.\nStopping ' +
        common.getMyLine(new Error())
      ));
    break;
  }
}

module.exports = {
  compileCobolMarbles: compileCobolMarbles,
  refreshCobolMarbles: refreshCobolMarbles
};
