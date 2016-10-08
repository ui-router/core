// Karma configuration file
var karma = require('karma');

module.exports = function (karma) {
  var config = {
    singleRun: true,
    autoWatch: false,
    autoWatchInterval: 0,

    // level of logging
    // possible values: LOG_DISABLE, LOG_ERROR, LOG_WARN, LOG_INFO, LOG_DEBUG
    logLevel: "warn",
    // possible values: 'dots', 'progress'
    reporters: 'dots',
    colors: true,

    port: 8080,

    // base path, that will be used to resolve files and exclude
    basePath: '.',

    // Start these browsers, currently available:
    // Chrome, ChromeCanary, Firefox, Opera, Safari, PhantomJS
    browsers: ['PhantomJS'],

    frameworks: ['systemjs', 'jasmine'],

    plugins: [
      require('karma-systemjs'),
      require('karma-jasmine'),
      require('karma-phantomjs-launcher'),
      require('karma-chrome-launcher')
    ],


    /* Files available to be served, so anything that will be require()'d */
    files: [
      { watched: true, included: false, nocache: true, pattern: 'src/**/*.ts' },
      { watched: true, included: false, nocache: true, pattern: 'test/**/*.[tj]s' },
    ],

    systemjs: {
      // Set up systemjs paths
      configFile: 'karma.system.config.js',
      files: ['src/**/*.ts'],
      // karma-systemjs kludge: This is turned into a regexp and is the actual specs that are loaded
      testFileSuffix: "/test/\\S+.[tj]s"
    },
    exclude: []
  };

  karma.set(config);
};
