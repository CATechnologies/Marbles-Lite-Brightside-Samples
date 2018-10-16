const common = require('../common');
const flags = require('../flags');

const cp = require('child_process');
const colors = require('gulp-util').colors;
const yaml = require('yamljs');


const props = common.loadConfigProperties();
const zosmfP = props.brightside.defaultName;

/**
 * All the generated profile names based on the configuration file.
 *
 * @type {{zosmf: string, zos_jobs: string, db2: string, cics: string}}
 */
const profiles = {

  /**
   * The z/OSMF profile name.
   */
  zosmf: zosmfP,

  /**
   * The TSO profile name.
   */
  tso: `${zosmfP}-tso`,

  /**
   * The CICS profile name.
   */
  cics: `${zosmfP}-cics`,

  /**
   * The DB2 profile name.
   */
  db2: `${zosmfP}-db2`,

  /**
   * The Endevor profile name.
   */
  endevor: `${zosmfP}-endevor`
};

/**
 * Checks if the configuration of a BrightSide profile exists.
 *
 * @param {string} profileType A string that is equivalent to one of the keys in the profiles
 *                             object.
 *
 * @returns {boolean} True if the profile exists in BrightSide, false otherwise.
 */
function checkConfiguration(profileType) {
  const profile = profiles[profileType];

  if (profile) {
    console.log(`Checking if ${colors.cyan.bold(profile)} is a valid profile.`);

    const result = issueCommand([
      'profiles',
      'list',
      profileType,
      '--show-contents'
    ]);

    if (result && result.success) {
      const availableProfiles = yaml.parse(result.stdout);
      let foundMatch = false;

      // Loop through each profile found
      for (const p of availableProfiles) {
        // If this profile name matches the one we are looking for
        if (p.name === profile) {
          // Indicate a match was found and break out of this loop
          foundMatch = true;
          break;
        }
      }

      if (foundMatch) {
        console.log(colors.green.bold('GOOD'));
      } else {
        console.log(colors.red.bold('BAD'));
      }

      return foundMatch;
    } else {
      console.error(colors.red.bold('BrightSide Error!'));

      if (result && result.stderr) {
        console.error(result.stderr);
      }

      return false;
    }
  } else {
    console.error(colors.red(`${profileType} is not a valid BrightSide profile type.`));
    return false;
  }
}

/**
 * Checks if all the configurations are set.
 *
 * @param {string[]} profileTypes The profile types to check.
 *
 * @returns {boolean} True if all the profiles are set, false if one is not set.
 */
function checkConfigurations(profileTypes) {
  // Loop through each profile to check and exit on the first failure.
  for (let i = 0, len = profileTypes.length; i < len; i++) {
    if (!checkConfiguration(profileTypes[i])) {
      return false;
    }
  }

  // Making it here means all profiles must exist
  return true;
}

/**
 * Checks if a profile exists
 * @param {string} profileType - type of the profile
 * @param {string} profileName - name of the profile
 * @returns {*} NULL if error, Boolean indicating existence of the given profile
 */
function doesProfileExists(profileType, profileName) {
  const temp = issueCommand([
    'profiles',
    'list',
    profileType
  ]);
  if (!temp || !temp.success || temp.stderr) {
    console.log('ERROR: unable to check profiles');
    return null;
  }

  return temp.stdout.indexOf(profileName) >= 0;
}

/**
 * Execute an SQL file through BrightSide.
 *
 * @param {string} sqlFile The filepath of the SQL file to execute.
 *
 * @param {Object} options Options to pass to the function
 * @param {boolean} [options.checkSqlCode=false] Indicate if the raw response should be checked for
 *                                               errors. If set to true, the return value of this
 *                                               function will be an object with a property of
 *                                               success. (True meaning no errors, false meaning
 *                                               error)
 *
 * @returns {Object} The results of the command in JSON format.
 */
