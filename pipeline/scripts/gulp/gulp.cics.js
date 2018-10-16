// define and install DB2Conn and MQCONN resources after provisioning

const common = require('../common/common');
const gulp = common.gulp;
const brightUtils = require('../common/brightside/utils');

const props = common.loadConfigProperties();
const flags = require('../common/flags');

let cicsHandler;

/**
 * Gulp Task: cics
 * This task will configure the necessary resources to execute DB2 transactions via MQ.
 *
 * Special flags:
 *  <none>:     If no options are provided, this task will configure DB2 and MQ connection resources,
 *              In addition, it will configure and start the bridge monitor transaction.
 *
 *  delete:     If only this flag is specified, it will delete/stop all connections and configurations
 *              If a flag <X> is specified along side this one, the configurations provided by <X> will be reverted
 *
 *  alter<Y>:   These flags will only reconfigure the specified <Y> resource. (e.g. alterDB2 reconfigures DB2 resources)
 */
gulp.task('cics', 'Configures general CICS resources', [], () => {
  const args = flags.get();
  cicsHandler = require('../common/brightside/cics');
  if (!args.alterDB2 && !args.alterMQ && !args.alterBridge) {
    if (!args.configDB2 && !args.configBridge && !args.configMQ && !args.startBridge) {
      configDB2('configDB2', args.delete);
      configBridgeMonitorFile('configBridgeMonitorFile', args.delete);
      configMQ('configMQ', args.delete);
      startBridgeMonitorTransaction('startBridgeMonitorTransaction', args.delete);
    } else {
      if (args.configDB2) {
        configDB2('configDB2', args.delete);
      }
      if (args.configBridge) {
        configBridgeMonitorFile('configBridgeMonitorFile', args.delete);
      }
      if (args.configMQ) {
        configMQ('configMQ', args.delete);
      }
      if (args.startBridge) {
        startBridgeMonitorTransaction('startBridgeMonitorTransaction', args.delete);
      }
    }
  } else {
    if (args.alterDB2) {
      alterDB2('alterDB2');
    }

    if (args.alterMQ) {
      alterMQ('alterMQ');
    }

    if (args.alterBridge) {
      alterBridgeMonitorFile('alterBridgeMonitorFile');
    }
  }
}, {
  options: {
    alterBridge : 'Reconfigures the Bridge monitor file',
    alterDB2    : 'Reconfigures the DB2 connection',
    alterMQ     : 'Reconfigures the MQ connection',
    configBridge: 'Configures the Bridge monitor file',
    configDB2   : 'Configures the DB2 connection',
    configMQ    : 'Configures the MQ connection',
    delete      : 'Deletes/Stops specified CICS configuration (Deletes all if no flags are set)',
    startBridge : 'Starts the Bridge monitor transaction'
  }
});

/**
 * Configure the DB2 connection resource
 *
 * Actions performed:
 *    Define the DB2Conn resource
 *    Install the DB2Conn resource
 *    Connect the DB2Conn resource
 *
 * @param {string} taskName Task name executed
 * @param {boolean} shouldDelete Indicates is this configuration should be reverted
 */
function configDB2(taskName, shouldDelete) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  // Check if we should delete/stop this configuration
  if (shouldDelete) {
    deleteDB2('deleteDB2');
    return;
  }

  const db2connName = props.cics.db2connName;
  const db2idName = props.brightside.db2.region;
  const group = props.brightside.cics.group;

  defineResource([
    'cics',
    'define',
    'db2conn',
    db2connName,
    '--db2id',
    db2idName
  ], 'DB2 connection ' + db2connName, taskName);

  if (!cicsHandler.isResourceInstalled('db2conn', db2connName)) {
    installResource([
      'cics',
      'install',
      'db2conn',
      db2connName,
      '--group',
      group
    ], 'DB2 connection ' + db2connName, taskName);
  }
  connectResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET DB2CONN CONNECTED"'
  ], 'DB2 connection ' + db2connName, taskName);
}

/**
 * Alter  the DB2 connection resource
 *
 * Actions performed:
 *    Alter the DB2Conn resource
 *    Disconnect the DB2Conn resource
 *    Install the DB2Conn resource
 *    Connect the DB2Conn resource
 *
 * @param {string} taskName Task name executed
 */
