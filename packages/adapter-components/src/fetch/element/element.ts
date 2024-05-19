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
import { ElemIdGetter, Element, ObjectType, SaltoError, SeverityLevel, Values } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { FetchElements } from '../types'
import { generateInstancesWithInitialTypes } from './instance_element'
import { InvalidSingletonType, getReachableTypes, hideAndOmitFields, overrideFieldTypes } from './type_utils'
import { ElementAndResourceDefFinder } from '../../definitions/system/fetch/types'
import { FetchApiDefinitionsOptions } from '../../definitions/system/fetch'
import { ConfigChangeSuggestion, NameMappingFunctionMap, ResolveCustomNameMappingOptionsType } from '../../definitions'
import { omitInstanceValues } from './instance_utils'
import { AbortFetchOnFailure } from '../errors'

const log = logger(module)

export type ElementGenerator = {
  /*
   * send the element generator entries that will become an instance of the specified type
   * (if the type's definition contains standalone fields, then more than one instance).
   * the generator runs basic validations and adds the entries to the queue.
   */
  pushEntries: (args: { typeName: string; entries: unknown[] }) => void

  // handle an error that occurred while fetching a specific type using the 'resource.onError' definition
  handleError: (args: { typeName: string; error: Error }) => void

  // produce all types and instances based on all entries processed until now
  generate: () => FetchElements
}

export const getElementGenerator = <Options extends FetchApiDefinitionsOptions>({
  adapterName,
  defQuery,
  predefinedTypes = {},
  customNameMappingFunctions,
  getElemIdFunc,
}: {
  adapterName: string
  defQuery: ElementAndResourceDefFinder<Options>
  customNameMappingFunctions?: NameMappingFunctionMap<ResolveCustomNameMappingOptionsType<Options>>
  predefinedTypes?: Record<string, ObjectType>
  getElemIdFunc?: ElemIdGetter
}): ElementGenerator => {
  const valuesByType: Record<string, Values[]> = {}
  const customSaltoErrors: SaltoError[] = []
  const configSuggestions: ConfigChangeSuggestion[] = []

  const pushEntries: ElementGenerator['pushEntries'] = ({ typeName, entries }) => {
    const { element: elementDef } = defQuery.query(typeName) ?? {}
    const valueGuard = elementDef?.topLevel?.valueGuard ?? lowerdashValues.isPlainObject
    const [validEntries, invalidEntries] = _.partition(entries, valueGuard)
    if (invalidEntries.length > 0) {
      log.warn(
        '[%s] omitted %d entries of type %s that did not match the value guard, first item:',
        adapterName,
        invalidEntries.length,
        typeName,
        safeJsonStringify(invalidEntries[0]),
      )
    }

    // TODO make sure type + service ids are unique
    if (valuesByType[typeName] === undefined) {
      valuesByType[typeName] = []
    }
    valuesByType[typeName].push(...validEntries)
  }

  const handleError: ElementGenerator['handleError'] = ({ typeName, error }) => {
    // This can happen if the error was thrown inside a sub-type that has failEntireFetch set to true.
    // In this case we should not call the parent's onError function.
    if (error instanceof AbortFetchOnFailure) {
      throw error
    }

    const { resource: resourceDef } = defQuery.query(typeName) ?? {}
    const onError = resourceDef?.onError

    const onErrorResult = onError?.custom?.(onError)({ error, typeName }) ?? onError
    switch (onErrorResult?.action) {
      case 'customSaltoError':
        log.warn('failed to fetch type %s:%s, generating custom Salto error', adapterName, typeName)
        customSaltoErrors.push(onErrorResult.value)
        break
      case 'configSuggestion':
        log.warn('failed to fetch type %s:%s, generating config suggestions', adapterName, typeName)
        configSuggestions.push(onErrorResult.value)
        break
      case 'failEntireFetch': {
        if (onErrorResult.value) {
          throw new AbortFetchOnFailure({ adapterName, typeName, message: error.message })
        }
      }
      // eslint-disable-next-line no-fallthrough
      case undefined:
      default:
        log.warn('failed to fetch type %s:%s: %s', adapterName, typeName, error.message)
    }
  }

  const generate: ElementGenerator['generate'] = () => {
    const allResults = Object.entries(valuesByType).flatMap(([typeName, values]) => {
      try {
        return generateInstancesWithInitialTypes({
          adapterName,
          defQuery,
          entries: values,
          typeName,
          definedTypes: predefinedTypes,
          getElemIdFunc,
          customNameMappingFunctions,
        })
      } catch (e) {
        // TODO decide how to handle error based on args (SALTO-5842)
        if (e instanceof InvalidSingletonType) {
          return { instances: [], types: [], errors: [{ message: e.message, severity: 'Warning' as SeverityLevel }] }
        }
        throw e
      }
    })
    const instances = allResults.flatMap(e => e.instances)
    const [finalTypeLists, typeListsToAdjust] = _.partition(allResults, t => t.typesAreFinal)
    const finalTypeNames = new Set(finalTypeLists.flatMap(t => t.types).map(t => t.elemID.name))
    const definedTypes = _.defaults(
      {},
      _.keyBy(
        // concatenating in this order so that the final types will take precedence
        typeListsToAdjust.concat(finalTypeLists).flatMap(t => t.types),
        t => t.elemID.name,
      ),
      predefinedTypes,
    )

    overrideFieldTypes({ definedTypes, defQuery, finalTypeNames })
    // omit fields based on the adjusted types
    instances.forEach(inst => {
      inst.value = omitInstanceValues({ value: inst.value, type: inst.getTypeSync(), defQuery })
    })

    hideAndOmitFields({ definedTypes, defQuery, finalTypeNames })

    // only return types that are reachable from instances or definitions
    const filteredTypes = getReachableTypes({ instances, types: Object.values(definedTypes), defQuery })
    return {
      elements: (instances as Element[]).concat(filteredTypes),
      errors: customSaltoErrors.concat(allResults.flatMap(t => t.errors ?? [])),
      configChanges: configSuggestions,
    }
  }
  return {
    pushEntries,
    handleError,
    generate,
  }
}
