// A collection of common functions used by our gulp tasks.
const flags = require('./flags');
const fs = require('fs');
const gulp = require('gulp-help')(require('gulp'));
const gulpUtil = require('gulp-util');
const merge = require('deepmerge');
const yaml = require('yamljs');

/**
 * This function generates a function that can create gulp errors for a script file.
 * @param {string} plugin The name of the plugin
 * @returns {function(string)} A function that can be used to generate a plugin error.
 */
function generatePluginError(plugin) {
  /**
   * Create an error for the plugin defined by closure.
   * @param {string} message The message of the error.
   * @returns {PluginError} A gulp plugin error.
   */
  return function inner(message) {
    return new gulpUtil.PluginError(plugin, message);
  };
}

/**
 * Get the description of the current line of your script.
 * This is useful in error messages.
 *
 * @param {Error} newErrorObj
 *        A newly-created Error object. It should be created near the
 *        call to this function to make the line number accurate.
 *        The simplest use is like this:
 *          myLine = common.getMyLine(new Error());
 *
 * @returns {string} A string containing the description of your line.
 *         Its format is similar to this:
 *           at compileCobolMarbles (C:\ourstuff\prod\Marbles-Lite\scripts\gulp\gulp.cobol.js:54:17)
 */
function getMyLine(newErrorObj) {
  const myLineMatcher = /[^\n]*\n +([^\n]*)/;
  return myLineMatcher.exec(newErrorObj.stack)[1];
}

/**
 * Load the configuration properties for the Marbles application.
 *
 * @returns {Object} A JSON object representing configuration properties.
 */
function loadConfigProperties() {
  const PROPERTIES_FILE = './gulp.properties.yaml';

  /* only load proerties once, regardless of how many time we are asked */
  if (loadConfigProperties.propsAlreadyLoaded) {
    return loadConfigProperties.props;
  }

  loadConfigProperties.propsAlreadyLoaded = true;
  loadConfigProperties.props = yaml.load(PROPERTIES_FILE);
  if (!loadConfigProperties.props) {
    console.error(`common-fun:loadConfigProperties: Failed to read properties from ${PROPERTIES_FILE}`);
    return null;
  }
  return loadConfigProperties.props;
}

/**
 * Load the generated properties for the Marbles application.
 *
 * @returns {Object} A JSON object representing generated properties.
 */
function loadGenProperties() {
  const PROPERTIES_FILE = loadConfigProperties().properties;

  /* only load proerties once, regardless of how many time we are asked */
  if (loadGenProperties.propsAlreadyLoaded) {
    return loadGenProperties.props;
  }

  loadGenProperties.props = null;
  if (fs.existsSync(PROPERTIES_FILE)) {
    loadGenProperties.propsAlreadyLoaded = true;
    loadGenProperties.props = require(`../../${PROPERTIES_FILE}`);
  }

  return loadGenProperties.props;
}

/**
 * Replace the variables in text file with associated values.
 *
 * @param {string} fileName The name of the file containing text with variables.
 * @param {Object} varToValMap A map of variable names to values.
 *
 * @returns {string} A new string with the all of the variable replaced with their values.
 *
 */
function replaceVarsInFile(fileName, varToValMap) {
  const templateString = fs.readFileSync(fileName, 'utf8');
  return replaceVarsInString(templateString, varToValMap);
}

/**
 * Replace the variables in a template string with associated values.
 *
 * @param {string} templateString The text containing variables.
 * @param {Object} varToValMap A map {varName: varVal, ...} of variable names to values.
 *
 * @returns {string} A new string with the all of the variables replaced with their values.
 *
 */
function replaceVarsInString(templateString, varToValMap) {
  // Iterate through keys. Replace each key with its value in templateString.
  let replacedString = templateString;
  Object.keys(varToValMap).forEach(varName => {
    const varMatcher = new RegExp(varName, 'g');
    replacedString = replacedString.replace(varMatcher, varToValMap[varName]);
  });
  return replacedString;
}

/**
 * Sleep for the specified number of milliseconds.
 *
 * @param {number} ms The number of milliseconds to wait.
 * @returns {Promise<null>} Resolves when time is up.
 */
function sleep(ms) {
  return new Promise(resolve => {
    if(flags.get().verbose) {
      console.log(`sleeping for ${ms}ms`);
    }

    setTimeout(() => {
      resolve();
    }, ms);
  });
}

/**
 * Throw the given error
 * @param {string} taskName The task to throw an error for.
 * @param {string} errorMessage The error message to throw.
 */
function throwError(taskName, errorMessage) {
  throw new gulpUtil.PluginError(taskName, errorMessage, {showStack: false});
}

/**
 * Update the generated properties for the Marbles application.
 *
 * @param {Object} obj An object to update the generated properties file.
 * @returns {Object} A JSON object representing updated generated properties.
 */
function updateGenProperties(obj) {
  let temp = loadGenProperties();
  if (temp === null) {
    temp = obj;
  } else {
    temp = merge(temp, obj);
  }
  fs.writeFileSync(loadConfigProperties().properties, JSON.stringify(temp));
  return temp;
}

module.exports = {
  fs                  : fs,
  gulp                : gulp,
  generatePluginError : generatePluginError,
  getMyLine           : getMyLine,
  loadConfigProperties: loadConfigProperties,
  loadGenProperties   : loadGenProperties,
  replaceVarsInFile   : replaceVarsInFile,
  replaceVarsInString : replaceVarsInString,
  sleep               : sleep,
  throwError          : throwError,
  updateGenProperties : updateGenProperties
};
