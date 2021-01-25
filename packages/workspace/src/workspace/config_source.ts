/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { setPath } from '@salto-io/adapter-utils'
import { InstanceElement, DetailedChange, isInstanceElement, getChangeElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { parse, dumpElements } from '../parser'

import { FILE_EXTENSION } from './nacl_files'
import { DirectoryStore } from './dir_store'

const log = logger(module)

export interface ConfigSource {
  get(name: string, ignoreOverrides?: boolean): Promise<InstanceElement | undefined>
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
  dirStore: DirectoryStore<string>,
  configOverrides?: DetailedChange[],
): ConfigSource => {
  const filename = (name: string): string =>
    (name.endsWith(FILE_EXTENSION) ? name : name.concat(FILE_EXTENSION))

  const configOverridesById = _.groupBy(configOverrides, change => change.id.adapter)

  return {
    get: async (name: string, ignoreOverrides = false): Promise<InstanceElement | undefined> => {
      const naclFile = await dirStore.get(filename(name))
      if (_.isUndefined(naclFile)) {
        log.warn('Could not find file %s for configuration %s', filename(name), name)
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
      const configInstance = parseResult.elements.find(isInstanceElement)
      if (configInstance === undefined) {
        log.warn(
          'failed to find config instance for %s, found the following elements: %s',
          name,
          parseResult.elements.map(elem => elem.elemID.getFullName()).join(','),
        )
        return undefined
      }
      if (!ignoreOverrides) {
        // Apply configuration overrides
        const overridesForInstance = configOverridesById[configInstance.elemID.adapter] ?? []
        overridesForInstance.forEach(change => {
          setPath(configInstance, change.id, getChangeElement(change))
        })
      }
      return configInstance
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
