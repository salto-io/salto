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

import { collections, regex } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FETCH_TARGET } from './constants'
import { customTypes } from './types'

export interface ObjectID {
  type: string
  scriptId: string
}

export type NetsuiteQueryParameters = {
  types: Record<string, Array<string>>
  filePaths: Array<string>
}

export type NetsuiteQuery = {
  isTypeMatch: (typeName: string) => boolean
  isObjectMatch: (objectID: ObjectID) => boolean
  isFileMatch: (filePath: string) => boolean
}

export const validateParameters = ({ types = {}, filePaths = [] }:
  Partial<NetsuiteQueryParameters>): void => {
  const parameters = { types, filePaths }

  const existingTypes = new Set(Object.keys(customTypes))
  const receivedTypes = new Set(Object.keys(parameters.types))

  const invalidTypes = collections.set.difference(receivedTypes, existingTypes)

  const invalidRegexes = _.flatten(Object.values(parameters.types))
    .concat(parameters.filePaths)
    .filter(reg => !regex.isValidRegex(reg))

  if (invalidRegexes.length !== 0 || invalidTypes.size !== 0) {
    const invalidRegexesMessage = invalidRegexes.length !== 0 ? ` The following regular expressions are invalid: ${invalidRegexes}.` : ''
    const invalidTypesMessage = invalidTypes.size !== 0 ? ` The following types do not exist: ${Array.from(invalidTypes)}.` : ''
    const message = `received invalid ${FETCH_TARGET} input.${invalidRegexesMessage}${invalidTypesMessage}`
    throw new Error(message)
  }
}

export const buildNetsuiteQuery = (
  { types = {}, filePaths = [] }: Partial<NetsuiteQueryParameters>
): NetsuiteQuery => {
  const parameters = { types, filePaths }
  return {
    isTypeMatch: typeName => parameters.types[typeName] !== undefined,
    isObjectMatch: objectID => {
      const regexes = parameters.types[objectID.type]
      if (regexes === undefined) {
        return false
      }
      return regexes.some(reg => new RegExp(`^${reg}$`).test(objectID.scriptId))
    },
    isFileMatch: filePath =>
      parameters.filePaths.some(reg => new RegExp(`^${reg}$`).test(filePath)),
  }
}

export const andQuery = (firstQuery: NetsuiteQuery, secondQuery: NetsuiteQuery): NetsuiteQuery => ({
  isTypeMatch: typeName =>
    firstQuery.isTypeMatch(typeName) && secondQuery.isTypeMatch(typeName),
  isObjectMatch: objectID =>
    firstQuery.isObjectMatch(objectID) && secondQuery.isObjectMatch(objectID),
  isFileMatch: filePath =>
    firstQuery.isFileMatch(filePath) && secondQuery.isFileMatch(filePath),
})

export const notQuery = (query: NetsuiteQuery): NetsuiteQuery => ({
  isTypeMatch: typeName => !query.isTypeMatch(typeName),
  isObjectMatch: objectID => !query.isObjectMatch(objectID),
  isFileMatch: filePath => !query.isFileMatch(filePath),
})
