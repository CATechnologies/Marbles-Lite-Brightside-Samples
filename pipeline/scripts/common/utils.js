const gutil = require('gulp-util');
const colors = gutil.colors;
const path = require('path');

/**
 * This callback is called with each param in the for loop. It should evaluate to true or false,
 * so that the _checkConditions function can properly determine if a conditional is true over
 * every object sent to the function.
 *
 * @callback checkConditionsCallback
 * @param {*} param The input to validate.
 * @returns {boolean} This is up to the individual implementor. However, returning a single false
 *                    will cause the _checkConditions function to evaluate to false. Only if all
 *                    callbacks evaluate to true will the _checkConditions function be true.
 */
/**
 * This function does a for loop over bunches of variables with a spot for checks. This check is
 * what differentiates functions that use this function. If any callback resolves to false, then
 * the entire result of this function is false
 *
 * @param {*[]} params A set of parameters to check. Must be an array format.
 * @param {checkConditionsCallback} callback The check function to execute.
 * @returns {boolean} True if all callbacks evaluate to true and false if one was false.
 * @private
 */
function _checkConditions(params, callback) {
  let success;

  // Loop through each parameter
  for (const param of params) {
    // Evaluate the callback for the given parameter.
    success = callback(param);

    // If success is false then exit out of the logic
    if (success === false) {
      break;
    }
  }

  // Check that success is a boolean
  if (typeof success !== 'boolean') {
    throw new Error('Improper usage of _checkConditions. Success was not a boolean!');
  }

  return success;
}

/**
 * Get the root directory of our NodeJs project.
 * @returns {string} full path to our project directory
 */
exports.getProjectRoot = () => path.resolve(__dirname, '../../');

/**
 * Check if variables are defined
 * @param {...*} variables The variables to check.
 * @returns {boolean} True if all variables are defined and false otherwise.
 */
exports.isDefined = (...variables) =>
  _checkConditions(variables, variable => typeof variable !== 'undefined');


/**
 * Check if variables are falsy.
 * @param {...*} variables The variables to check.
 * @returns {boolean} True if all variables are falsy and false otherwise.
 */
exports.isFalsy = (...variables) =>
  _checkConditions(variables, variable => !!variable === false);

/**
 * Check if variables are truthy.
 * @param {...*} variables The variables to check.
 * @returns {boolean} True if all variables are truthy and false otherwise.
 */
exports.isTruthy = (...variables) =>
  _checkConditions(variables, variable => !!variable === true);

/**
 * Check if variables are undefined.
 * @param {...*} variables The variables to check.
 * @returns {boolean} True if all variables are undefined and false otherwise.
 */
exports.isUndefined = (...variables) =>
  _checkConditions(variables, variable => typeof variable === 'undefined');

/**
 * This function is a utility function to log pass or fail for a gulp task tag.
 * @param {string} taskTag The task tag used to identify what passed or failed.
 * @param {boolean} passed The resulting boolean of the task to test. True indicates passing
 */
exports.logResultBoolean = (taskTag, passed) => {
  if (passed) {
    gutil.log(`${taskTag}: ${colors.green.bold('PASS')}`);
  } else {
    gutil.log(`${taskTag}: ${colors.red.bold('FAIL')}`);
  }
};

/**
 * This function will check the value of a return code and validate that it is good. Also good for logging results.
 *
 * @param {string} taskTag A tag used to identify what function is responsible for this return code
 * @param {number} rc The return code of the task
 * @param {number} [lowestRC=0] The lowest acceptable return code
 * @param {number} [highestRC=0] The highest acceptable return code
 * @returns {boolean} True if the return code passed in satisfies the range specified, false otherwise.
 */
exports.logResultRC = (taskTag, rc, lowestRC = 0, highestRC = 0) => {
  if (lowestRC <= rc && rc <= highestRC) {
    gutil.log(`${taskTag}: ${colors.green.bold('PASS')}`);
    return true;
  } else {
    let comparisonString = '';

    if (lowestRC === highestRC) {
      comparisonString = `      Must Be: ${colors.cyan.bold(lowestRC)}`;
    } else {
      comparisonString = ' Must Satisfy: ' + colors.cyan.bold(`${lowestRC} <= rc <= ${highestRC}`);
    }

    console.log();
    gutil.log(`Bad Return Code: ${colors.yellow.bold(rc)}`);
    gutil.log(`  ${comparisonString}`);
    console.log();
    // gutil.log(`  Acceptable Range: ${colors.cyan.bold(comparisonString)}`);
    gutil.log(`${taskTag}: ${colors.red.bold('FAIL')}`);
    console.log();
    return false;
  }
};

module.exports = exports;
