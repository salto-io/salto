const path = require('path')
const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../eslintrc.js'),
  {
    parserOptions: {
      tsconfigRootDir: __dirname,
      project: path.resolve(__dirname, './tsconfig.json'),
    },
  },
)
