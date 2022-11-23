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
import _ from 'lodash'
import { regex, strings } from '@salto-io/lowerdash'
import { getStandardTypesNames } from './autogen/types'
import { INCLUDE, EXCLUDE, LOCKED_ELEMENTS_TO_EXCLUDE, AUTHOR_INFO_CONFIG, CONFIG_FEATURES, STRICT_INSTANCE_STRUCTURE, FIELDS_TO_OMIT } from './constants'
import { SUPPORTED_TYPES, TYPES_TO_INTERNAL_ID } from './data_elements/types'
import { SUITEAPP_CONFIG_TYPE_NAMES } from './types'

const ERROR_MESSAGE_PREFIX = 'Received invalid adapter config input.'

export interface ObjectID {
  type: string
  instanceId: string
}
export type NetsuiteTypesQueryParams = Record<string, string[]>
export type NetsuiteFilePathsQueryParams = string[]
// deprecated
export type NetsuiteQueryParameters = {
  types?: NetsuiteTypesQueryParams
  filePaths?: NetsuiteFilePathsQueryParams
  // SALTO-2994 uncomment in order to support custom records quick fetch
  // customRecords?: NetsuiteTypesQueryParams
}

export type FetchTypeQueryParams = {
  name: string
  ids?: string[]
}

export type QueryParams = {
  types: FetchTypeQueryParams[]
  fileCabinet: string[]
  customRecords?: FetchTypeQueryParams[]
}

export type FieldToOmitParams = {
  type: string
  fields: string[]
}

export type FetchParams = {
  [INCLUDE]?: QueryParams
  [EXCLUDE]?: QueryParams
  [LOCKED_ELEMENTS_TO_EXCLUDE]?: QueryParams
  [AUTHOR_INFO_CONFIG]?: {
    enable?: boolean
  }
  [STRICT_INSTANCE_STRUCTURE]?: boolean
  [FIELDS_TO_OMIT]?: FieldToOmitParams[]
}

export const convertToQueryParams = ({
  types = {}, filePaths = [], // customRecords = {},
}: NetsuiteQueryParameters): QueryParams => ({
  types: Object.entries(types).map(([name, ids]) => ({ name, ids })),
  fileCabinet: filePaths,
  // SALTO-2994 uncomment in order to support custom records quick fetch
  // customRecords: Object.entries(customRecords).map(([name, ids]) => ({ name, ids })),
})

export type TypesQuery = {
  isTypeMatch: (typeName: string) => boolean
  areAllObjectsMatch: (typeName: string) => boolean
  isObjectMatch: (objectID: ObjectID) => boolean
}

export type FileCabinetQuery = {
  isFileMatch: (filePath: string) => boolean
  isParentFolderMatch: (folderPath: string) => boolean
  areSomeFilesMatch: () => boolean
}

export type CustomRecordsQuery = {
  isCustomRecordTypeMatch: (typeName: string) => boolean
  areAllCustomRecordsMatch: (typeName: string) => boolean
  isCustomRecordMatch: (objectID: ObjectID) => boolean
}

export type NetsuiteQuery = TypesQuery & FileCabinetQuery & CustomRecordsQuery

const checkTypeNameRegMatch = (type: FetchTypeQueryParams, str: string): boolean =>
  regex.isFullRegexMatch(str, type.name)

export const validateFetchParameters = ({ types, fileCabinet }:
  Partial<QueryParams>): void => {
  if (!Array.isArray(types) || !Array.isArray(fileCabinet)) {
    const typesErr = !Array.isArray(types) ? ' "types" field is expected to be an array\n' : ''
    const fileCabinetErr = !Array.isArray(fileCabinet) ? ' "fileCabinet" field is expected to be an array\n' : ''
    const message = `${ERROR_MESSAGE_PREFIX}${typesErr}${fileCabinetErr}`
    throw new Error(message)
  }
  const corruptedTypesNames = types.filter(obj => (obj.name === undefined || typeof obj.name !== 'string'))
  if (corruptedTypesNames.length !== 0) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} Expected type name to be a string, but found:\n${JSON.stringify(corruptedTypesNames, null, 4)}.`)
  }
  const corruptedTypesIds = types.filter(obj => (obj.ids !== undefined && (!Array.isArray(obj.ids) || obj.ids.some(id => typeof id !== 'string'))))
  if (corruptedTypesIds.length !== 0) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} Expected type ids to be an array of strings, but found:\n${JSON.stringify(corruptedTypesIds, null, 4)}}.`)
  }
  const existingTypes = [
    ...getStandardTypesNames(),
    ...SUPPORTED_TYPES,
    ...SUITEAPP_CONFIG_TYPE_NAMES,
    CONFIG_FEATURES,
  ]
  const receivedTypes = types.map(obj => obj.name)
  const idsRegexes = types
    .map(obj => obj.ids)
    .flatMap(list => list ?? ['.*'])

  const invalidRegexes = idsRegexes
    .concat(fileCabinet)
    .concat(receivedTypes)
    .filter(reg => !regex.isValidRegex(reg))

  if (invalidRegexes.length !== 0) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} The following regular expressions are invalid:\n${invalidRegexes}.`)
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
    throw new Error(`${ERROR_MESSAGE_PREFIX} The following types or regular expressions do not match any supported type:\n${invalidTypes}.`)
  }
}

export const validateFieldsToOmitConfig = (fieldsToOmitConfig: unknown): void => {
  if (!Array.isArray(fieldsToOmitConfig)) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} "${FIELDS_TO_OMIT}" field is expected to be an array`)
  }
  const corruptedTypes = fieldsToOmitConfig.filter(obj => typeof obj.type !== 'string')
  if (corruptedTypes.length !== 0) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} Expected "type" field to be a string, but found:\n${JSON.stringify(corruptedTypes, null, 4)}.`)
  }
  const corruptedFields = fieldsToOmitConfig.filter(
    obj => !Array.isArray(obj.fields)
    || obj.fields.length === 0
    || obj.fields.some((item: unknown) => typeof item !== 'string')
  )
  if (corruptedFields.length !== 0) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} Expected "fields" field to be an array of strings, but found:\n${JSON.stringify(corruptedFields, null, 4)}.`)
  }
  const invalidRegexes = fieldsToOmitConfig
    .flatMap(obj => [obj.type, ...obj.fields])
    .filter(reg => !regex.isValidRegex(reg))
  if (invalidRegexes.length !== 0) {
    throw new Error(`${ERROR_MESSAGE_PREFIX} The following regular expressions are invalid:\n${JSON.stringify(invalidRegexes, null, 4)}.`)
  }
}

