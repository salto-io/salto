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
import _ from 'lodash'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { DefaultWithCustomizations } from './shared/types'
import { UserFetchConfig } from '../user'
import { FetchApiDefinitions } from './fetch'

/**
 * merge a single custom definition with a default, assuming they came from a DefaultWithCustomizations definition.
 * the merge is done as follows:
 * - customization takes precedence over default
 * - if the customization is an array -
 *   - if the default is a single item, then the default is applied to each item in the customization array
 *   - if the default is also an array, then the customization is used instead of the default
 * - special case (TODO generalize): if the definition specifies ignoreDefaultFieldCustomizations=true, then
 *   the corresponding fieldCustomizations field, if exists, will not be merged with the default.
 *   the ignoreDefaultFieldCustomizations value itself is omitted from the returned result.
 */
export const mergeSingleDefWithDefault = <T, K extends string>(
  defaultDef: DefaultWithCustomizations<T, K>['default'] | undefined,
  def: T | undefined,
): T | undefined => {
  if (defaultDef === undefined) {
    return def
  }
  if (Array.isArray(def)) {
    if (Array.isArray(defaultDef)) {
      return def
    }
    // TODO improve casting
    return def.map(item => mergeSingleDefWithDefault(defaultDef, item)) as unknown as T
  }
  // we add a fake nesting level called "value" in order for ignoreDefaultFieldCustomizations to be caught even
  // if it directly under the root.
  return _.mergeWith({ value: _.cloneDeep(defaultDef) }, { value: def }, (first, second) => {
    if (lowerdashValues.isPlainObject(second) && _.get(second, 'ignoreDefaultFieldCustomizations') !== undefined) {
      const updatedSecond = _.omit(second, 'ignoreDefaultFieldCustomizations')
      if (_.get(second, 'ignoreDefaultFieldCustomizations')) {
        return mergeSingleDefWithDefault(_.omit(first, 'fieldCustomizations'), updatedSecond)
      }
      return mergeSingleDefWithDefault(first, updatedSecond)
    }
    if (Array.isArray(second)) {
      return mergeSingleDefWithDefault(first, second)
    }
    return undefined
  }).value
}

export type DefQuery<T, K extends string = string> = {
  query: (key: K) => T | undefined
  allKeys: () => K[]
  getAll: () => Record<K, T>
}

export const queryWithDefault = <T, K extends string = string>(
  defsWithDefault: DefaultWithCustomizations<T, K>,
): DefQuery<T, K> => {
  const query: DefQuery<T, K>['query'] = key =>
    mergeSingleDefWithDefault(defsWithDefault.default, defsWithDefault.customizations[key])
  return {
    query,
    allKeys: () => Object.keys(defsWithDefault.customizations ?? {}) as K[],
    getAll: () =>
      _.pickBy(
        _.mapValues(defsWithDefault.customizations, (_def, k) => query(k as K)),
        lowerdashValues.isDefined,
      ) as Record<K, T>,
  }
}

export function mergeWithDefault<T, K extends string = string>(
  defsWithDefault: DefaultWithCustomizations<T, K>,
): Record<K, T>
export function mergeWithDefault<T>(defsWithDefault: DefaultWithCustomizations<T, string>): Record<string, T> {
  const query = queryWithDefault<T>(defsWithDefault)
  return _.pickBy(
    _.mapValues(defsWithDefault.customizations, (_val, k) => query.query(k)),
    lowerdashValues.isDefined,
  )
}

export const getNestedWithDefault = <T, TNested, K extends string>(
  defsWithDefault: DefaultWithCustomizations<T, K>,
  path: string,
): DefaultWithCustomizations<TNested, K> =>
  ({
    default: _.get(defsWithDefault.default, path),
    customizations: _.mapValues(defsWithDefault.customizations, (def: T) => _.get(def, path)),
    // TODO see if can avoid the cast
  }) as unknown as DefaultWithCustomizations<TNested, K>

/**
 * elem ids for instances can be defined in two places:
 * - the "system" definitions
 * - user-specified overrides that are added under fetch.elemID
 * this function combines these two, by treating the user-provided overrides as customizations
 * and giving them precedence when merging with the system definitions
 */
export const mergeWithUserElemIDDefinitions = <ClientOptions extends string>({
  userElemID,
  fetchConfig,
}: {
  userElemID: UserFetchConfig['elemID']
  fetchConfig?: FetchApiDefinitions<ClientOptions>
}): FetchApiDefinitions<ClientOptions> => {
  if (userElemID === undefined) {
    return fetchConfig ?? { instances: { customizations: {} } }
  }
  return _.merge({}, fetchConfig, {
    instances: {
      customizations: _.mapValues(userElemID, ({ extendSystemPartsDefinition, ...userDef }, type) => {
        const { elemID: systemDef } = fetchConfig?.instances.customizations[type]?.element?.topLevel ?? {}
        const elemIDDef = {
          ..._.defaults({}, userDef, systemDef),
          parts: extendSystemPartsDefinition ? (systemDef?.parts ?? []).concat(userDef.parts ?? []) : userDef.parts,
        }
        return {
          element: {
            topLevel: {
              elemID: elemIDDef,
            },
          },
        }
      }),
    },
  })
}
