/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import { fileURLToPath } from 'node:url'

import baseConfig from '../../eslint.config.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const configs = ['./tsconfig.json']

const config = baseConfig.concat([
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: configs.map(config => path.resolve(__dirname, config)),
      },
    },
  },
  {
    ignores: ['jest-dynalite-config.js'],
  },
])

export default config
