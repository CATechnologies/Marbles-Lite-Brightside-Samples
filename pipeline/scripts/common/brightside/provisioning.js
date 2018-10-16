const brightUtils = require('./utils');
const common = require('../common');

/**
 * Time in milliseconds in which we will check again for the state of a Provisioning command/action
 * @type {number}
 */
const PROVISION_SLEEP = 10000; // 10 seconds

/**
 * Utility to create a profile from an instance ID
 * @param {string} instanceName The name of the provisioned instance
 * @param {string} objectId The object instance id (UUID of the registry instance)
 *
 * @returns {string} The name of the created profile.
 */
function createCicsProfileFromInstance(instanceName, objectId) {
  const props = common.loadConfigProperties();
  const profileName = `${instanceName}-${objectId}`;

  console.log('Creating CICS profile: ' + profileName + ' ...');

  let temp = null;

  for (let insanity = true, idx = 1; insanity; idx++) {
    console.log('Attempt #' + idx.toString());
    temp = brightUtils.issueCommand([
      'cics',
      'create',
      'profile-from-instance',
      objectId,
      '--overwrite',
      '--default-resource-group',
      props.brightside.cics.group,
      '--bright-profile-name',
      profileName
    ]);

    if (temp && temp.stdout.indexOf('Profile created successfully') >= 0) {
      /**
       * There MUST be a bug in the BrightSide (v0.6.5-3 and v0.6.5-18) with the creation of the CICS profile
       * Here is what BrightSide returns.
       *
       *  success: false,
       *  message: '',
       *  stdout: 'Profile created successfully.: /root/.brightside/profiles/cics/
       *          CICS_MARBLE00-05e6af27-cdc5-4b04-ae9c-90ae3763a0db.yaml\n\n\n',
       *  stderr: 'An unexpected error occurred creating the profile:\nTypeError:
       *          Cannot convert undefined or null to object\n
       *     at Function.getOwnPropertyNames (<anonymous>)\n
       *     at Object.exports.getMaxIndexLength (/usr/lib/node_modules/brightside/node_modules/prettyjson/
       *        lib/utils.js:16:10)\n
       *     at renderToArray (/usr/lib/node_modules/brightside/node_modules/prettyjson/lib/prettyjson.js:141:52)\n
       *     at /usr/lib/node_modules/brightside/node_modules/prettyjson/lib/prettyjson.js:118:11\n
       *     at Array.forEach (<anonymous>)\n
       *     at renderToArray (/usr/lib/node_modules/brightside/node_modules/prettyjson/lib/prettyjson.js:99:10)\n
       *     at /usr/lib/node_modules/brightside/node_modules/prettyjson/lib/prettyjson.js:169:9\n
       *     at Array.forEach (<anonymous>)\n
       *     at renderToArray (/usr/lib/node_modules/brightside/node_modules/prettyjson/lib/prettyjson.js:145:36)\n
       *     at Object.render (/usr/lib/node_modules/brightside/node_modules/prettyjson/lib/prettyjson.js:210:10)\n'
       *  responseObject: ...
       */

      // if it succeeded, let it continue. (no more insanity for now)
      if (temp.success) {
        insanity = false;
        console.log('Number of times we ran the same command:', idx);
      } else {
        brightUtils.setDefaultProfile('cics', props.brightside.defaultName + '-cics');
      }
    } else if (!temp || !temp.success || temp.stderr) {
      console.error(JSON.stringify(temp));
      common.throwError('createCicsProfileFromInstance', 'An error occurred while creating profile');
    }
  }

  console.log(temp.stdout);
  console.log(`Profile ${profileName} successfully created!`);
  brightUtils.setDefaultProfile('cics', profileName);

  return profileName;
}

/**
 * Execute an action on a provisioned instance. Available actions can be retrieved by executing
 * bright provisioning list instance-info <instance_name>
 *
 * @param {string} instance The name of the instance to action
 * @param {string} action   The action to perform
 * @returns {boolean} True if success, false if not
 */
function executeAction(instance, action) {
  const result = brightUtils.issueCommand([
    'provisioning',
    'perform',
    'action',
    instance,
    action,
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ]);

  return result && result.success;
}

