// build tasks related to java deployed on the mainframe

const common = require('../common/common');
const brightUtils = require('../common/brightside/utils');
const brightProv = require('../common/brightside/provisioning');
const gulp = common.gulp;

const props = common.loadConfigProperties();
const flags = require('../common/flags');

gulp.task('deprovision', 'Deprovisions the given instance', [], async() => {
  const args = flags.get();
  await deprovisionInstance(args.id, args.instance);
}, {
  options: {
    'id <instance_ID>': 'Specify the id of the instance to deprovision. (Assumes "' + props.properties + '" exists). ' +
      'Default: ' + props.provisioning.instanceID,
    'instance <instance_name>': 'Specify the name of the instance to deprovision. Overrides the ID'
  }
});

/**
 * Deprovisions an instance
 * @param {string} paramID       - Contains the id of the instance to deprovision
 * @param {string} paramInstance - Contains the instance name
 */
async function deprovisionInstance(paramID, paramInstance) {
  // Can't overwrite the input parameters
  let id = paramID;
  let instance = paramInstance;

  if (!instance || instance === true) {
    if (!id || id === true) {
      id = props.provisioning.instanceID;
      instance = brightProv.getInstanceName(id);
      if (!instance) {
        common.throwError('deprovisionInstance', 'Instance not specified. Please specify the instance to deprovision');
      }
    } else {
      instance = brightProv.getInstanceName(id);
      if (!instance) {
        common.throwError('deprovisionInstance', 'ID: ' + id + ' not found');
      }
    }
  }

  console.log('Try to deprovision instance:', instance);
  let temp = brightUtils.issueCommand([
    'provisioning',
    'perform',
    'action',
    instance,
    'deprovision',
    '--zosmf-p',
    brightUtils.profiles.zosmf
  ]);
  let instanceFound = true;
  // Check if it did not succeed
  if (!temp || !temp.success || temp.stderr || temp.stdout.indexOf('did not succeed') >= 0) {
    if (temp.stdout.indexOf('No instances found') >= 0) {
      instanceFound = false;
    } else {
      console.log('Please check the log');
      console.error(temp.stderr);
      common.throwError('deprovisionInstance', 'An error occurred while deprovisioning: ' + instance);
    }
  }

  if (instanceFound) {
    /*
     * Loop that checks to see if the deprovision action completed
     * If it does not, then we will tray again, and again...
     */
    for(
      let instanceInfo = {state: 'being-deprovisioned'};
      instanceInfo !== null;
      instanceInfo = brightProv.getInstanceInfo(instance)
    ) {
      // Check if it failed, so that we can try deprovisioning again
      if (instanceInfo && instanceInfo.state.indexOf('fail') >= 0) {
        console.log('Regular failure. Trying again...');
        temp = brightUtils.issueCommand([
          'provisioning',
          'perform',
          'action',
          instance,
          'deprovision',
          '--zosmf-p',
          brightUtils.profiles.zosmf
        ]);
        // Check if it did not succeed
        if (!temp || !temp.success || temp.stderr || temp.stdout.indexOf('did not succeed') >= 0) {
          console.log('Please check the log');
          console.error(temp.stderr);
          common.throwError('deprovisionInstance', 'An error occurred while deprovisioning: ' + instance);
        }
      }

      console.log('Checking the state of the instance ' + instance + ' ...');
      console.log('Instance:', instance, 'state:', instanceInfo.state);

      await common.sleep(brightProv.PROVISION_SLEEP);
    }
    console.log('Instance ' + instance + ' successfully deprovisioned');
  } else {
    console.log('Instance ' + instance + ' not provisioned');
  }
}
