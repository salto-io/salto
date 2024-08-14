/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Value, Values } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { RequiredDefinitions } from './types'
import { APIDefinitionsOptions } from './api'

const log = logger(module)
export const DEFINITIONS_OVERRIDES = 'SALTO_DEFINITIONS_OVERRIDES'

const getParsedDefinitionsOverrides = (accountName: string): Values => {
  const overrides = process.env[DEFINITIONS_OVERRIDES]
  try {
    const parsedOverrides = overrides === undefined ? undefined : JSON.parse(overrides)
    if (
      parsedOverrides !== undefined &&
      parsedOverrides[accountName] !== undefined &&
      typeof parsedOverrides === 'object'
    ) {
      return parsedOverrides[accountName] as Values
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      log.error('There was a syntax error in the JSON while parsing the overrides: %s, stack: %s', e, e.stack)
    } else {
      log.error('An unknown error occurred while parsing the overrides: %s, stack: %s', e, e.stack)
    }
  }
  return {}
}

/**
 * merge definitions with overrides from the environment variable SALTO_DEFINITIONS_OVERRIDES
 * the merge is done as follows:
 * - overrides takes precedence over definitions
 * - when merging an array the overrides array is used instead of the definitions array completely (no merge)
 * - when merging an object the overrides object is merged with the definitions object recursively
 * - we can use null to remove a field from the definitions as we override the original value with null and then remove it
 */
export const mergeDefinitionsWithOverrides = <Options extends APIDefinitionsOptions>(
  definitions: RequiredDefinitions<Options>,
  accountName?: string,
): RequiredDefinitions<Options> => {
  const customMerge = (objValue: Value, srcValue: Value): Value => {
    if (_.isArray(objValue)) {
      return srcValue
    }
    return undefined
  }
  if (accountName === undefined) {
    log.error('Account name is undefined, cannot merge definitions with overrides')
    return definitions
  }
  log.debug('starting to merge definitions with overrides')
  const overrides = getParsedDefinitionsOverrides(accountName)
  if (_.isEmpty(overrides)) {
    return definitions
  }
  log.debug('Definitions overrides: %s', safeJsonStringify(overrides))
  const cloneDefinitions = _.cloneDeep(definitions)
  const merged = _.mergeWith(cloneDefinitions, overrides, customMerge)
  const removeNullObjects = (obj: Value): Value => {
    if (_.isArray(obj)) {
      return obj.map(removeNullObjects)
    }
    if (_.isPlainObject(obj)) {
      const cleanedObj = _.omitBy(obj, _.isNull)
      return _.mapValues(cleanedObj, removeNullObjects)
    }
    return obj
  }
  const afterRemoveNullObjects = removeNullObjects(merged)
  log.debug('Merged definitions with overrides: %s', safeJsonStringify(afterRemoveNullObjects))
  return afterRemoveNullObjects
}
