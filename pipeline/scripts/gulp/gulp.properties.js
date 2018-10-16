/**
 * This file represents the gulp task to get properties.
 *
 */
const common = require('../common/common');
const props = common.loadConfigProperties();
const gulp = common.gulp;
const flags = require('../common/flags');

gulp.task('properties', 'Get properties', [], () => {
  const args = flags.get();

  if (args.instance) {
    console.log(props.was.instanceName);
  }
  if (args.template) {
    console.log(props.was.template);
  }
  if (args.id) {
    console.log(props.was.instanceID);
  }
  if (args.WASProperties) {
    console.log(props.was.propertiesPath);
  }
}, {
  options: {
    user         : '',
    pass         : '',
    instance     : '',
    template     : '',
    id           : '',
    WASProperties: ''
  }
});
