/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { StaticFile, Value, isStaticFile, DEFAULT_STATIC_FILE_ENCODING } from '@salto-io/adapter-api'

import { parser } from '@salto-io/parser'
import { StaticFilesSource, InvalidStaticFile, isInvalidStaticFile } from './common'

export const getStaticFilesFunctions = (staticFilesSource: StaticFilesSource): parser.Functions => ({
  file: {
    parse: (parameters): Promise<StaticFile | InvalidStaticFile> => {
      const [filepath, encoding] = parameters
      const finalEncoding = encoding === 'template' ? 'utf8' : encoding
      const isTemplate = encoding === 'template'
      return staticFilesSource.getStaticFile({ filepath, encoding: finalEncoding, isTemplate })
    },
    dump: async (val: Value): Promise<parser.FunctionExpression> => {
      if (isInvalidStaticFile(val)) {
        return new parser.FunctionExpression('file', [val.filepath])
      }

      await staticFilesSource.persistStaticFile(val)
      const finalEncoding = val.isTemplate === true ? 'template' : val.encoding
      const params = finalEncoding === DEFAULT_STATIC_FILE_ENCODING ? [val.filepath] : [val.filepath, finalEncoding]
      return new parser.FunctionExpression('file', params)
    },
    isSerializedAsFunction: (val: Value) => isStaticFile(val) || isInvalidStaticFile(val),
  },
})
