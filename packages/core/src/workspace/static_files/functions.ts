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
import { StaticFile, Value, isStaticFile } from '@salto-io/adapter-api'

import { StaticFilesSource, InvalidStaticFile } from './common'
import { Functions, FunctionExpression } from '../../parser/functions'

export const getStaticFilesFunctions = (staticFilesSource: StaticFilesSource): Functions => ({
  file: {
    parse: (funcExp): Promise<StaticFile | InvalidStaticFile> => {
      const [filepath] = funcExp.value.parameters
      return staticFilesSource.getStaticFile(filepath)
    },
    dump: async (val: Value): Promise<FunctionExpression> => {
      if (val.content !== undefined) {
        await staticFilesSource.persistStaticFile(val)
      }
      return new FunctionExpression(
        'file',
        [val.filepath],
      )
    },
    isSerializedAsFunction: (val: Value) => isStaticFile(val),
  },
})
