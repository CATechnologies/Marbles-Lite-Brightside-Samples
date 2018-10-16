// A collection of common functions used by our gulp tasks.

const brightUtils = require('./utils');
const brightProv = require('./provisioning');
const common = require('../common');

const props = common.loadConfigProperties();
const genProps = common.loadGenProperties();
let cicsProfile = brightUtils.profiles.cics;

// Check if the profile for the provisioned instance was created
if (genProps && genProps.instances && genProps.instances.CICS) {
  const instanceInfo = genProps.instances.CICS;
  const profileName = `${instanceInfo.name}-${instanceInfo.objectId}`;

  // check if the profile exists
  if (brightUtils.doesProfileExists('cics', profileName)) {
    cicsProfile = profileName;

    // Check if the instance is provisioned
  } else if (brightProv.getInstanceInfo(instanceInfo.name) !== null) {
    cicsProfile = brightProv.createCicsProfileFromInstance(instanceInfo.name, instanceInfo.objectId);
  }
  // Otherwise, keep using the static CICS region
}

/**
 * Define the given resource
 * @param {string} type  - Describes the type of resource it is
 * @param {string} name  - Contains the name of the resource
 * @param {...string} parms - Contains additional parameters to define the resource
 * @returns {number} Possible values:
 *    x   - Value of the Highest Return Code
 *          0     - Success
 *          4     - Success with warnings
 *          x > 4 - Failure
 */
function defineResource(type, name, ...parms) {
  // TODO - use defineProgram() and defineTransaction() methods
  return submitDfhcsdupStatement(`DEFINE ${type.toUpperCase()}(${name.toUpperCase()}) ` +
    `GROUP(${props.brightside.cics.group}) ${parms.join(' ')}`);
}

/**
 * Deletes the given resource
 * @param {string} type  - Describes the type of resource it is
 * @param {string} name  - Contains the name of the resource
 * @returns {number} Possible values:
 *    x   - Value of the Highest Return Code
 *          0     - Success
 *          4     - Success with warnings
 *          x > 4 - Failure
 */
function deleteResource(type, name) {
  // TODO - use deleteProgram() and deleteTransaction() methods
  return submitDfhcsdupStatement(`DELETE ${type.toUpperCase()}(${name.toUpperCase()}) ` +
    `GROUP(${props.brightside.cics.group})`);
}

/**
 * Discards the given resource
 * @param {string} type - Describes the type of resource it is
 * @param {string} name - Contains the name of the resource
 * @returns {number|null} Possible values:
 *    -1  - Resource was not discarded because it was not disabled
 *    0   - Resource discarded successfully
 *    1   - Resource not found
 * @throws Gulp exception if bright command fails
 */
