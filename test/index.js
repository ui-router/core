// require all source files ending in "Spec" from the
// current directory and all subdirectories

require('../src/index');
require('./_matchers');
var utils = require('./_testUtils');

var testsContext = require.context('.', true, /Spec$/);
testsContext.keys().forEach(testsContext);

afterAll(utils.resetBrowserUrl);
