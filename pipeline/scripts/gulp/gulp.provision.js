// build tasks related to java deployed on the mainframe

const common = require('../common/common');
const brightUtils = require('../common/brightside/utils');
const brightProv = require('../common/brightside/provisioning');
const gulp = common.gulp;

const props = common.loadConfigProperties();
const flags = require('../common/flags');

gulp.task(
  'provision',
  'Provisions a given template with the specified properties in the given properties file',
  [],
  async() => {
    const args = flags.get();
    await provisionTemplate(args.id, args.template, args.properties);
  }, {
    options: {
      'id <instance_ID>': 'Specify the id for the instance to provision (e.g. WAS, CICS, DB2). ' +
        'Default: ' + props.provisioning.instanceID,
      'properties <file_path>'  : 'Specify the properties file to provision the given instance',
      'template <template_name>': 'Specify the template to provision. Default: ' + props.provisioning.template
    }
  }
);

/**
 * Provisions a template
 *
 * Sample output:
 * $ brightd provisioning prov template cics_53_db2_mq
 * {
 *   "registry-info": {
 *     "object-name": "CICS_177",
 *     "object-id": "a9a5165d-507d-4fb2-a734-cdd2877b312b",
 *     "object-uri": "/zosmf/provisioning/rest/1.0/scr/a9a5165d-507d-4fb2-a734-cdd2877b312b",
 *     "external-name": "CICS_MARBLE00",
 *     "system-nickname": "CA23"
 *  },
 *  "workflow-info": {
 *     "workflowKey": "7bfaa0ec-701d-416d-b05f-17f7b07f995b",
 *     "workflowDescription": "Procedure to provision a CICS Region",
 *     "workflowID": "ProvisionCICSRegion",
 *     "workflowVersion": "1.0",
 *     "vendor": "IBM"
 *  },
 *
 * @param {string} paramID         - Contains the id of the instance (e.g. CICS)
 * @param {string} paramTemplate   - Contains the template name
 * @param {string} properties      - Contains the name of the properties file to use with the provisioned template
 */
async function provisionTemplate(paramID, paramTemplate, properties) {
  // Can't overwrite the input parameters
  let id = paramID;
  let template = paramTemplate;

  // default values
  id = (id && id !== true ? id : props.provisioning.instanceID);
  template = (template && template !== true ? template : props.provisioning.template);

  console.log('Check if ' + template + ' was already provisioned...');
  const templateInfo = brightProv.getProvisionedTemplate(template);
  let instanceName;
  let objectId;

  if (templateInfo) {
    console.log('Template previoulsy provisioned: ' + template);
    instanceName = templateInfo['external-name'];
    objectId = templateInfo['object-id'];
  } else {
    console.log('Try to provision template:', template);
    const temp = brightUtils.issueCommand([
      'provisioning',
      'provision',
      'template',
      template,
      (properties ? '--properties-file ' + properties : ''),
      '--zosmf-p',
      brightUtils.profiles.zosmf
    ]);
    if (!temp || !temp.success || temp.stderr) {
      console.error(temp.stderr);
      common.throwError('provisionTemplate', 'An error occurred while provisioning: ' + template);
    }

    // Get the name of the provisioned instance and the IBM uuid
    instanceName = temp.data['registry-info']['external-name'];
    objectId = temp.data['registry-info']['object-id'];

    // Get the state of the provisioned instance
    let state = null;
    while(state !== 'provisioned') {
      console.log('Checking the state of the instance ' + instanceName + ' ...');
      await common.sleep(brightProv.PROVISION_SLEEP);
      const instanceInfo = brightProv.getInstanceInfo(instanceName);

      if (instanceInfo === null) {
        common.throwError('provisionTemplate', 'Instance not found: ' + instanceName);
      }

      state = instanceInfo.state;
      console.log('Instance:', instanceName, 'state:', state);

      if (state !== 'provisioned' && state !== 'being-provisioned') {
        common.throwError('provisionTemplate', 'An error occurred while provisioning: ' + template);
      }
    }

    // Log the success and create the profile from the instance
    console.log('Instance ' + instanceName + ' successfully provisioned');
  }

  console.log('Check if the provisioned region is active...');
  const instanceDetails = brightProv.getInstanceDetails(instanceName);
  let regionName;

  if (instanceDetails) {
    // DFH_REGION_APPLID is used by id=CICS template
    // JOB_NAME is used by id=WAS template
    regionName = instanceDetails.DFH_REGION_APPLID || instanceDetails.JOB_NAME;

    const jobInfo = brightProv.getActiveJobInfo(regionName);
    if (!jobInfo) {
      console.log('Region is not active. Trying to start it...');

      if (brightProv.executeAction(instanceName, 'start')) {
        console.log('Region ' + regionName + ' successfully started');
      } else {
        common.throwError('provisionTemplate', 'An error occurred while starting region: ' + regionName);
      }
    }
  } else {
    common.throwError('provisionTemplate', 'An error occurred while getting details for instance: ' + instanceName);
  }
  console.log('Provisioned region ' + regionName + ' is active');

  console.log('Updating/Creating the generated properties file...');
  const obj = {instances: {}};
  obj.instances[id] = {
    name    : instanceName,
    template: template,
    objectId: objectId
  };
  common.updateGenProperties(obj);
  console.log('Properties file updated/created');

  if (id === 'CICS') {
    brightProv.createCicsProfileFromInstance(instanceName, objectId);
  }
}
