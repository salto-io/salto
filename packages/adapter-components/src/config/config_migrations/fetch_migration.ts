/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { InstanceElement } from '@salto-io/adapter-api'
import { AdapterApiConfig } from '../shared'

type UpdatedConfig = {
  apiDefinitions: AdapterApiConfig
}

const MIGRATION_MESSAGE =
  'The configuration option "fetch.includeTypes" is deprecated.' +
  ' To skip items in fetch, please use the "fetch.include" and "fetch.exclude" options.'

/**
 * Migrating the old include type fetch structure, i.e.:
 * fetch = {
 *   includeTypes = [
 *     ...
 *   ]
 * }
 * to the current fetch structure, i.e.:
 * fetch = {
 *   include = [
 *     {
 *       type = "type.*"
 *     }
 *     ...
 *   ]
 *   exclude = [
 *    ...
 *   ]
 * }
 */
export const migrateDeprecatedIncludeList = (
  config: InstanceElement | undefined,
  defaultConfig: UpdatedConfig,
  typesToIgnore: string[] = [],
): { config: [InstanceElement]; message: string } | undefined => {
  if (
    config === undefined ||
    (!Array.isArray(config.value.apiDefinitions?.supportedTypes) && config.value.fetch?.includeTypes === undefined)
  ) {
    return undefined
  }

  const updatedConfig = config.clone()
  if (Array.isArray(updatedConfig.value.apiDefinitions?.supportedTypes)) {
    // It's ok to just delete in this case because when deleted the default will be used
    delete updatedConfig.value.apiDefinitions?.supportedTypes
  }

  if (updatedConfig.value.fetch.includeTypes !== undefined) {
    const includeTypes = new Set(updatedConfig.value.fetch.includeTypes)
    const allTypes = Object.values(defaultConfig.apiDefinitions.supportedTypes).flat()

    const excludedTypes = allTypes.filter(type => !includeTypes.has(type))

    const wrapperTypeToRealType = Object.fromEntries(
      Object.entries(defaultConfig.apiDefinitions.supportedTypes).flatMap(([realType, wrapperTypes]) =>
        wrapperTypes.map(wrapperType => [wrapperType, realType]),
      ),
    )

    const realExcludeTypes = excludedTypes
      .map(type => wrapperTypeToRealType[type])
      .filter(type => !typesToIgnore.includes(type))

    delete updatedConfig.value.fetch.includeTypes
    updatedConfig.value.fetch.include = [{ type: '.*' }]
    updatedConfig.value.fetch.exclude = realExcludeTypes.map(type => ({ type }))
  }

  return { config: [updatedConfig], message: MIGRATION_MESSAGE }
}
