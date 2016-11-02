// require all source files ending in "Spec" from the
// current directory and all subdirectories

require('core-js');
require('../src/index');
require('./_matchers');

var testsContext = require.context(".", true, /Spec$/);
testsContext.keys().forEach(testsContext);
