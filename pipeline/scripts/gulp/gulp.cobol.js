// Build tasks related to our COBOL source residing on the mainframe
const common = require('../common/common');
const gulp = common.gulp;
const props = common.loadConfigProperties();
const flags = require('../common/flags');

let cicsHandler;

// TODO: Check if region is active ----- bright zos-jobs list all --name A23ICICA

// Both compile our Marbles COBOL program and update its CICS program resource
gulp.task('cobol', 'Build the Marbles Cobol program and deploy to CICS', [], () => {
  const cobol = require('../common/brightside/cobol');
  cicsHandler = require('../common/brightside/cics');

  if (!flags.get().define &&
      !flags.get().compile &&
      !flags.get().refresh) {
    defineCobolResources();
    cobol.compileCobolMarbles('cobol:compile');
    cobol.refreshCobolMarbles('cobol:refresh');
  } else {
    if (flags.get().define) {
      defineCobolResources();
    }

    if (flags.get().compile) {
      cobol.compileCobolMarbles('cobol:compile');
    }

    if (flags.get().refresh) {
      cobol.refreshCobolMarbles('cobol:refresh');
    }
  }
}, {
  options: {
    compile: 'Compile the Marbles Cobol program from Endevor',
    define : 'Defines the Marbles Cobol CICS resources',
    refresh: 'Refresh the Marbles Cobol program in CICS'
  }
});

/**
 * Define all cobol resources needed
 */
function defineCobolResources() {
  const programName = props.cics.cobol.program;
  const transactionName = props.cics.cobol.trans;

  console.log('Defining and enabling all necessary resources...');

  cicsHandler.prepareResource('PROGRAM', programName);

  cicsHandler.prepareResource('TRANSACTION', transactionName, 'PROGRAM(' + programName + ')');
}
