// NOTE: this file is not currently used in the build process, since there is no need to package the dist directory into a single file

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/main.ts',
  target: 'node',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.(tsx?)|(jsx?)$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
        options: 'fix'
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'ts-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  }
}
