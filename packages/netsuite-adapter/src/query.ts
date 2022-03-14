/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { regex, strings } from '@salto-io/lowerdash'
import { getCustomTypesNames } from './autogen/types'
import { INCLUDE, EXCLUDE, LOCKED_ELEMENTS_TO_EXCLUDE, AUTHOR_INFO_CONFIG, ACCOUNT_FEATURES } from './constants'
import { SUPPORTED_TYPES, TYPES_TO_INTERNAL_ID } from './data_elements/types'

export interface ObjectID {
  type: string
  instanceId: string
}
// deprecated
export type NetsuiteQueryParameters = {
  types: Record<string, Array<string>>
  filePaths: Array<string>
}

export type FetchTypeQueryParams = {
  name: string
  ids?: string[]
}

export type QueryParams = {
  types: FetchTypeQueryParams[]
  fileCabinet: string[]
}

export type FetchParams = {
  [INCLUDE]?: QueryParams
  [EXCLUDE]?: QueryParams
  [LOCKED_ELEMENTS_TO_EXCLUDE]?: QueryParams
  [AUTHOR_INFO_CONFIG]?: {
    enable?: boolean
  }
}

export const convertToQueryParams = ({ types = {}, filePaths = [] }:
  Partial<NetsuiteQueryParameters>): QueryParams => {
  const newTypes = Object.entries(types).map(([name, ids]) => ({ name, ids }))
  return ({ types: newTypes, fileCabinet: filePaths })
}

export type NetsuiteQuery = {
  isTypeMatch: (typeName: string) => boolean
  areAllObjectsMatch: (typeName: string) => boolean
  isObjectMatch: (objectID: ObjectID) => boolean
  isFileMatch: (filePath: string) => boolean
  areSomeFilesMatch: () => boolean
}

const checkTypeNameRegMatch = (type: FetchTypeQueryParams, str: string): boolean =>
  new RegExp(`^${type.name}$`).test(str)

export const validateFetchParameters = ({ types, fileCabinet }:
  Partial<QueryParams>): void => {
  const errMessagePrefix = 'received invalid adapter config input.'
  if (!Array.isArray(types) || !Array.isArray(fileCabinet)) {
    const typesErr = !Array.isArray(types) ? ' "types" field is expected to be an array\n' : ''
    const fileCabinetErr = !Array.isArray(fileCabinet) ? ' "fileCabinet" field is expected to be an array\n' : ''
    const message = `${errMessagePrefix}${typesErr}${fileCabinetErr}`
    throw new Error(message)
  }
  const corruptedTypesNames = types.filter(obj => (obj.name === undefined || typeof obj.name !== 'string'))
  if (corruptedTypesNames.length !== 0) {
    throw new Error(`${errMessagePrefix} Expected type name to be a string, but found:\n${JSON.stringify(corruptedTypesNames, null, 4)}.`)
  }
  const corruptedTypesIds = types.filter(obj => (obj.ids !== undefined && (!Array.isArray(obj.ids) || obj.ids.some(id => typeof id !== 'string'))))
  if (corruptedTypesIds.length !== 0) {
    throw new Error(`${errMessagePrefix} Expected type ids to be an array of strings, but found:\n${JSON.stringify(corruptedTypesIds, null, 4)}}.`)
  }
  const existingTypes = [...getCustomTypesNames(), ...SUPPORTED_TYPES, ACCOUNT_FEATURES]
  const receivedTypes = types.map(obj => obj.name)
  const idsRegexes = types
    .map(obj => obj.ids)
    .flatMap(list => list ?? ['.*'])

  const invalidRegexes = idsRegexes
    .concat(fileCabinet)
    .concat(receivedTypes)
    .filter(reg => !regex.isValidRegex(reg))

  if (invalidRegexes.length !== 0) {
    throw new Error(`${errMessagePrefix} The following regular expressions are invalid:\n${invalidRegexes}.`)
  }

  const invalidTypes = receivedTypes
    .filter(recivedTypeName =>
      !existingTypes
        .some(existTypeName => checkTypeNameRegMatch({ name: recivedTypeName }, existTypeName)
          // This is to support the adapter configuration before the migration of
          // the SuiteApp type names from PascalCase to camelCase
          || checkTypeNameRegMatch({ name: recivedTypeName },
            strings.capitalizeFirstLetter(existTypeName))))

  if (invalidTypes.length !== 0) {
    throw new Error(`${errMessagePrefix} The following types or regular expressions do not match any supported type:\n${invalidTypes}.`)
  }
}

export const buildNetsuiteQuery = (
  { types = [], fileCabinet = [] }: Partial<QueryParams>
): NetsuiteQuery => {
  // This is to support the adapter configuration before the migration of
  // the SuiteApp type names from PascalCase to camelCase
  const fixedTypes = types.map(type => ({
    ...type,
    name: strings.lowerCaseFirstLetter(type.name) in TYPES_TO_INTERNAL_ID
      ? strings.lowerCaseFirstLetter(type.name)
      : type.name,
  }))

  const matchingTypes = (typeName: string): FetchTypeQueryParams[] =>
    fixedTypes.filter(type => checkTypeNameRegMatch(type, typeName))
  const matchingTypesRegexes = (typeName: string): string[] =>
    matchingTypes(typeName)
      .flatMap(type => type.ids ?? ['.*'])
  return {
    isTypeMatch: typeName => matchingTypes(typeName).length > 0,
    areAllObjectsMatch: typeName =>
      matchingTypesRegexes(typeName)
        .some(id => id === '.*'),
    isObjectMatch: objectID =>
      matchingTypesRegexes(objectID.type)
        .some(reg => new RegExp(`^${reg}$`).test(objectID.instanceId)),
    isFileMatch: filePath =>
      fileCabinet.some(reg => new RegExp(`^${reg}$`).test(filePath)),
    areSomeFilesMatch: () => fileCabinet.length !== 0,
  }
}

export const andQuery = (firstQuery: NetsuiteQuery, secondQuery: NetsuiteQuery): NetsuiteQuery => ({
  isTypeMatch: typeName =>
    firstQuery.isTypeMatch(typeName) && secondQuery.isTypeMatch(typeName),
  areAllObjectsMatch: typeName =>
    firstQuery.areAllObjectsMatch(typeName) && secondQuery.areAllObjectsMatch(typeName),
  isObjectMatch: objectID =>
    firstQuery.isObjectMatch(objectID) && secondQuery.isObjectMatch(objectID),
  isFileMatch: filePath =>
    firstQuery.isFileMatch(filePath) && secondQuery.isFileMatch(filePath),
  areSomeFilesMatch: () => firstQuery.areSomeFilesMatch() && secondQuery.areSomeFilesMatch(),
})

export const notQuery = (query: NetsuiteQuery): NetsuiteQuery => ({
  isTypeMatch: typeName => !query.areAllObjectsMatch(typeName),
  areAllObjectsMatch: typeName => !query.isTypeMatch(typeName),
  isObjectMatch: objectID => !query.isObjectMatch(objectID),
  isFileMatch: filePath => !query.isFileMatch(filePath),
  areSomeFilesMatch: () => true,
})
