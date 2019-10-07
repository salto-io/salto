const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
  require('../../eslintrc.js'),
  {
    parserOptions: {
      tsconfigRootDir: __dirname,
    },
  },
)

