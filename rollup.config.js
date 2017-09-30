import nodeResolve from 'rollup-plugin-node-resolve';
import uglify from 'rollup-plugin-uglify';
import progress from 'rollup-plugin-progress';
import sourcemaps from 'rollup-plugin-sourcemaps';
import visualizer from 'rollup-plugin-visualizer';

const MINIFY = process.env.MINIFY;

const pkg = require('./package.json');
const banner =
`/**
 * ${pkg.description}
 * @version v${pkg.version}
 * @link ${pkg.homepage}
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */`;

const uglifyOpts = { output: {} };
// retain multiline comment with @license
uglifyOpts.output.comments = (node, comment) =>
comment.type === 'comment2' && /@license/i.test(comment.value);

const onwarn = (warning) => {
  // Suppress this error message... https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
  const ignores = ['THIS_IS_UNDEFINED'];
  if (!ignores.some(code => code === warning.code)) {
    console.error(warning.message);
  }
};

const plugins = [
  nodeResolve({jsnext: true}),
  progress({ clearLine: false }),
  sourcemaps(),
  visualizer({ sourcemap: true }),
];

if (MINIFY) plugins.push(uglify(uglifyOpts));

const extension = MINIFY ? ".min.js" : ".js";

const CONFIG = {
  moduleName: '@uirouter/core',
  entry: 'lib-esm/index.js',
  dest: '_bundles/ui-router-core' + extension,

  sourceMap: true,
  format: 'umd',
  exports: 'named',
  plugins: plugins,
  banner: banner,
  onwarn: onwarn,
};

export default CONFIG;
