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
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { parse } from '../parser/parse'
import { dumpElements } from '../parser/dump'
import { FILE_EXTENSION } from './nacl_files/nacl_files_source'
import { DirectoryStore } from './dir_store'

const log = logger(module)

export interface ConfigSource {
  get(name: string): Promise<InstanceElement | undefined>
  set(name: string, config: Readonly<InstanceElement>): Promise<void>
  delete(name: string): Promise<void>
  rename(name: string, newName: string): Promise<void>
}

class ConfigParseError extends Error {
  constructor(name: string) {
    super(`failed to parse config file ${name}`)
  }
}

export const configSource = (
  dirStore: DirectoryStore,
): ConfigSource => {
  const filename = (name: string): string =>
    (name.endsWith(FILE_EXTENSION) ? name : name.concat(FILE_EXTENSION))

  return {
    get: async (name: string): Promise<InstanceElement | undefined> => {
      const naclFile = await dirStore.get(filename(name))
      if (_.isUndefined(naclFile)) {
        return undefined
      }
      const parseResult = await parse(Buffer.from(naclFile.buffer), naclFile.filename)
      if (!_.isEmpty(parseResult.errors)) {
        log.error('failed to parse %s due to %o', name, parseResult.errors)
        throw new ConfigParseError(name)
      }
      if (parseResult.elements.length > 1) {
        log.warn('%s has more than a single element in the config file; returning the first element',
          name)
      }
      return naclFile
        ? parseResult.elements.pop() as InstanceElement
        : undefined
    },

    set: async (name: string, config: InstanceElement): Promise<void> => {
      await dirStore.set({ filename: filename(name), buffer: await dumpElements([config]) })
      await dirStore.flush()
    },

    delete: async (name: string): Promise<void> => {
      await dirStore.delete(name)
      await dirStore.flush()
    },
    rename: async (name: string, newName: string): Promise<void> => {
      await dirStore.renameFile(name, newName)
    },
  }
}
