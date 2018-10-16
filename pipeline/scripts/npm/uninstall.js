const {executeNpmCommand} = require('../common/terminal');

console.log('Uninstall Started');
console.log('\nUninstalling global brightside');
executeNpmCommand([
  'uninstall',
  '-g',
  '@brightside/core'
]);

console.log('\nUninstalling global gulp-cli');
executeNpmCommand([
  'uninstall',
  '-g',
  'gulp-cli'
]);

console.log('\nUninstall Completed');
