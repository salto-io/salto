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
import { applyDetailedChanges, detailedCompare } from '@salto-io/adapter-utils'
import { InstanceElement, DetailedChange, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { parse, dumpElements } from '../parser'

import { FILE_EXTENSION } from './nacl_files'
import { DirectoryStore } from './dir_store'

const { awu } = collections.asynciterable
const log = logger(module)

export interface ConfigSource {
  get(name: string, defaultValue?: InstanceElement): Promise<InstanceElement | undefined>
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
  configOverrides: DetailedChange[] = [],
): ConfigSource => {
  const filename = (name: string): string =>
    (name.endsWith(FILE_EXTENSION) ? name : name.concat(FILE_EXTENSION))

  const configOverridesById = _.groupBy(configOverrides, change => change.id.adapter)

  const getConfigWithoutOverrides = async (name: string):
    Promise<InstanceElement | undefined> => {
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
    return configInstance
  }

  const applyConfigOverrides = (conf: InstanceElement): void => {
    const overridesForInstance = configOverridesById[conf.elemID.adapter] ?? []
    applyDetailedChanges(conf, overridesForInstance)
  }

  const setUnsafe = async (name: string, config: InstanceElement): Promise<void> => {
    await dirStore.set({ filename: filename(name), buffer: await dumpElements([config]) })
    await dirStore.flush()
  }

  const validateConfigChanges = (configChanges: DetailedChange[]): void => {
    const updatedOverriddenIds = configOverrides.filter(
      overiddeChange => configChanges.some(
        updateChange => updateChange.id.isParentOf(overiddeChange.id)
          || overiddeChange.id.isParentOf(updateChange.id)
          || overiddeChange.id.isEqual(updateChange.id)
      )
    )

    if (updatedOverriddenIds.length !== 0) {
      throw new Error(`cannot update fields that were overriden by the user: ${updatedOverriddenIds.map(change => change.id.getFullName())}`)
    }
  }

  return {
    get: async (name, defaultValue) => {
      const conf = await getConfigWithoutOverrides(name) ?? defaultValue
      if (conf === undefined) {
        return undefined
      }
      applyConfigOverrides(conf)
      return conf
    },
    set: async (name: string, config: InstanceElement): Promise<void> => {
      const currConfWithoutOverrides = await getConfigWithoutOverrides(name)
      // Could happen at the initialization of a service.
      if (currConfWithoutOverrides === undefined) {
        await setUnsafe(name, config)
        return
      }
      const currConf = currConfWithoutOverrides.clone()
      applyConfigOverrides(currConf)

      const configChanges = await detailedCompare(currConf, config)

      validateConfigChanges(configChanges)

      // currConfWithoutOverrides might have a different id than config.
      // In order to apply the changes on currConfWithoutOverrides we need it
      // to have the same id prefix as the changes.
      const configToUpdate = config.clone()
      configToUpdate.value = currConfWithoutOverrides.value
      applyDetailedChanges(configToUpdate, configChanges)

      await setUnsafe(name, configToUpdate)
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
