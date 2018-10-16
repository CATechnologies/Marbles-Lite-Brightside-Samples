const brightUtils = require('../common/brightside/utils');
const colors = require('gulp-util').colors;
const fs = require('fs');
const common = require('../common/common');
const endv = require('../common/brightside/endevor');
let args;
const {getMyLine, gulp, throwError} = common;
const gutil = require('gulp-util');
const path = require('path');
const props = common.loadConfigProperties();
const utils = require('../common/utils');

gulp.task('demo:db2', 'Tasks used in demos to modify DB2 tables.', [], () => {
  args = require('../common/flags').get();

  // First check that the required profiles exist
  if (brightUtils.checkConfigurations(['zosmf', 'db2'])) {
    console.log();

    let success = true;

    // If the initialize flag is set then execute the initialize file
    if (args.i || args.init) {
      const result = intializeDbToInventoryOnly();
      success = result && result.success;
      console.log();
    }

    // If cost flag is set and we are still successful then execute the add cost file
    if ((args.c || args.cost) && success) {
      const result = addCostToDb();
      success = result && result.success;
      console.log();
    }

    if (success) {
      console.log(colors.green.bold('OPERATION SUCCESSFUL'));
    } else {
      console.error(colors.red.bold('OPERATION FAILURE'));
    }
  } else {
    throw new gutil.PluginError({
      plugin : 'demo:db2',
      message: colors.red.bold('One or more BrightSide profiles are not configured!') + '\n' +
        `    Please run ${colors.cyan.bold('gulp bright --init')} before running this task.`
    });
  }
}, {
  options: {
    init: 'Initialize the database without the cost column. [Aliases: -i]',
    cost: 'Add cost column to the database. Can be used with --initialize. [Aliases: -c]'
  }
});

const demoCobolOptions = {
  addCost         : 'Add the cost property to the marblesc.cbl source file',
  setInventoryOnly: 'Reset COBOL Marbles to only inventory and deploy to CICS'
};
gulp.task('demo:cobol', 'Modify the COBOL Marbles program', [], async() => {
  args = require('../common/flags').get();

  if (!args.addCost &&
       !args.setInventoryOnly
  ) {
    console.log('You must specify one of the following options.');
    Object.entries(demoCobolOptions).forEach(
      ([key, value]) => console.log('  --' + key, '\t' + value)
    );
  } else {
    if (!props) {
      throwError('demo:cobol',
        'No properties exist.\nStopping ' +
        getMyLine(new Error()));
    }

    if (args.addCost) {
      await addCobolCost('demo:cobol --addCost');
    }

    if (args.setInventoryOnly) {
      setCobolInventoryOnly('demo:cobol --setInventoryOnly');
    }
  }
}, {options: demoCobolOptions});

/**
 * Add the cost property to the marblesc.cbl source file.
 * @param {string} taskName The name of the task that called this function.
 */
function addCobolCost(taskName) {
  const result = addCostToDb();
  if (!result || !result.success) {
    throwError(taskName,
      'Failed to add the cost column to our database due to previous errors.\nStopping ' +
      getMyLine(new Error()));
  }

  console.log('\n---------------------------------------------');
  console.log(
    'In the interest of time, we will automatically update our COBOL source\n' +
    'file to add the COST property.\n'
  );
  copyCobolSampleToEndv('marbles_cost' + props.endevorProj.elemExt);

  console.log(colors.yellow.bold(
    'You can push the changes to Endevor with the command:\n    ' +
    'gulp endevor --pushSource'
  ));
}

/**
 * Adds the cost column to our database table.
 *
 * @returns {Object} The result of executing the SQL file.
 */
function addCostToDb() {
  return brightUtils.executeSqlFile('./mainframe/transactions/sql/add_cost.sql', {
    checkSqlCode: true
  });
}

/**
 * Copy a Cobol sample file into the Endevor-controlled project file.
 *
 * @param {string} sampleFileNm The name of the file to be copied.
 */
function copyCobolSampleToEndv(sampleFileNm) {
  const sampleSrcFilePath = path.normalize(
    utils.getProjectRoot() + '/' + props.endevorProj.ndvrProjDir + '/../' + sampleFileNm
  );
  const cobolEndvSrcFilePath = endv.getEndvElemSrcFilePath();

  fs.copyFileSync(sampleSrcFilePath, cobolEndvSrcFilePath);
}

/**
 * Initialize our database table to contain only the inventory column (no cost).
 *
 * @returns {Object} The result of the BrightSide execution.
 */
function intializeDbToInventoryOnly() {
  return brightUtils.executeSqlFile('./mainframe/transactions/sql/initialize_database.sql', {
    checkSqlCode: true
  });
}

/**
 * Reset COBOL Marbles to only inventory and deploy to CICS.
 *
 * @param {string} taskName The name of the task that called this function
 */
function setCobolInventoryOnly(taskName) {
  const result = intializeDbToInventoryOnly();
  if (!result || !result.success) {
    throwError(taskName,
      'Failed to re-initialize our database due to previous errors.\nStopping ' +
      getMyLine(new Error()));
  }

  console.log('\n---------------------------------------------');
  console.log('Reverting COBOL source to only use the inventory property.');
  copyCobolSampleToEndv('marbles_default' + props.endevorProj.elemExt);

  endv.pushSrcToEndevor(taskName);

  const cobol = require('../common/brightside/cobol');
  cobol.compileCobolMarbles(taskName);
  cobol.refreshCobolMarbles(taskName);
}