/**
 * Get details of the instance and return them in a JSON object
 *
 * @param {string} instanceName The name of the instance provisioned by BrightSide.
 *
 * @returns {Object} A JSON object of all instance properties. Currently this object is null
 *                   if there are no variables set or an error happened while executing the command.
 */
function getInstanceDetails(instanceName) {
  if (!instanceName) {
    return null;
  }

  // Issue the command to get the provisioned instance variables
  const result = brightUtils.issueCommand([
    'provisioning',
    'list',
    'instance-variables',
    instanceName,
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ]);

  let details = null;

  if (result && result.success) {
    // We will be modifying this object
    details = {};

    // Map the results to a JSON object
    result.data.forEach(element => {
      details[element.name] = element.value;
    });
  }

  return details;
}

/**
 * Get details of the instance and return them in a JSON object
 *
 * @param {string} instanceName The name of the instance provisioned by BrightSide.
 * @returns {Object} A JSON object with instance information
 */
function getInstanceInfo(instanceName) {
  if (!instanceName) {
    return null;
  }

  const temp = brightUtils.issueCommand([
    'provisioning',
    'list',
    'instance-info',
    instanceName,
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ]);
  if (!temp || !temp.success || temp.stderr) {
    if (temp.stdout.indexOf('No instances found') >= 0) {
      console.log('Instance nor found:', instanceName);
      return null;
    } else {
      console.log(temp.stderr);
      console.log(`An error occurred while getting information for instance: ${instanceName}`);
      return null;
    }
  }

  return temp.data;
}

/**
 * Obtain the name of the provisioned instance
 *
 * @param {string} id - The ID of the instance to retrive from the generated properties file
 * @returns {Object} the instance name or null
 */
function getInstanceName(id) {
  const gProps = common.loadGenProperties();
  if (gProps && gProps.instances && gProps.instances[id]) {
    return gProps.instances[id].name;
  }
  return null;
}

/**
 * Gather information about a given job if it's active
 *
 * NOTE: This function assumes default bright profiles (zos-jobs)
 *
 * @param {string} jobName - Name of the job to search for
 * @returns {Object} Contains information about the given job
 */
function getActiveJobInfo(jobName) {
  if (!jobName || jobName.length === 0) {
    return null;
  }

  const temp = brightUtils.issueCommand([
    'zos-jobs',
    'list',
    'jobs',
    '--prefix',
    jobName,
    '--owner',
    '"*"',
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ]);
  if (!temp || !temp.success || temp.stderr) {
    console.log(temp.stderr);
    console.log(`An error occurred while getting information about the job: ${jobName}`);
    return null;
  }

  let retValue;
  temp.data.forEach(jobRecord => {
    if (jobRecord.status === 'ACTIVE') {
      retValue = jobRecord;
    }
  });

  return retValue;
}

/**
 * Get information about the provisioned template
 *
 * NOTE: This function assumes default bright profiles (zosmf)
 *
 * @param {string} templateName - Name of the template to search for
 * @returns {Object} Contains information about the given template
 */
function getProvisionedTemplate(templateName) {
  if (!templateName || templateName.length === 0) {
    return null;
  }

  const temp = brightUtils.issueCommand([
    'provisioning',
    'list',
    'registry-instances',
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ]);
  if (!temp || !temp.success || temp.stderr) {
    console.log(temp.stderr);
    console.log(`An error occurred while getting information about the template: ${templateName}`);
    return null;
  }

  let retValue;
  temp.data['scr-list'].forEach(templateRecord => {
    if (templateRecord['catalog-object-name'] === templateName && templateRecord.state === 'provisioned') {
      retValue = templateRecord;
    }
  });

  return retValue;
}

module.exports = {
  PROVISION_SLEEP              : PROVISION_SLEEP,
  createCicsProfileFromInstance: createCicsProfileFromInstance,
  executeAction                : executeAction,
  getInstanceDetails           : getInstanceDetails,
  getInstanceInfo              : getInstanceInfo,
  getInstanceName              : getInstanceName,
  getActiveJobInfo             : getActiveJobInfo,
  getProvisionedTemplate       : getProvisionedTemplate
};
