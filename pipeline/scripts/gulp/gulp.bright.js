const common = require('../common/common');
const pluginError = common.generatePluginError('bright');
const gulp = common.gulp;
const prompt = require('prompt');
const colors = require('gulp-util').colors;
const brightUtils = require('../common/brightside/utils');

const {isFalsy} = require('../common/utils');

const flags = require('../common/flags');
const props = common.loadConfigProperties();

gulp.task('bright', 'Tasks used to configure and submit simple Brightside commands.', async() => {
  const args = flags.get();

  if (args.init) {
    await initialize();
  }
}, {
  options: {
    init:
      'Initialize the Brightside environment using properties in gulp.properties.yaml',
    'reject-unauthorized':
      'Initialize Brightside to reject unauthorized connections. Default: false [Aliases: --ru]',
    'username <string>':
      'The username to associate with the Brightside profiles. Must be used in conjunction with --password.',
    'password <string>':
      'The password associated with the username specified. Must be used in conjunction with --username.'
  }
});

/**
 * Logs that the profile was creates successfully
 * @param {string} profile The profile that was created
 */
function logProfileSuccess(profile) {
  console.log('Successfully created ', colors.green.bold(profile));
}

/**
 * Initialize task for Brightside environment
 * @returns {Promise<void>} A promise that resolves when initialization is done
 */
function initialize() {
  return new Promise(resolve => {
    const args = flags.get();

    // Default is false
    const rejectUnauthorized = !!args['reject-unauthorized'] || !!args.ru;

    // Optional, but if one is set the other must be set
    const username = args.username;
    const password = args.password;

    console.log(colors.yellow.bold('\nThe following brightside profiles will be overwritten by this function:'));
    console.log(colors.white('  cics:    ') + colors.cyan.bold(brightUtils.profiles.cics));
    console.log(colors.white('  db2:     ') + colors.cyan.bold(brightUtils.profiles.db2));
    console.log(colors.white('  endevor: ') + colors.cyan.bold(brightUtils.profiles.endevor));
    console.log(colors.white('  tso:     ') + colors.cyan.bold(brightUtils.profiles.tso));
    console.log(colors.white('  zosmf:   ') + colors.cyan.bold(brightUtils.profiles.zosmf));

    /**
     * This function is responsible for creating profiles
     * @param {Object} [err] An error that is returned. Follows the prompt format.
     * @param {Object} [result] The values of the prompt. In this case username and password. If one of the two
     *                          properties are absent, then the script will abort.
     * @param {string} [result.username] The username to create profiles for.
     * @param {string} [result.password] The password that corresponds to the username.
     */
    const createProfiles = (err, result) => {
      if (
        typeof result !== 'undefined' &&
        typeof result.username !== 'undefined' &&
        typeof result.password !== 'undefined'
      ) {
        console.log();

        // Initialize the zosmf profile
        console.log('\nCreating a z/OSMF profile');
        console.log(colors.cyan(rejectUnauthorized ?
          'Rejecting unauthorized connections' :
          'Accepting unauthorized connections'));

        brightUtils.issueCommand([
          'profiles',
          'create',
          'zosmf',
          brightUtils.profiles.zosmf,
          '--host',
          props.system.host,
          '--port',
          props.system.port,
          '--user',
          result.username,
          '--password',
          result.password,
          '--reject-unauthorized',
          rejectUnauthorized,
          '--overwrite'
        ]);
        logProfileSuccess(brightUtils.profiles.zosmf);
        brightUtils.setDefaultProfile('zosmf', brightUtils.profiles.zosmf);

        // Initialize the TSO profile
        console.log('\nCreating a TSO profile');
        brightUtils.issueCommand([
          'profiles',
          'create',
          'tso',
          brightUtils.profiles.tso,
          '--account',
          props.system.account,
          '--overwrite'
        ]);
        logProfileSuccess(brightUtils.profiles.tso);
        brightUtils.setDefaultProfile('tso', brightUtils.profiles.tso);


        // Initialize the CICS profile
        const cics = props.brightside.cics;
        console.log('\nCreating a CICS profile');
        brightUtils.issueCommand([
          'profiles',
          'create',
          'cics',
          brightUtils.profiles.cics,
          '--host',
          props.brightside.cics.host,
          '--port',
          props.brightside.cics.port,
          '--user',
          result.username,
          '--password',
          result.password,
          '--region-name',
          cics.region,
          '--overwrite'
        ]);
        logProfileSuccess(brightUtils.profiles.cics);
        brightUtils.setDefaultProfile('cics', brightUtils.profiles.cics);


        // Initialize the DB2 profile
        const db2 = props.brightside.db2;
        console.log('\nCreating a DB2 profile');
        brightUtils.issueCommand([
          'profiles',
          'create',
          'db2',
          brightUtils.profiles.db2,
          '--hostname',
          db2.host,
          '--port',
          db2.port,
          '--username',
          result.username,
          '--password',
          result.password,
          '--database',
          db2.database,
          '--overwrite'
        ]);
        logProfileSuccess(brightUtils.profiles.db2);
        brightUtils.setDefaultProfile('db2', brightUtils.profiles.db2);

        // Initialize the Endevor profile
        const endevor = props.brightside.endevor;
        console.log('\nCreating a Endevor profile');
        brightUtils.issueCommand([
          'profiles',
          'create',
          'endevor',
          brightUtils.profiles.endevor,
          '--hostname',
          endevor.hostname,
          '--port',
          endevor.port,
          '--username',
          result.username,
          '--password',
          result.password,
          '--overwrite'
        ]);
        logProfileSuccess(brightUtils.profiles.endevor);
        brightUtils.setDefaultProfile('endevor', brightUtils.profiles.endevor);
      } else {
        throw pluginError(colors.red.bold('Brightside Initialization Aborted'));
      }

      console.log('Brightside Initialization Complete');

      resolve();
    };

    // Check that both username and password are falsy
    if (isFalsy(username, password)) {
      console.log('\nIf you do not wish to overwrite these profiles, please press Ctrl+C to exit this script.\n');

      const properties = [
        {
          description: colors.yellow(`Username for ${props.system.host}`),
          name       : 'username',
          required   : true
        },
        {
          description: colors.yellow(`Password for ${props.system.host}`),
          name       : 'password',
          required   : true,
          hidden     : true
        }
      ];

      prompt.message = '';
      prompt.delimiter = colors.white(':');

      // Start the prompt
      prompt.start();

      // Get two properties from the user
      prompt.get(properties, createProfiles);

      // Ensures that both username and password are a string
    } else if(typeof username === 'string' && typeof password === 'string') {
      // Call this function with the passed username and password
      createProfiles(null, {
        username: username,
        password: password
      });
    } else {
      // Call this function with nothing to hit the error case and abort.
      console.error();
      console.error(colors.red.bold('Invalid usage of --username and --password flags.'));
      console.error('');
      console.error('Usage:');
      console.error(
        `  ${colors.white.bold('gulp bright --init')} ${
          colors.yellow.bold('--username')} ${colors.cyan.bold('string')} ${
          colors.yellow.bold('--password')} ${colors.cyan.bold('string')}`
      );
      console.error();

      throw pluginError(colors.red.bold('Invalid Arguments'));
    }
  });
}
