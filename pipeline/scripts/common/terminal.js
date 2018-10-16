const cp = require('child_process');
const colors = require('gulp-util').colors;
const flags = require('./flags');

/**
 * Executes a specified command line command.
 *
 * @param {string} command The command to execute.
 * @param {string[]} [args=[]] Arguments for the command.
 * @param {Object} [spawnOptions={}] Node spawn options to override command defaults.
 * @param {boolean} [doesGetRawResult=false] Are the raw results returned from this
 * @returns {number|Object} The status result of the process or the raw object returned by node. Depends on what the
 *                          value of doesGetRawResult is.
 */
exports.executeCommand = (command, args = [], spawnOptions = {}, doesGetRawResult = false) => {
  const options = Object.assign({
    env  : process.env,
    shell: true,
    stdio: 'inherit'
  }, spawnOptions);

  if (flags.getFlag(['verbose'])) {
    console.log();
    console.group('Submitting Command');
    console.log(`command     : ${colors.cyan.bold(command)}`);
    console.log(`args        : ${colors.magenta.bold(args.join(' '))}`);
    console.log('spawnOptions: ', spawnOptions);
    console.groupEnd();
    console.log();
  }

  const results = cp.spawnSync(command, args, options);

  if (doesGetRawResult) {
    return results;
  } else if (results.status == null) {
    throw results.error;
  } else {
    return results.status;
  }
};

/**
 * Executes a gradle script in the webserver folder.
 * @param {string[]} args An array of arguments to send to gradle
 * @returns {number} The return code of process execution
 */
exports.executeGradleScript = (args = []) => exports.executeCommand(
  process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
  args, {
    cwd                     : './webserver',
    windowsVerbatimArguments: true
  }
);


/**
 * Execute an npm command on the system.
 *
 * @param {string[]} args Arguments for the npm command
 * @param {string} [directory='./'] The working directory of the npm command
 *
 * @returns {number} The return code of the npm process.
 */
exports.executeNpmCommand = (args = [], directory = './') =>
  exports.executeCommand('npm', args, {
    cwd: directory
  });

module.exports = exports;
