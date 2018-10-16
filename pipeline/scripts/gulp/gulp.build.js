const gulp = require('../common/common').gulp;
const runSequence = require('run-sequence');

gulp.task('build', 'Builds the Cobol and Java source', () => {
  runSequence('cobol', 'java');
});
