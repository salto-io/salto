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
import { StaticFile, Value, isStaticFile, DEFAULT_STATIC_FILE_ENCODING } from '@salto-io/adapter-api'

import { StaticFilesSource, InvalidStaticFile } from './common'
import { Functions, FunctionExpression } from '../../parser/functions'

export const getStaticFilesFunctions = (staticFilesSource: StaticFilesSource): Functions => ({
  file: {
    parse: (parameters): Promise<StaticFile | InvalidStaticFile> => {
      const [filepath, encoding] = parameters
      return staticFilesSource.getStaticFile(filepath, encoding)
    },
    dump: async (val: Value): Promise<FunctionExpression> => {
      if (await val.getContent() !== undefined) {
        await staticFilesSource.persistStaticFile(val)
      }
      const params = val.encoding === DEFAULT_STATIC_FILE_ENCODING
        ? [val.filepath] : [val.filepath, val.encoding]
      return new FunctionExpression(
        'file',
        params,
      )
    },
    isSerializedAsFunction: (val: Value) => isStaticFile(val),
  },
})
