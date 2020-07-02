/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development', // production minifaction results in bad error stacks
  target: 'node',
  entry: './dist/src/index.js',
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
      },
      {
        test: /\.template$/i,
        use: 'raw-loader',
      },
      {
        test: /\.xml$/i,
        use: 'raw-loader',
      },
      {
        test: /@oracle\/suitecloud-cli-localserver-command/i,
        use: 'null-loader'
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
    ],
  },
  externals: {
    vertx: 'commonjs vertx',    // workaround for: https://github.com/stefanpenner/es6-promise/issues/305
                                // caused by requestretry which depends on an old version of es6-promise
    vm2: 'commonjs vm2',
  },
  plugins: [
    new webpack.EnvironmentPlugin({
      // SALTO_TELEMETRY_TOKEN should be defined in the build system, i.e. circleci
      SALTO_TELEMETRY_TOKEN: 'dev',
      SALTO_TELEMETRY_DISABLE: '0',
      SALTO_TELEMETRY_URL: 'https://telemetry.salto.io',
    }),
    // // This plugin fixes __dirname and __filename references from sibling
    // // projects in the monorepo. However it conflicts with nexe packaging so
    // // it is not used for now. Kept here for documentation purposes.
    // {
    //   apply(compiler) {
    //     function setModuleConstant(expressionName, fn) {
    //       compiler.hooks.normalModuleFactory.tap('MyPlugin', factory => {
    //         factory.hooks.parser.for('javascript/auto').tap('MyPlugin', (parser, _options) => {
    //           parser.hooks.expression.for(expressionName).tap('MyPlugin', _expression => {
    //             parser.state.current.addVariable(expressionName, JSON.stringify(fn(parser.state.module)))
    //             return true
    //           })
    //         })
    //       })
    //     }

    //     setModuleConstant('__filename', function (module) {
    //       return module.resource;
    //     });

    //     setModuleConstant('__dirname', function (module) {
    //       return module.context;
    //     });
    //   }
    // },
  ],
}