function alterDB2(taskName) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  const db2connName = props.cics.db2connName;
  const db2idName = props.brightside.db2.region;
  const group = props.brightside.cics.group;
  const stmt = 'ALTER DB2CONN(' + db2connName + ') GROUP(' + group + ') DB2ID(' + db2idName + ')';

  alterResource([
    'cics',
    'submit',
    'dfhcsdup',
    '--statement',
    stmt
  ], 'DB2 connection ' + db2connName, taskName);
  disconnectResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET DB2CONN CONNECTED"'
  ], 'DB2 connection ' + db2connName, taskName);
  installResource([
    'cics',
    'install',
    'db2conn',
    db2connName,
    '--group',
    group
  ], 'DB2 connection ' + db2connName, taskName);
  connectResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET DB2CONN CONNECTED"'
  ], 'DB2 connection ' + db2connName, taskName);
}

/**
 * Delete the DB2 connection resource
 *
 * Actions performed:
 *    Disconnect the DB2Conn resource
 *    Discard the DB2Conn resource
 *    Delete the DB2Conn resource
 *
 * @param {string} taskName Task name executed
 */
function deleteDB2(taskName) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  const db2connName = props.cics.db2connName;
  const group = props.brightside.cics.group;

  disconnectResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET DB2CONN NOTCONNECTED"'
  ], 'DB2 connection ' + db2connName, taskName);
  discardResource([
    'cics',
    'issue',
    'modify',
    '"CEMT DISCARD DB2CONN"'
  ], 'DB2 connection ' + db2connName, taskName);
  deleteResource([
    'cics',
    'delete',
    'db2conn',
    db2connName,
    '--group',
    group
  ], 'DB2 connection ' + db2connName, taskName);
}

/**
 * Configure the Bridge Facility Namespace File
 *
 * Actions performed:
 *    Copy the Bridge file
 *    Alter the Bridge file
 *    Install the Bridge file
 *
 * @param {string} taskName Task name executed
 * @param {boolean} shouldDelete Indicates is this configuration should be reverted
 */
function configBridgeMonitorFile(taskName, shouldDelete) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  // Check if we should delete/stop this configuration
  if (shouldDelete) {
    deleteBridgeMonitorFile('deleteBridgeMonitorFile');
    return;
  }

  const bridgeFileHLQ = props.cics.bridgeFileHLQ;
  const bridgeFileName = props.cics.bridgeFileName;
  const bridgeFileGroup = props.cics.bridgeFileGroup;
  const group = props.brightside.cics.group;

  // if (!cicsHandler.isResourceInstalled('file', bridgeFileName)) {
  copyResource([
    'cics',
    'copy',
    'file',
    bridgeFileName,
    '--group',
    bridgeFileGroup,
    '--to',
    group
  ], 'File ' + bridgeFileName, taskName);
  // }
  alterResource([
    'cics',
    'alter',
    'file',
    bridgeFileName,
    '--dsname',
    bridgeFileHLQ + '.' + bridgeFileName
  ], 'File ' + bridgeFileName, taskName);
  disableResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET FILE(' + bridgeFileName + ') CLOSED DISABLED"'
  ], 'File ' + bridgeFileName, taskName);
  installResource([
    'cics',
    'install',
    'file',
    bridgeFileName,
    '--group',
    group
  ], 'File ' + bridgeFileName, taskName);
}

/**
 * Alter the Bridge Facility Namespace File
 *
 * Actions performed:
 *    Alter the Bridge file
 *    Disable the Bridge file
 *    Install the Bridge file
 *
 * @param {string} taskName Task name executed
 */
function alterBridgeMonitorFile(taskName) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  const bridgeFileHLQ = props.cics.bridgeFileHLQ;
  const bridgeFileName = props.cics.bridgeFileName;
  const group = props.brightside.cics.group;

  alterResource([
    'cics',
    'alter',
    'file',
    bridgeFileName,
    '--dsname',
    bridgeFileHLQ + '.' + bridgeFileName
  ], 'File ' + bridgeFileName, taskName);
  disableResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET FILE(' + bridgeFileName + ') DISABLED"'
  ], 'File ' + bridgeFileName, taskName);
  installResource([
    'cics',
    'install',
    'file',
    bridgeFileName,
    '--group',
    group
  ], 'File ' + bridgeFileName, taskName);
}

/**
 * Delete the Bridge Facility Namespace File
 *
 * Actions performed:
 *    Delete the Bridge file
 *
 * @param {string} taskName Task name executed
 */
function deleteBridgeMonitorFile(taskName) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  const bridgeFileName = props.cics.bridgeFileName;

  deleteResource([
    'cics',
    'delete',
    'file',
    bridgeFileName
  ], 'File ' + bridgeFileName, taskName);
}

/**
 * Configure the MQ connection resource
 *
 * Actions performed:
 *    Define the MQConn resource
 *    Install the MQConn resource
 *    Connect the MQConn resource
 *
 * @param {string} taskName Task name executed
 * @param {boolean} shouldDelete Indicates is this configuration should be reverted
 */
