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
import {
  StaticFile,
  isStaticFile,
} from '@salto-io/adapter-api'
import { serialization } from '@salto-io/lowerdash'
import { prototypeToClassName } from './common'
import { InvalidStaticFile } from '../workspace/static_files/common'

export type StaticFileReviver =
  (staticFile: StaticFile) => Promise<StaticFile | InvalidStaticFile>

export const deserialize = async <T = unknown>(
  jsonStr: string,
  staticFileReviver?: StaticFileReviver,
): Promise<T> => {
  const staticFilePromises: Promise<void>[] = []
  const onStaticFileDeserialized = (
    staticFile: StaticFile, parent: unknown, propName: string
  ): void => {
    if (!staticFileReviver) {
      return
    }
    staticFilePromises.push(staticFileReviver(staticFile).then(r => {
      Object.assign(parent, { [propName]: r })
    }))
  }

  function reviver(this: unknown, propName: string, propValue: unknown): unknown {
    if (typeof propValue === 'string') {
      return Buffer.from(propValue).toString()
    }
    if (isStaticFile(propValue)) {
      onStaticFileDeserialized(propValue, this, propName)
    }
    return propValue
  }

  const data = serialization.jsonSerializer({
    knownPrototypes: prototypeToClassName,
  }).parse(jsonStr, reviver) as T

  await Promise.all(staticFilePromises)
  return data
}
