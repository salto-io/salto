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
import { Value, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { RequiredDefinitions } from './types'
import { APIDefinitionsOptions } from './api'

const log = logger(module)
export const DEFINITIONS_OVERRIDES = 'DEFINITION_OVERRIDES'

export const getParsedDefinitionsOverrides = (): Values => {
  const flagValue = process.env[DEFINITIONS_OVERRIDES]
  let parsedFlagValue: unknown
  try {
    parsedFlagValue = flagValue === undefined ? undefined : JSON.parse(flagValue)
  } catch (e) {
    if (e instanceof SyntaxError) {
      log.error('There was a syntax error in the JSON while parsing a flag:', e.message)
    } else {
      log.error('An unknown error occurred while parsing a flag:', e)
    }
  }
  if (parsedFlagValue !== undefined && typeof parsedFlagValue === 'object') {
    return parsedFlagValue as Values
  }
  return {}
}

export const mergeDefinitionsWithOverrides = <Options extends APIDefinitionsOptions>(
  definitions: RequiredDefinitions<Options>,
  overrides: Values,
): RequiredDefinitions<Options> => {
  const customMerge = (objValue: Value, srcValue: Value): Value => {
    if (_.isArray(objValue)) {
      return srcValue
    }
    if (srcValue === null) {
      return undefined // Remove the property
    }
    if (_.isObject(objValue) && _.isObject(srcValue)) {
      const result = _.mergeWith({}, objValue, srcValue, customMerge)
      return _.isEmpty(result) ? undefined : result // Remove empty objects
    }
    return srcValue
  }
  if (_.isEmpty(overrides)) {
    return definitions
  }
  return _.mergeWith(definitions, overrides, customMerge)
}
