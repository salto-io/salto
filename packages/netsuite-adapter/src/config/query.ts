/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { regex, strings } from '@salto-io/lowerdash'
import { ChangeDataType, ElemID, ProgressReporter, SaltoError } from '@salto-io/adapter-api'
import { FailedFiles, FailedTypes } from '../client/types'
import { CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT } from '../constants'
import { addCustomRecordTypePrefix } from '../types'
import { CriteriaQuery, FetchTypeQueryParams, IdsQuery, NetsuiteQueryParameters, ObjectID, QueryParams } from './types'
import { ALL_TYPES_REGEX } from './constants'
import { getTypesToInternalId } from '../data_elements/types'

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

export type NetsuiteFetchQueries = {
  updatedFetchQuery: NetsuiteQuery
  originFetchQuery: NetsuiteQuery
}

export type FetchByQueryFailures = {
  failedToFetchAllAtOnce: boolean
  failedFilePaths: FailedFiles
  failedTypes: FailedTypes
  failedCustomRecords: string[]
}

export type FetchByQueryReturnType = {
  elements: ChangeDataType[]
  fetchErrors: SaltoError[]
  deletedElements?: ElemID[]
  failures: FetchByQueryFailures
}

export type FetchByQueryFunc = (
  fetchQuery: NetsuiteQuery,
  progressReporter: ProgressReporter,
  useChangesDetection: boolean,
  isPartial: boolean,
) => Promise<FetchByQueryReturnType>

export const isCriteriaQuery = (type: FetchTypeQueryParams): type is CriteriaQuery => 'criteria' in type

export const isIdsQuery = (type: FetchTypeQueryParams): type is IdsQuery => !isCriteriaQuery(type)

export const convertToQueryParams = ({
  types = {},
  filePaths = [],
  customRecords = {},
}: NetsuiteQueryParameters): QueryParams => ({
  types: Object.entries(types).map(([name, ids]) => ({ name, ids })),
  fileCabinet: filePaths,
  customRecords: Object.entries(customRecords).map(([name, ids]) => ({ name, ids })),
})

const buildTypesQuery = (types: FetchTypeQueryParams[]): TypesQuery => {
  const matchingTypes = (typeName: string): FetchTypeQueryParams[] =>
    types.filter(type => regex.isFullRegexMatch(typeName, type.name))

  const matchingTypesRegexes = (typeName: string): string[] =>
    matchingTypes(typeName)
      .filter(isIdsQuery)
      .flatMap(type => type.ids ?? [ALL_TYPES_REGEX])

  return {
    isTypeMatch: typeName => matchingTypes(typeName).length > 0,
    areAllObjectsMatch: typeName => matchingTypesRegexes(typeName).some(id => id === ALL_TYPES_REGEX),
    isObjectMatch: ({ type, instanceId }) =>
      matchingTypesRegexes(type).some(reg => new RegExp(`^${reg}$`).test(instanceId)),
  }
}

const buildFileCabinetQuery = (fileMatchers: string[]): FileCabinetQuery => {
  const parentFolderMatchers = fileMatchers.flatMap(matcher =>
    _.range(matcher.length)
      .map(i => matcher.slice(0, i + 1))
      .filter(regex.isValidRegex)
      .map(reg => new RegExp(`^${reg}$`)),
  )
  return {
    isFileMatch: filePath => fileMatchers.some(reg => new RegExp(`^${reg}$`).test(filePath)),
    isParentFolderMatch: folderPath => parentFolderMatchers.some(matcher => matcher.test(folderPath)),
    areSomeFilesMatch: () => fileMatchers.length !== 0,
  }
}

export const buildNetsuiteQuery = ({
  types = [],
  fileCabinet = [],
  customRecords = [],
}: Partial<QueryParams>): NetsuiteQuery => {
  const { typeToInternalId } = getTypesToInternalId([])
  // This is to support the adapter configuration before the migration of
  // the SuiteApp type names from PascalCase to camelCase
  const fixedTypes = types.map(type => ({
    ...type,
    name:
      strings.lowerCaseFirstLetter(type.name) in typeToInternalId ? strings.lowerCaseFirstLetter(type.name) : type.name,
  }))

  const { isTypeMatch, areAllObjectsMatch, isObjectMatch } = buildTypesQuery(fixedTypes)
  const { isFileMatch, isParentFolderMatch, areSomeFilesMatch } = buildFileCabinetQuery(fileCabinet)
  const {
    isTypeMatch: isCustomRecordTypeMatch,
    areAllObjectsMatch: areAllCustomRecordsMatch,
    isObjectMatch: isCustomRecordMatch,
  } = buildTypesQuery(customRecords)

  return {
    isTypeMatch: typeName =>
      isTypeMatch(typeName) ||
      // some custom record types are fetched through their custom segment (customrecord_cseg*)
      (typeName === CUSTOM_SEGMENT && isTypeMatch(CUSTOM_RECORD_TYPE)),
    areAllObjectsMatch,
    isObjectMatch: obj =>
      isObjectMatch(obj) ||
      // in order to fetch a customrecord_cseg* custom record type
      // we need to fetch its cseg* custom segment
      (obj.type === CUSTOM_SEGMENT &&
        isObjectMatch({
          type: CUSTOM_RECORD_TYPE,
          instanceId: addCustomRecordTypePrefix(obj.instanceId),
        })),
    isFileMatch,
    isParentFolderMatch,
    areSomeFilesMatch,
    isCustomRecordTypeMatch,
    areAllCustomRecordsMatch,
    isCustomRecordMatch,
  }
}

export const andQuery = (firstQuery: NetsuiteQuery, secondQuery: NetsuiteQuery): NetsuiteQuery => ({
  isTypeMatch: typeName => firstQuery.isTypeMatch(typeName) && secondQuery.isTypeMatch(typeName),
  areAllObjectsMatch: typeName => firstQuery.areAllObjectsMatch(typeName) && secondQuery.areAllObjectsMatch(typeName),
  isObjectMatch: objectID => firstQuery.isObjectMatch(objectID) && secondQuery.isObjectMatch(objectID),
  isFileMatch: filePath => firstQuery.isFileMatch(filePath) && secondQuery.isFileMatch(filePath),
  isParentFolderMatch: folderPath =>
    firstQuery.isParentFolderMatch(folderPath) && secondQuery.isParentFolderMatch(folderPath),
  areSomeFilesMatch: () => firstQuery.areSomeFilesMatch() && secondQuery.areSomeFilesMatch(),
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
