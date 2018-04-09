import nodeResolve from 'rollup-plugin-node-resolve';
import uglify from 'rollup-plugin-uglify';
import sourcemaps from 'rollup-plugin-sourcemaps';

const MINIFY = process.env.MINIFY;

const pkg = require('./package.json');
const banner = `/**
 * ${pkg.description}
 * @version v${pkg.version}
 * @link ${pkg.homepage}
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */`;

const uglifyOpts = { output: {} };
// retain multiline comment with @license
uglifyOpts.output.comments = (node, comment) => comment.type === 'comment2' && /@license/i.test(comment.value);

const onwarn = warning => {
  // Suppress this error message... https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
  const ignores = ['THIS_IS_UNDEFINED'];
  if (!ignores.some(code => code === warning.code)) {
    console.error(warning.message);
  }
};

const plugins = [nodeResolve({ jsnext: true }), sourcemaps()];

if (MINIFY) plugins.push(uglify(uglifyOpts));

const extension = MINIFY ? '.min.js' : '.js';

const CONFIG = {
  input: 'lib-esm/index.js',
  output: {
    name: '@uirouter/core',
    file: '_bundles/ui-router-core' + extension,
    sourcemap: true,
    format: 'umd',
    exports: 'named',
    banner: banner,
  },

  plugins: plugins,
  onwarn: onwarn,
};

export default CONFIG;