function configMQ(taskName, shouldDelete) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  // Check if we should delete/stop this configuration
  if (shouldDelete) {
    deleteMQ('deleteMQ');
    return;
  }

  const mqconnName = props.cics.mqconnName;
  const mqName = props.cics.mqName;
  const initqName = props.cics.initqName;
  const group = props.brightside.cics.group;

  defineResource([
    'cics',
    'define',
    'mqconn',
    mqconnName,
    '--mqname',
    mqName,
    '--initqname',
    initqName
  ], 'MQ connection ' + mqconnName, taskName);

  if (!cicsHandler.isResourceInstalled('mqconn', mqconnName)) {
    installResource([
      'cics',
      'install',
      'mqconn',
      mqconnName,
      '--group',
      group
    ], 'MQ connection ' + mqconnName, taskName);
  }

  connectResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET MQCONN CONNECTED"'
  ], 'MQ connection ' + mqconnName, taskName);
}

/**
 * Alter the MQ connection resource
 *
 * Actions performed:
 *    Alter the MQConn resource
 *    Disconnect the MQConn resource
 *    Install the MQConn resource
 *    Connect the MQConn resource
 *
 * @param {string} taskName Task name executed
 */
function alterMQ(taskName) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  const mqconnName = props.cics.mqconnName;
  const mqName = props.cics.mqName;
  const initqName = props.cics.initqName;
  const group = props.brightside.cics.group;

  const stmt =
    'ALTER MQCONN(' + mqconnName + ') GROUP(' + group + ') MQNAME(' + mqName + ') INITQNAME(' + initqName + ')';

  alterResource([
    'cics',
    'submit',
    'dfhcsdup',
    '--statement',
    stmt
  ], 'MQ connection ' + mqconnName, taskName);
  disconnectResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET MQCONN NOTCONNECTED"'
  ], 'MQ connection ' + mqconnName, taskName);
  installResource([
    'cics',
    'install',
    'mqconn',
    mqconnName,
    '--group',
    group
  ], 'MQ connection ' + mqconnName, taskName);
  connectResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET MQCONN CONNECTED"'
  ], 'MQ connection ' + mqconnName, taskName);
}

/**
 * Delete the MQ connection resource
 *
 * Actions performed:
 *    Disconnect the MQConn resource
 *    Discard the MQConn resource
 *    Delete the MQConn resource
 *
 * @param {string} taskName Task name executed
 */
function deleteMQ(taskName) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  const mqconnName = props.cics.mqconnName;

  disconnectResource([
    'cics',
    'issue',
    'modify',
    '"CEMT SET MQCONN NOTCONNECTED"'
  ], 'MQ connection ' + mqconnName, taskName);
  discardResource([
    'cics',
    'issue',
    'modify',
    '"CEMT DISCARD MQCONN"'
  ], 'MQ connection ' + mqconnName, taskName);
  deleteResource([
    'cics',
    'delete',
    'mqconn',
    mqconnName
  ], 'MQ connection ' + mqconnName, taskName);
}

/**
 * Start Bridge transaction
 * @param {string} taskName Task name executed
 * @param {boolean} shouldDelete Indicates is this configuration should be reverted
 */
function startBridgeMonitorTransaction(taskName, shouldDelete) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  // Check if we should delete/stop this configuration
  if (shouldDelete) {
    stopBridgeMonitorTransaction('stopBridgeMonitorTransaction');
    return;
  }

  /**
   * Start transaction
   */
  console.log('Start the bridge monitor transaction CKBR ...');
  const temp = brightUtils.issueCommand([
    'cics',
    'issue',
    'modify',
    '"CKBR"',
    '--cics-p',
    brightUtils.profiles.cics
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while starting the transaction';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else {
    console.log('Bridge monitor transaction CKBR successfully started!');
  }
}

/**
 * Stops the Bridge connection
 * @param {string} taskName Task name executed
 */
function stopBridgeMonitorTransaction(taskName) {
  if (!props) {
    common.throwError(taskName, 'An error occurred while reading your properties file');
  }

  /**
   * Start transaction
   */
  console.log('Stop the bridge monitor ...');
  const temp = brightUtils.issueCommand([
    'cics',
    'issue',
    'modify',
    '"CEMT SET MQCONN NOTCONNECTED"',
    '--cics-p',
    brightUtils.profiles.cics
  ]);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while stopping the transaction';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else {
    console.log('Bridge monitor successfully stopped!');
  }
}

