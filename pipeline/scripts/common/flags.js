const {isDefined} = require('./utils');
const colors = require('gulp-util').colors;

let argvAlreadyLoaded = false;
let argv = null;

/**
 * This function checks if all the specified flags are missing in the arguments. Useful to set defaults in certain
 * conditions.
 *
 * @param {...string} checkFlags String flags to check
 * @returns {boolean} True if all the flags were not passed and false if at least one is defined.
 */
exports.areFlagsMissing = (...checkFlags) => {
  const flags = exports.get();

  // Check if each flag is defined and return false on the first one
  for (const flag of checkFlags) {
    if (isDefined(flags[flag])) {
      if (flags.verbose) {
        console.log(
          `${colors.magenta.bold((flag.length === 1 ? '-' : '--') + flag)} was passed so areFlagsMissing returns false`
        );
      }

      return false;
    }
  }

  return true;
};

/**
 * Get the arguments passed through the command line (- and -- flags).
 *
 * @returns {Object} A JSON object provided by yargs
 */
exports.get = () => {
  // Check if the static function variable argvAlreadyLoaded is set to true.
  if (argvAlreadyLoaded) {
    return argv;
  }

  // Set the static variables and return the yargs.argv variable
  argvAlreadyLoaded = true;
  argv = require('yargs').argv;

  return argv;
};

/**
 * This function gets the value of the first alias found for a flag.
 *
 * @param {string[]} flagAliases An array of aliases for the flag
 * @param {*} [defaultValue=false] The default value for the flag. This value is used to type guard the flag input
 * @returns {*} The value of the flag or the default if it did not exist
 *
 * @throws Error when a type mismatch is detected for a flag.
 */
exports.getFlag = (flagAliases, defaultValue = false) => {
  const flags = exports.get();

  // Check each alias
  for (const alias of flagAliases) {
    if (isDefined(flags[alias])) {
      // Check that the flag is of the expected type
      if (typeof flags[alias] === typeof defaultValue) {
        return flags[alias];
      } else {
        console.error(`Invalid type for argument ${colors.yellow.bold((alias.length === 1 ? '-' : '--') + alias)}!`);
        console.error('  Expected: ', colors.cyan(`<${typeof defaultValue}>`));
        console.error('  Received: ', colors.cyan(`<${typeof flags[alias]}>`));
        throw new Error('Invalid Argument Flag');
      }
    }
  }

  if (flags.verbose) {
    let outputValue = defaultValue;
    if (typeof defaultValue === 'string') {
      outputValue = `'${defaultValue}'`;
    }

    console.log();
    console.group();
    console.log(
      'Flag         :', colors.magenta.bold.bold((flagAliases[0].length === 1 ? '-' : '--') + flagAliases[0])
    );
    console.log(
      'Using Default:', colors.cyan.bold(outputValue)
    );
    console.groupEnd();
    console.log();
  }

  // Reaching here means that the default value should be used
  return defaultValue;
};

module.exports = exports;
