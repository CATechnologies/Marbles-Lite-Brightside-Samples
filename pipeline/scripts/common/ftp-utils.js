const common = require('./common');
const FtpClient = require('ftp');
const colors = require('gulp-util').colors;
const fs = require('fs');
const path = require('path');

const {isUndefined} = require('./utils');

const props = common.loadConfigProperties();
const ftp = new FtpClient();
const flags = require('./flags');

/**
 * FTP a source file to a remote destination
 *
 * @param {string} source The source file to upload
 * @param {string} destination The destination folder to upload to
 * @param {boolean} [doesConnect=true] Should a connection be established, set to false when a
 *                                     connection has already been opened prior to entry to this
 *                                     function.
 * @returns {Promise<boolean>} Resolves to true on success and false on error.
 */
async function ftpFile(source, destination, doesConnect = true) {
  console.log('Uploading %s to %s', colors.cyan.bold(source), colors.magenta.bold(destination));

  if (doesConnect) {
    await _connect();
  }

  if(ftp.connected) {
    if (flags.get().verbose) {
      console.log();
      console.log('Source:', colors.cyan(source));
      console.log('Destination:', colors.magenta(destination));
      console.log();
    }

    return new Promise(async resolve => {
      // Validate that the directory exists / attempt to create before continuing
      if (await _createDirIfNotExist(path.posix.dirname(destination))) {
        // Entering here indicates that the directory existed or was created

        // Now attempt to put the file to the destination
        ftp.put(source, destination, async error => {
          let success = true;

          if (error) {
            console.error(colors.red('Error during ftp operation!'));
            console.error();
            console.error(error);
            console.error();
            console.error('      source:', colors.cyan.bold(source));
            console.error(' destination:', colors.magenta.bold(destination));
            console.error();

            success = false;
          }

          if (doesConnect) {
            await _disconnect();
          }
          resolve(success);
        });
      } else {
        // The directory didn't exist and couldn't be created
        console.error(colors.red.bold('Destination directory doesn\'t exist!'));
        if (doesConnect) {
          await _disconnect();
        }
        resolve(false);
      }
    });
  } else {
    console.error('An error occurred while opening an FTP connection.');
    return new Promise(resolve => {
      resolve(false);
    });
  }
}

/**
 * @typedef {object} File Information about a file to upload.
 * @property {string} source The source location.
 * @property {string} destination The ftp destination.
 */
/**
 * Upload multiple files on a single connection
 * @param {File[]} files An object containing the files to upload.
 *
 * @returns {Promise<boolean>} resolves to true on successful upload and false on failure
 */
function ftpFiles(files) {
  return new Promise(async resolve => {
    await _connect();

    if (ftp.connected) {
      let success = true;

      for (let i = 0, len = files.length; success && i < len; i++) {
        // Attempt to upload this file and check the status of the operation
        success = await ftpFile(files[i].source, files[i].destination, false);

        if (success) {
          console.log(colors.green.bold('SUCCESS'));
        } else {
          console.log(colors.red.bold('FAIL'));
        }
      }

      await _disconnect();
      resolve(success);
    } else {
      console.error('An error occurred while opening an FTP connection.');
      resolve(false);
    }
  });
}

/**
 * FTP a source directory recursively to a remote directory.
 *
 * @param {string} source The source directory to upload.
 * @param {string} destination The destination folder to upload to.
 * @returns {Promise<boolean>} Resolves to true on success and false on error.
 */
async function ftpFolder(source, destination) {
  await _connect();

  if (ftp.connected) {
    if (flags.get().verbose) {
      console.log();
      console.log('Source directory:', colors.cyan.bold(source));
      console.log('Destination directory:', colors.magenta.bold(destination));
      console.log();
    }

    return new Promise(async resolve => {
      const success = await _ftpDirectory(source, destination);
      await _disconnect();
      resolve(success);
    });
  } else {
    console.error('An error occurred while opening an FTP connection.');
    return new Promise(resolve => {
      resolve(false);
    });
  }
}

/**
 * Connect to the FTP server.
 *
 * @returns {Promise<boolean>} Resolves to true on success and false on failure
 * @private
 */