function discardResource(type, name) {
  // TODO update to use CICS plugin - state: to test
  const temp = brightUtils.issueCommand([
    'cics',
    'discard',
    type, // program or transaction
    name,
    '--region-name',
    props.brightside.cics.region
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = `An error occurred while discarding resource: ${name} type: ${type}`;
    console.error(err);
    console.error(temp);

    common.throwError('discardResource', err);
  }

  if (temp.stdout.search(new RegExp('not disabled', 'i')) >= 0) {
    console.log('Resource not discarded');
    console.log(temp.stdout);
    return -1;
  }

  if (temp.stdout.search(new RegExp('resource discarded', 'i')) >= 0) {
    // console.log('Resource discarded');
    return 0;
  }

  if (temp.stdout.search(new RegExp('not found', 'i')) >= 0) {
    // console.log('Resource not found');
    return 1;
  }

  // in case something unexpected happened
  console.log(temp);
  return null;
}

/**
 * Install resource using modify commands
 * @param {string} type  - Describes the type of resource it is
 * @param {string} name  - Contains the name of the resource
 * @returns {number|null} Possible values:
 *    -2  - Resource was not successfully installed
 *    -1  - Resource definition not found
 *    0   - Resource installed successfully
 *    1   - Resource already installed
 * @throws Gulp exception if bright command fails
 */
function installModifyResource(type, name) {
  // TODO update to use CICS plugin - state: not used for now
  const temp = brightUtils.issueCommand([
    'cics',
    'issue',
    'modify',
    `"CEDA INSTALL ${type}(${name}) GROUP(${props.brightside.cics.group})"`,
    '--cics-p',
    cicsProfile
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = `An error occurred while installing resource: ${name} type: ${type}`;
    console.error(err);
    console.error(temp);

    common.throwError('setResourceState', err);
  }

  if (temp.stdout.search(new RegExp('.*?(does not contain|not found).*?', 'i')) >= 0) {
    /*
     * console.log('Resource definition not found');
     * console.log(temp.stdout);
     */
    return -1;
  }

  if (temp.stdout.search(new RegExp('.*?(unsuccessful|commands with errors cannot be executed).*?', 'i')) >= 0) {
    console.log('Resource installation unsuccessful');
    console.log(temp.stdout);
    return -2;
  }

  if (temp.stdout.search(new RegExp('INSTALL SUCCESSFUL', 'i')) >= 0) {
    /*
     * console.log('Resource installed successfully');
     * console.log(temp.stdout);
     */
    return 0;
  }

  if (temp.stdout.search(new RegExp('duplicate', 'i')) >= 0) {
    /*
     * console.log('Resource already installed');
     * console.log(temp.stdout);
     */
    return 1;
  }

  // in case something unexpected happened
  console.log(temp);
  return null;
}

/**
 * Installs the given resource
 * @param {string} type     - Describes the type of resource it is
 * @param {string} name     - Contains the name of the resource
 * @param {...string} parms - Contains the parameters to pass to brightside
 * @returns {number|null} Possible values:
 *    -2  - Resource was not successfully installed
 *    -1  - Resource definition not found
 *    0   - Resource installed successfully
 *    1   - Resource already installed
 * @throws Gulp exception if bright command fails
 */
function installResource(type, name) {
  if (isResourceInstalled(type, name)) {
    return 1;
  }
  // TODO update to use CICS plugin - state: to test
  const temp = brightUtils.issueCommand([
    'cics',
    'install',
    type.toLowerCase(),
    name,
    props.brightside.cics.csd,
    '--region-name',
    props.brightside.cics.region
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = `An error occurred while installing resource: ${name} type: ${type}`;
    console.error(err);
    console.error(temp);
    common.throwError('installResource', err);
  }

  if (temp.stdout.search(new RegExp('does not contain', 'i')) >= 0) {
    /*
     * console.log('Resource definition not found');
     * console.log(temp.stdout);
     */
    return -1;
  }

  if (temp.stdout.search(new RegExp('unsuccessful', 'i')) >= 0) {
    console.log('Resource installation unsuccessful');
    console.log(temp.stdout);
    return -2;
  }

  if (temp.stdout.search(new RegExp('INSTALL SUCCESSFUL', 'i')) >= 0) {
    /*
     * console.log('Resource installed successfully');
     * console.log(temp.stdout);
     */
    return 0;
  }

  if (temp.stdout.search(new RegExp('duplicate', 'i')) >= 0) {
    /*
     * console.log('Resource already installed');
     * console.log(temp.stdout);
     */
    return 1;
  }

  // in case something unexpected happened
  console.log(temp);
  return null;
}

/**
 * Check if a resource is enabled
 * @param {string} type - Describes the type of resource it is
 * @param {string} name - Contains the name of the resource
 * @returns {boolean} Indicates if the resource is enabled
 * @throws Gulp exception if bright command fails
 */
function isResourceEnabled(type, name) {
  // TODO update to use CICS plugin - state: how to specify ENABLED?
  let temp;
  if(type.toLowerCase() === 'program') {
    temp = brightUtils.issueCommand([
      'cics',
      'get',
      'resource',
      'CICSProgram',
      '-c',
      `"PROGRAM=${name}"`,
      '--rft',
      'string',
      '--region-name',
      props.brightside.cics.region
    ]);
  }else if (type.toLowerCase() === 'transaction') {
    temp = brightUtils.issueCommand([
      'cics',
      'get',
      'resource',
      'CICSLocalTransaction',
      '-c',
      `"TRANID=${name}"`,
      '--rft',
      'string',
      '--region-name',
      props.brightside.cics.region
    ]);
  } else {
    common.throwError('isResourceInstalled', 'Unknown resource type: ' + type);
  }
  console.log('***isResourceEnabledReturnedObj: ');
  console.log(temp);
  // TODO change checking response logic
  if (!temp || temp.stderr) {
    const err = `An error occurred while checking resource: ${name} type: ${type}`;
    console.error(err);
    console.error(temp);

    common.throwError('isResourceEnabled', err);
  }
  if (temp.success){

  }else {

  }

  // Check if the CICS region is active
  if (temp.stdout.search(new RegExp('IEE341I', 'i')) >= 0) {
    common.throwError('isResourceEnabled', temp.stdout);
  }

  return temp.stdout.search(new RegExp('not found', 'i')) < 0;
}

/**
 * Check if a resource is installed
 * @param {string} type Describes the type of resource it is
 * @param {string} name Contains the name of the resource
 * @returns {boolean} Indicates if the resource is installed
 * @throws Gulp exception if bright command fails
 */
function isResourceInstalled(type, name) {
  // TODO update to use CICS plugin - state: to test
  let temp;
  if(type.toLowerCase() === 'program') {
    temp = brightUtils.issueCommand([
      'cics',
      'get',
      'resource',
      'CICSProgram',
      '-c',
      `"PROGRAM=${name}"`,
      '--rft',
      'string',
      '--rff',
      'status',
      '--region-name',
      props.brightside.cics.region
    ]);
  }else if (type.toLowerCase() === 'transaction') {
    temp = brightUtils.issueCommand([
      'cics',
      'get',
      'resource',
      'CICSLocalTransaction',
      '-c',
      `"TRANID=${name}"`,
      '--rft',
      'string',
      '--rff',
      'status',
      '--region-name',
      props.brightside.cics.region
    ]);
  } else {
    common.throwError('isResourceInstalled', 'Unknown resource type: ' + type);
  }
  console.log('isResourceInstalledReturnedObj: ');
  if (!temp || !temp.success || temp.stderr) {
    const err = `An error occurred while checking resource: ${name} type: ${type}`;
    console.error(err);
    console.error(temp);

    common.throwError('isResourceInstalled', err);
  }

  // Check if the CICS region is active
  if (temp.stdout.search(new RegExp('IEE341I', 'i')) >= 0) {
    common.throwError('isResourceEnabled', temp.stdout);
  }

  return temp.stdout.search(new RegExp('not found', 'i')) < 0;
}

/**
 * Prepares a given resource using the following steps:
 *  1. Check if the resource is available (i.e. enabled)
 *  2. If resource not enabled, try to enable it.
 *  3. If resource not found, try to install it.
 *      a. Then enable it.
 *  4. If resource not defined, try to define it.
 *      a. Then install it.
 *      b. Then enable it.
 * @param {string}    type     - Type of resource to prepare
 * @param {string}    name     - Name of the resource to prepare
 * @param {...string} parms    - Additional parameters in case we need to define the resource
 */
function prepareResource(type, name, ...parms) {
  const taskName = 'prepareResource';
  console.log(`Check if the ${type}: ${name} is available...`);
  if (!isResourceEnabled(type, name)) {
    console.log(`${type}: ${name} not enabled. Try to enable it...`);
    let rc = setResourceState(type, name, 'enabled');
    if (rc === -2) { // JVM Server not found
      console.log(`${type}: ${name} not found. Try to install it...`);
      rc = installResource(type, name);

      if (rc === -1) { // Resource definition not found
        console.log(`${type}: ${name} definition not found! Try to define it...`);
        rc = defineResource(type, name, parms.join(' '));

        if (rc > 4) {
          common.throwError(taskName, `${type}: ${name} failed to be defined!`);
        }
        console.log(`${type}: ${name} successfully defined! Try to install it...`);
        rc = installResource(type, name);
      }

      if(rc === -2) { // Resource failed to install
        common.throwError(taskName, `${type}: ${name} failed to install!`);
      }
      console.log(`${type}: ${name} successfully installed! Try to enable it...`);
      rc = setResourceState(type, name, 'enabled');
    }

    if (rc === -1) {
      common.throwError(taskName, `${type}: ${name} not enabled`);
    }
  }
  console.log(`${type}: ${name} is enabled!`);
}

/**
 * Refresh a program to CICS. Used after a program has been rebuilt.
 *
 * @param {string} pgmName The name of the program.
 * @throws Gulp exception if bright command fails
 *
 * @returns {number} Possible values:
 *     0  - Program refreshed successfully
 *    -1  - Program not found
 *    -2  - Refresh failed
 */
function refreshProgram(pgmName) {
  // TODO update to use CICS plugin - state: to test
  const bsResult = brightUtils.issueCommand([
    'cics',
    'refresh',
    'program',
    pgmName,
    props.brightside.cics.region
  ]);
  if (!bsResult || !bsResult.success || bsResult.stderr) {
    const err = `An error occurred while refreshing program: ${pgmName}`;
    console.error(err);
    console.error(bsResult);
    common.throwError('isResourceInstalled', err);
  }

  // the results look good
  if (bsResult.stdout.search(/Progtype\(Program\)[\s\S]*Status\([\s\S]*NORMAL/im) >= 0) {
    return 0;
  }

  if (bsResult.stdout.search(new RegExp('NOT FOUND', 'i')) >= 0) {
    console.error(`Program = "${pgmName}" was not found.\n${bsResult.stdout}`);
    return -1;
  }

  // we got an error that we do not know about
  console.error(`Refresh of program "${pgmName}" failed with this error:\n${bsResult.stdout}`);
  return -2;
}

/**
 * Set the resource state
 * @param {string} type Describes the type of resource it is
 * @param {string} name Contains the name of the resource
 * @param {string} state='enabled'|'disabled' - Contains the desired state of the resource
 * @returns {number} Possible values:
 *    -2  - Resource not found
 *    -1  - Resource state not changed
 *    0   - Resource state changed successfully
 * @throws Gulp exception if bright command fails
 */
function setResourceState(type, name, state) {
  if (!isResourceInstalled(type, name)) {
    return -2;
  }
  // TODO update to use CICS plugin - state: to test
  const temp = brightUtils.issueCommand([
    'console',
    'issue',
    'cmd',
    `"MODIFY ${props.brightside.cics.region},CEMT SET ${type}(${name}) ${state.toUpperCase()}"`
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = `An error occurred while setting resource: ${name} type: ${type} state: ${state}`;
    console.error(err);
    console.error(temp);

    common.throwError('setResourceState', err);
  }

  let rc = -2;
  if (isResourceEnabled(type, name)) {
    rc = (state.toLowerCase() === 'enabled' ? 0 : -1);
  } else {
    rc = (state.toLowerCase() === 'disabled' ? 0 : -1);
  }

  if (rc < 0) {
    console.log('Resource state not changed');
    console.log(temp.stdout);
  }

  return rc;
}

/**
 * Submits a DFHCSDUP statemnt
 * @param {string} statement - Statement to submit
 * @returns {number} Possible values:
 *    x   - Value of the Highest Return Code
 *          0     - Success
 *          4     - Success with warnings
 *          x > 4 - Failure
 * @throws Gulp exception if bright command fails
 */
function submitDfhcsdupStatement(statement) {
  // TODO update to use CICS plugin
  const temp = brightUtils.issueCommand([
    'cics',
    'submit',
    'dfhcsdup',
    '--statement',
    `"${statement}"`,
    '--cics-p',
    cicsProfile
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = `An error occurred while submiting statment: ${statement}`;
    console.error(err);
    console.error(temp);
    common.throwError('submitDfhcsdupStatement', err);
  }

  const str = 'HIGHEST RETURN CODE WAS: ';
  const idx = temp.stdout.search(new RegExp(str, 'i'));
  const rc = parseInt(temp.stdout.substr(idx + str.length, temp.stdout.indexOf('\n', idx) - (idx + str.length)));

  if (rc !== 0) {
    console.log(temp.stdout);
  }
  return rc;
}

/**
 * Defines a CICS program
 * @param {string} name - program name to define
 * @returns {number} Possible values:
 *    x   - Value of the Highest Return Code
 *    0     - Success
 *    4     - Success with warnings
 *    x > 4 - Failure
 * @throws Gulp exception if bright command fails
 */
function defineProgram(name) {
  // TODO update to use CICS plugin - state: to test
  const temp = brightUtils.issueCommand([
    'cics',
    'define',
    'program',
    name,
    props.brightside.cics.csd,
    '--region-name',
    props.brightside.cics.region
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = `An error occurred while defining program: ${name}`;
    console.error(err);
    console.error(temp);
    common.throwError('submitDfhcsdupStatement', err);
  }

  const str = 'HIGHEST RETURN CODE WAS: ';
  const idx = temp.stdout.search(new RegExp(str, 'i'));
  const rc = parseInt(temp.stdout.substr(idx + str.length, temp.stdout.indexOf('\n', idx) - (idx + str.length)));

  if (rc !== 0) {
    console.log(temp.stdout);
  }
  return rc;
}

/**
 * Defines a CICS transaction
 * @param {string} transactionName - transaction name to define
 * @param {string} programName - program in which to define the transaction
 * @returns {number} Possible values:
 *    x   - Value of the Highest Return Code
 *    0     - Success
 *    4     - Success with warnings
 *    x > 4 - Failure
 * @throws Gulp exception if bright command fails
 */
function defineTransaction(transactionName, programName) {
  // TODO update to use CICS plugin - state: to test
  const temp = brightUtils.issueCommand([
    'cics',
    'define',
    'transaction',
    transactionName,
    programName,
    props.brightside.cics.csd,
    '--region-name',
    props.brightside.cics.region
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = `An error occurred while defining transaction: ${transactionName}`;
    console.error(err);
    console.error(temp);
    common.throwError('submitDfhcsdupStatement', err);
  }

  const str = 'HIGHEST RETURN CODE WAS: ';
  const idx = temp.stdout.search(new RegExp(str, 'i'));
  const rc = parseInt(temp.stdout.substr(idx + str.length, temp.stdout.indexOf('\n', idx) - (idx + str.length)));

  if (rc !== 0) {
    console.log(temp.stdout);
  }
  return rc;
}

module.exports = {
  defineResource         : defineResource,
  deleteResource         : deleteResource,
  discardResource        : discardResource,
  defineTransaction      : defineTransaction,
  defineProgram          : defineProgram,
  installModifyResource  : installModifyResource,
  installResource        : installResource,
  isResourceEnabled      : isResourceEnabled,
  isResourceInstalled    : isResourceInstalled,
  prepareResource        : prepareResource,
  refreshProgram         : refreshProgram,
  setResourceState       : setResourceState,
  submitDfhcsdupStatement: submitDfhcsdupStatement
};