const buildTypesQuery = (types: FetchTypeQueryParams[]): TypesQuery => {
  const matchingTypes = (typeName: string): FetchTypeQueryParams[] =>
    types.filter(type => checkTypeNameRegMatch(type, typeName))

  const matchingTypesRegexes = (typeName: string): string[] =>
    matchingTypes(typeName)
      .flatMap(type => type.ids ?? ['.*'])

  return {
    isTypeMatch: typeName =>
      matchingTypes(typeName).length > 0,
    areAllObjectsMatch: typeName =>
      matchingTypesRegexes(typeName).some(id => id === '.*'),
    isObjectMatch: ({ type, instanceId }) =>
      matchingTypesRegexes(type).some(reg => new RegExp(`^${reg}$`).test(instanceId)),
  }
}

const buildFileCabinetQuery = (fileMatchers: string[]): FileCabinetQuery => {
  const parentFolderMatchers = fileMatchers.flatMap(
    matcher => _.range(matcher.length).map(i => new RegExp(`^${matcher.slice(0, i + 1)}$`))
  )
  return {
    isFileMatch: filePath =>
      fileMatchers.some(reg => new RegExp(`^${reg}$`).test(filePath)),
    isParentFolderMatch: folderPath =>
      parentFolderMatchers.some(matcher => matcher.test(folderPath)),
    areSomeFilesMatch: () => fileMatchers.length !== 0,
  }
}

export const buildNetsuiteQuery = (
  { types = [], fileCabinet = [], customRecords = [] }: Partial<QueryParams>
): NetsuiteQuery => {
  // This is to support the adapter configuration before the migration of
  // the SuiteApp type names from PascalCase to camelCase
  const fixedTypes = types.map(type => ({
    ...type,
    name: strings.lowerCaseFirstLetter(type.name) in TYPES_TO_INTERNAL_ID
      ? strings.lowerCaseFirstLetter(type.name)
      : type.name,
  }))

  const {
    isTypeMatch,
    areAllObjectsMatch,
    isObjectMatch,
  } = buildTypesQuery(fixedTypes)
  const {
    isFileMatch,
    isParentFolderMatch,
    areSomeFilesMatch,
  } = buildFileCabinetQuery(fileCabinet)
  const {
    isTypeMatch: isCustomRecordTypeMatch,
    areAllObjectsMatch: areAllCustomRecordsMatch,
    isObjectMatch: isCustomRecordMatch,
  } = buildTypesQuery(customRecords)

  return {
    isTypeMatch,
    areAllObjectsMatch,
    isObjectMatch,
    isFileMatch,
    isParentFolderMatch,
    areSomeFilesMatch,
    isCustomRecordTypeMatch,
    areAllCustomRecordsMatch,
    isCustomRecordMatch,
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
  isParentFolderMatch: folderPath =>
    firstQuery.isParentFolderMatch(folderPath) && secondQuery.isParentFolderMatch(folderPath),
  areSomeFilesMatch: () =>
    firstQuery.areSomeFilesMatch() && secondQuery.areSomeFilesMatch(),
  isCustomRecordTypeMatch: typeName =>
    firstQuery.isCustomRecordTypeMatch(typeName) && secondQuery.isCustomRecordTypeMatch(typeName),
  areAllCustomRecordsMatch: typeName =>
    firstQuery.areAllCustomRecordsMatch(typeName) && secondQuery.areAllCustomRecordsMatch(typeName),
  isCustomRecordMatch: objectID =>
    firstQuery.isCustomRecordMatch(objectID) && secondQuery.isCustomRecordMatch(objectID),
})

export const notQuery = (query: NetsuiteQuery): NetsuiteQuery => ({
  isTypeMatch: typeName => !query.areAllObjectsMatch(typeName),
  areAllObjectsMatch: typeName => !query.isTypeMatch(typeName),
  isObjectMatch: objectID => !query.isObjectMatch(objectID),
  isFileMatch: filePath => !query.isFileMatch(filePath),
  isParentFolderMatch: () => true,
  areSomeFilesMatch: () => true,
  isCustomRecordTypeMatch: typeName => !query.areAllCustomRecordsMatch(typeName),
  areAllCustomRecordsMatch: typeName => !query.isCustomRecordTypeMatch(typeName),
  isCustomRecordMatch: objectID => !query.isCustomRecordMatch(objectID),
})