/**
 * Defines a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function defineResource(cmd, resourceDesc, taskName) {
  console.log('Defining ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while defining ' + resourceDesc + '!';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else if (temp.stdout.indexOf('COMMANDS IN ERROR: 1') >= 0) {
    const err = resourceDesc + ' failed to define!';
    console.log(err);
    console.log(temp.stdout);

    common.throwError(taskName, err);
  } else {
    console.log(resourceDesc + ' successfully defined!');
    // console.log(temp.stdout);
  }
}

/**
 * Install a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function installResource(cmd, resourceDesc, taskName) {
  console.log('Installing ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while installing ' + resourceDesc + '!';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else if (temp.stdout.indexOf('UNSUCCESSFUL') >= 0) {
    const err = resourceDesc + ' failed to install!';
    console.log(err);
    console.log(temp.stdout);

    common.throwError(taskName, err);
  } else {
    console.log(resourceDesc + ' successfully installed!');
    // console.log(temp.stdout);
  }
}

/**
 * Connect a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function connectResource(cmd, resourceDesc, taskName) {
  console.log('Connecting ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while connecting ' + resourceDesc + '!';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else if (temp.stdout.indexOf('Connected') < 0) {
    const err = resourceDesc + ' failed to connect!';
    console.log(err);
    console.log(temp.stdout);

    common.throwError(taskName, err);
  } else {
    console.log(resourceDesc + ' successfully connected!');
    // console.log(temp.stdout);
  }
}

/**
 * Disconnect a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function disconnectResource(cmd, resourceDesc, taskName) {
  console.log('Disconnecting ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while disconnecting ' + resourceDesc + '!';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else if (temp.stdout.indexOf('Notconnected') < 0) {
    const err = resourceDesc + ' failed to disconnect!';
    console.log(err);
    console.log(temp.stdout);

    common.throwError(taskName, err);
  } else {
    console.log(resourceDesc + ' successfully disconnected!');
    // console.log(temp.stdout);
  }
}

/**
 * Disable a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function disableResource(cmd, resourceDesc, taskName) {
  console.log('Disabling ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while disabling ' + resourceDesc + '!';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else if (temp.stdout.indexOf('Disabled') < 0 && temp.stdout.indexOf('NOT FOUND') < 0) {
    const err = resourceDesc + ' failed to disable!';
    console.log(err);
    console.log(temp.stdout);

    common.throwError(taskName, err);
  } else {
    console.log(resourceDesc + ' successfully disabled!');
    // console.log(temp.stdout);
  }
}

/**
 * Discard a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function discardResource(cmd, resourceDesc, taskName) {
  console.log('Discarding ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while discarding ' + resourceDesc + '!';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else if (temp.stdout.indexOf('DISCARDED') >= 0) {
    console.log(resourceDesc + ' successfully discarded!');
    // console.log(temp.stdout);
  } else {
    const err = resourceDesc + ' failed to discard!';
    console.log(err);
    console.log(temp.stdout);

    common.throwError(taskName, err);
  }
}

/**
 * Delete a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function deleteResource(cmd, resourceDesc, taskName) {
  console.log('Deleting ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while deleting ' + resourceDesc + '!';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else if (temp.stdout.indexOf('UNSUCCESSFUL') >= 0) {
    const err = resourceDesc + ' failed to delete!';
    console.log(err);
    console.log(temp.stdout);

    common.throwError(taskName, err);
  } else {
    console.log(resourceDesc + ' successfully deleted!');
    // console.log(temp.stdout);
  }
}

/**
 * Copy a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function copyResource(cmd, resourceDesc, taskName) {
  console.log('Copying ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    console.log(temp.stderr);
    common.throwError(taskName, 'An error occurred while copying ' + resourceDesc);
  } else if (temp.stdout.indexOf('COMMANDS IN ERROR: 1') >= 0 && temp.stdout.indexOf('DFHBRNSF ALREADY EXISTS') < 0) {
    console.log(temp.stdout);
    common.throwError(taskName, resourceDesc + ' failed to copy!');
  } else {
    console.log(resourceDesc + ' successfully copied!');
  }
}

/**
 * Alter a resource
 * @param {string[]} cmd           Command to execute
 * @param {string} resourceDesc  Description of the resource
 * @param {string} taskName      Task name executed
 */
function alterResource(cmd, resourceDesc, taskName) {
  console.log('Altering ' + resourceDesc + ' ...');
  const temp = brightUtils.issueCommand(cmd);
  if (!temp || !temp.success || temp.stderr) {
    const err = 'An error occurred while altering ' + resourceDesc + '!';
    console.error(err);
    console.error(temp);

    common.throwError(taskName, err);
  } else if (temp.stdout.indexOf('UNSUCCESSFUL') >= 0) {
    const err = resourceDesc + ' failed to alter!';
    console.log(err);
    console.log(temp.stdout);

    common.throwError(taskName, err);
  } else {
    console.log(resourceDesc + ' successfully altered!');
  }
}