function _connect() {
  return new Promise(resolve => {
    if (ftp.connected) {
      console.warn(colors.yellow('FTP connection already established.'));
      resolve(true);
    } else if (isUndefined(props)) {
      console.error('An error occurred while reading your properties file');
      resolve(false);
    } else {
      if (flags.get().verbose) {
        console.log('Opening FTP connection');
      }

      ftp.connect({
        host    : props.system.host,
        user    : props.system.user,
        password: props.system.pass,
        port    : 21
      });


      ftp.on('ready', () => {
        // Try to cd to root
        ftp.cwd('/', error => {
          let success = true;

          if (error) {
            console.error(colors.red('Error setting the root directory!'));
            console.error();
            console.error(error);
            console.error();

            success = false;
          }

          resolve(success);
        });
      });

      ftp.on('error', async error => {
        console.error();
        console.error(colors.red(error));
        console.error();

        await _disconnect();
        resolve(false);
      });
    }
  });
}

/**
 * Close the ftp connection so tasks don't hang.
 *
 * @returns {Promise<boolean>} Resolves to true on success and false on fail
 * @private
 */
function _disconnect() {
  return new Promise(resolve => {
    if (ftp.connected) {
      if (flags.get().verbose) {
        console.log('Closing FTP connection');
      }

      ftp.end();

      // Resolve once ended
      ftp.on('end', () => {
        resolve(true);
      });
    } else {
      console.warn(colors.yellow('Attempt to close a non-existent FTP connection.'));
      resolve(false);
    }
  });
}

/**
 * Check if a directory exists and if it doesn't attempt to create it.
 *
 * @param {string} directory The remote directory to create
 * @returns {Promise<boolean>} Resolves to true if the directory existed or was created, false
 *                             otherwise.
 * @private
 */
function _createDirIfNotExist(directory) {
  return new Promise(resolve => {
    let success = true;

    // Check that the directory exists first
    ftp.cwd(directory, err => {
      // Error indicates that the directory doesn't exist
      if (err) {
        if (flags.get().verbose) {
          console.log(err);
        }

        ftp.mkdir(directory, true, error => {
          if (error) {
            console.error(colors.red('Error during ftp operation!'));
            console.error();
            console.error(error);
            console.error();
            console.error('Unable to create the directory:', colors.magenta.bold(directory));
            console.error();

            success = false;
          }

          resolve(success);
        });
      } else {
        // No error indicates that the directory exists
        resolve(true);
      }
    });
  });
}

/**
 * This recursive function will upload all files and folders under a directory.
 * @param {string} source The source directory to look in
 * @param {string} destination The destination directory to ftp to
 * @returns {Promise<boolean>} Indicates that the FTP has completed. Resolves to false on the first
 *                             failure.
 */
function _ftpDirectory(source, destination) {
  let success = true;
  return new Promise(resolve => {
    // Loop through all the files in the temp directory
    fs.readdir(source, async(err, files) => {
      if (err) {
        console.error('Could not list the directory.', err);
        process.exit(1);
      } else {
        for (const file of files) {
          if (success) {
            success = await new Promise(innerResolve => {
              // Make one pass and make the file complete
              const fromPath = path.join(source, file);
              const toPath = path.posix.join(destination, file);

              // Get the statistics of the file
              fs.stat(fromPath, async(error, stat) => {
                let uploadSuccess = true;

                if (error) {
                  console.error('Error stating file.', error);
                  return;
                }

                if (stat.isDirectory()) {
                  /*
                   * If the file is a directory recurse into this function to upload the correct
                   * files
                   */
                  if (await _ftpDirectory(fromPath, toPath) === false) {
                    uploadSuccess = false;
                  }
                } else {
                  // Otherwise we need to try to ftp the file
                  const ftpResult = await ftpFile(fromPath, toPath, false);

                  if (ftpResult === false) {
                    uploadSuccess = false;
                    console.log(colors.red.bold('FAIL'));
                  } else {
                    console.log(colors.green.bold('SUCCESS'));
                  }
                }

                // Resolve the promise so the for loop can continue
                innerResolve(uploadSuccess);
              });
            });
          }
        }

        // Resolve the returned promise at this point.
        resolve(success);
      }
    });
  });
}


module.exports = {
  ftpFile  : ftpFile,
  ftpFiles : ftpFiles,
  ftpFolder: ftpFolder
};
