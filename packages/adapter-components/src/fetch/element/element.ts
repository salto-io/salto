/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ElemIdGetter, Element, ObjectType, SaltoError, SeverityLevel, Values } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { FetchElements } from '../types'
import { generateInstancesWithInitialTypes } from './instance_element'
import {
  InvalidSingletonType,
  getReachableTypes,
  hideAndOmitFields,
  overrideFieldTypes,
  createRemainingTypes,
  addImportantValues,
} from './type_utils'
import { ElementAndResourceDefFinder } from '../../definitions/system/fetch/types'
import { FetchApiDefinitionsOptions } from '../../definitions/system/fetch'
import { ConfigChangeSuggestion, NameMappingFunctionMap, ResolveCustomNameMappingOptionsType } from '../../definitions'
import { omitAllInstancesValues } from './instance_utils'
import { AbortFetchOnFailure } from '../errors'
import { UnauthorizedError } from '../../client'

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
        '[%s] omitted %d entries of type %s that did not match the value guard, first item: %s',
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
    validEntries.forEach(entry => valuesByType[typeName].push(entry))
  }

  const handleError: ElementGenerator['handleError'] = ({ typeName, error }) => {
    // AbortFetchOnFailure can happen if the error was thrown inside a sub-type that has failEntireFetch set to true.
    // In this case we should not call the parent's onError function.
    if (error instanceof AbortFetchOnFailure || error instanceof UnauthorizedError) {
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
      case 'ignoreError': {
        log.debug(
          'failed to fetch type %s:%s, suppressing error with no action: %s',
          adapterName,
          typeName,
          error.message,
        )
        break
      }
      case 'failEntireFetch': {
        if (onErrorResult.value) {
          throw new AbortFetchOnFailure({ adapterName, typeName, message: error.message })
        }
      }
      // eslint-disable-next-line no-fallthrough
      case undefined:
      default:
        log.error('unexpectedly failed to fetch type %s:%s: %s', adapterName, typeName, error.message, {
          adapterName,
          typeName,
        })
    }
  }

  const generate: ElementGenerator['generate'] = () => {
    const allResults = Object.entries(valuesByType).flatMap(([typeName, values]) => {
      try {
        return defQuery.query(typeName)?.element?.topLevel === undefined
          ? { instances: [], types: [] }
          : generateInstancesWithInitialTypes({
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
          return {
            instances: [],
            types: [],
            errors: [{ message: e.message, detailedMessage: e.message, severity: 'Warning' as SeverityLevel }],
          }
        }
        throw e
      }
    })
    const instances = allResults.flatMap(e => e.instances)
    const [finalTypeLists, typeListsToAdjust] = _.partition(allResults, t => t.typesAreFinal)
    const finalTypeNames = new Set(finalTypeLists.flatMap(t => t.types).map(t => t.elemID.name))
    const typesByTypeName = _.keyBy(
      // concatenating in this order so that the final types will take precedence
      typeListsToAdjust.concat(finalTypeLists).flatMap(t => t.types),
      t => t.elemID.name,
    )
    const remainingTypes = createRemainingTypes({ adapterName, definedTypes: typesByTypeName, defQuery })
    const definedTypes = _.defaults({}, typesByTypeName, predefinedTypes, remainingTypes)

    overrideFieldTypes({ definedTypes, defQuery, finalTypeNames })
    // omit fields based on the adjusted types
    omitAllInstancesValues({ instances, defQuery })
    hideAndOmitFields({ definedTypes, defQuery, finalTypeNames })
    addImportantValues({ definedTypes, defQuery, finalTypeNames })

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