function executeSqlFile(sqlFile, options = {checkSqlCode: false}) {
  console.log(`Executing ${colors.cyan.bold(sqlFile)} through BrightSide`);

  const command = [
    'db2',
    'execute',
    'sql',
    '--file',
    sqlFile,
    '--db2-p',
    profiles.db2
  ];

  if (options.checkSqlCode) {
    // const results = issueCommand(command.concat('--raw'));
    const results = issueCommand(command);
    const returnVal = {success: true};

    if (results && results.success && results.stdout) {
      /*
       * This regular expression looks for the DSNT408I message on a line of the raw response.
       * This message indicates that the SQLCODE was negative (per IBM documentation) and negative
       * SQL codes indicate errors.
       *
       * Parsed using the documented IBM format:
       * DSNT408I SQLCODE = -sql-code, explanation
       *
       * 2 groups are created per line match:
       *
       * Group 1: -sql-code
       * Group 2: explanation
       */
      const regex = /^\s{2}DSNT408I\sSQLCODE\s=\s(-[0-9]+),\s(.*)$/gm;
      const match = regex.exec(results.stdout);

      if (match) {
        console.log(colors.red.bold('ERROR'));
        console.log();
        console.error(`  SQLCODE: ${colors.cyan.bold(match[1])}`);
        console.error(`  MESSAGE: ${colors.cyan.bold(match[2])}`);
        returnVal.success = false;
      } else {
        console.log(colors.green.bold('SUCCESS'));
      }
    } else {
      console.error(colors.red('BrightSide command failure'));
      returnVal.success = false;
    }

    return returnVal;
  } else {
    return issueCommand(command);
  }
}

/**
 * Issue a BrightSide commands and return the result object (or null)
 *
 * @param {string[]} args                 Arguments to the BrightSide command.
 * @param {boolean}  [noJsonObject=false] false means return a json object.
 *                                        true means return end-user-like screen output.
 * @param {string}   [stdinText]          Text that is to be feed into the standard input of the
 *                                        BrightSide command.
 *
 * @returns {Object} The output of the BrightSide command.
 */
function issueCommand(args, noJsonObject = false, stdinText = null) {
  const brightCommand = 'bright';
  const spawnOptions = {
    encoding                : 'utf8',
    env                     : process.env,
    windowsVerbatimArguments: true,
    shell                   : true
  };

  const verbose = flags.getFlag(['verbose']);
  const cmdArgs = args.concat(noJsonObject ? [] : ['--response-format-json']);

  // if our caller has supplied data for standard input, add it to our spawn options
  if (stdinText !== null) {
    spawnOptions.input = stdinText;
  }

  if (verbose) {
    console.log();
    console.log(colors.cyan('Executing BrightSide Command:'));
    console.log(`${brightCommand} ${cmdArgs.join(' ')}`);
    console.log();
  }

  const results = cp.spawnSync(
    brightCommand,
    cmdArgs,
    spawnOptions
  );

  /**
   * Return null if an error occurred
   */
  if (results.error) {
    console.error('An error occurred while issuing the BrightSide command: ', results.error);
    return null;
  }

  /**
   * Return the parsed json or null if an error occurrs
   */
  try {
    return noJsonObject ? results.stdout : JSON.parse(results.stdout);
  } catch (e) {
    console.error('An error occurred parsing the BrightSide command response: ', e);
    console.error('Returned results: ', results.stdout);
    return null;
  }
}

/**
 * Validate that the user has BrightSide installed.
 *
 * @returns {boolean} True if a valid BrightSide is installed.
 */
function validBrightSide() {
  const results = issueCommand(['--version']);
  if (results.stderr) {
    console.error(`An error occurred while checking if BrightSide is installed: ${results.stderr}`);
    return false;
  }

  /**
   * Validate that the version command completed successfully
   */
  if (!results.success) {
    console.error('Error! BrightSide must be installed an accessible (i.e. in your PATH).');
    console.error(`Stdout: ${results.stdout}`);
    console.error(`Stderr: ${results.stderr}`);
    console.error(`Errors: ${results.errors}`);
    return false;
  }

  return true;
}


/**
 * Utility to set the default profile for the group
 * @param {string} group The brightside CLI group where we are setting the default profile
 * @param {string} profileName The name of the profile to set as the default
 */
function setDefaultProfile(group, profileName) {
  console.log(`Setting default profile ${colors.cyan.bold(profileName)
  } in BrightSide group ${colors.magenta.bold(group)}`);

  const temp = issueCommand([
    'profiles',
    'set-default',
    group.toLowerCase(),
    profileName
  ]);

  // ensure the command succeeded
  if (!temp || !temp.success || temp.stderr) {
    console.error(temp.stderr);
    common.throwError(
      'setDefaultProfile',
      `An error occurred setting the default profile: ${profileName} for group: ${group}`
    );
  }
  console.log('Default Profile successfully set!');
}

module.exports = {
  profiles           : profiles,
  checkConfiguration : checkConfiguration,
  checkConfigurations: checkConfigurations,
  doesProfileExists  : doesProfileExists,
  executeSqlFile     : executeSqlFile,
  issueCommand       : issueCommand,
  validBrightSide    : validBrightSide,
  setDefaultProfile  : setDefaultProfile
};
