const path = require('path');

module.exports = {
  mode: 'development', // production minifaction results in bad error stacks
  target: 'node',
  context: path.resolve(__dirname, 'dist'),
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ["source-map-loader"],
        enforce: "pre",
      }
    ],
  },
  node: {
    __dirname: true,
    __filename: true,
  },
  stats: {
    warningsFilter: [
      /node_modules\/yargs/, // Ignore warnings due to yarg's dynamic module loading
      /parser\/internal\/wasm_exec.js/,
    ],
  },
  plugins: [
  //   // This plugin fixes __dirname and __filename references from sibling
  //   // projects in the monorepo. However it conflicts with nexe packaging so
  //   // it is not used for now. Kept here for documentation purposes.
  //   {
  //     apply(compiler) {
  //       function setModuleConstant(expressionName, fn) {
  //         compiler.hooks.normalModuleFactory.tap('MyPlugin', factory => {
  //           factory.hooks.parser.for('javascript/auto').tap('MyPlugin', (parser, _options) => {
  //             parser.hooks.expression.for(expressionName).tap('MyPlugin', _expression => {
  //               parser.state.current.addVariable(expressionName, JSON.stringify(fn(parser.state.module)))
  //               return true
  //             })
  //           })
  //         })
  //       }
  //
  //       setModuleConstant('__filename', function (module) {
  //         return module.resource;
  //       });
  //
  //       setModuleConstant('__dirname', function (module) {
  //         return module.context;
  //       });
  //     }
  //   },
  ],
}

