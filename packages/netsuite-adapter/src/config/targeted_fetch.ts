/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { posix } from 'path'
import { collections } from '@salto-io/lowerdash'
import { ElemID, PartialFetchOperations, PartialFetchTarget, PartialFetchTargetWithPath } from '@salto-io/adapter-api'
import { invertNaclCase } from '@salto-io/adapter-utils'
import { enums } from '../autogen/types/enums'
import { customrecordactionscriptType } from '../autogen/types/standard_types/customrecordactionscript'
import { customrecordtypeType } from '../autogen/types/standard_types/customrecordtype'
import {
  CUSTOM_RECORD_TYPE_NAME_PREFIX,
  REFERENCE_TYPE_SUFFIX,
  FOLDER,
  FILE_CABINET_PATH_SEPARATOR,
  CUSTOM_RECORD_TYPE,
  FILE,
} from '../constants'
import { standardTypesAliasMap, dataTypesAliasMap, settingsAliasMap } from '../filters/add_alias'
import { netsuiteConfigFromConfig } from './config_creator'
import { andQuery, buildNetsuiteQuery, NetsuiteQuery, notQuery } from './query'
import { isSDFConfigTypeName, isSuiteAppConfigTypeName } from '../types'

const { awu } = collections.asynciterable

const TYPES_GROUP = 'types'
const FILE_CABINET_GROUP = 'fileCabinet'
const CUSTOM_RECORDS_GROUP = 'customRecords'

const FILE_CABINET_PATH = ['File Cabinet']
const CUSTOM_RECORDS_PATH = ['Custom Records']
const SETTINGS_PATH = ['Settings']

const createIsCustomRecordTypeNameFunc = () => {
  const otherStandardTypes = [customrecordtypeType(), customrecordactionscriptType()]

  return (name: string): boolean =>
    name.startsWith(CUSTOM_RECORD_TYPE_NAME_PREFIX) &&
    !name.endsWith(REFERENCE_TYPE_SUFFIX) &&
    !otherStandardTypes.some(({ type, innerTypes }) => type.elemID.name === name || innerTypes[name] !== undefined) &&
    enums[name] === undefined
}

export const getAllTargets: PartialFetchOperations['getAllTargets'] = async ({
  elementsSource,
  config: configInstance,
  getAlias,
}) => {
  const { config } = netsuiteConfigFromConfig(configInstance, { throwOnError: false })

  const fetchQuery = andQuery(
    buildNetsuiteQuery(config.fetch.include),
    notQuery(buildNetsuiteQuery(config.fetch.exclude)),
  )

  const standardTypesTargets: PartialFetchTargetWithPath[] = Object.entries(standardTypesAliasMap)
    .map(([typeName, alias]) => ({ group: TYPES_GROUP, name: typeName, path: [alias] }))
    .filter(type => fetchQuery.isTypeMatch(type.name))

  const dataTypesTargets: PartialFetchTargetWithPath[] = Object.entries(dataTypesAliasMap)
    .map(([typeName, alias]) => ({ group: TYPES_GROUP, name: typeName, path: [alias] }))
    .filter(type => fetchQuery.isTypeMatch(type.name))

  const settingsTargets: PartialFetchTargetWithPath[] = Object.entries(settingsAliasMap)
    .map(([typeName, alias]) => ({ group: TYPES_GROUP, name: typeName, path: SETTINGS_PATH.concat(alias) }))
    .filter(type => fetchQuery.isTypeMatch(type.name))

  const isCustomRecordTypeName = createIsCustomRecordTypeNameFunc()
  const getTargetsWithPathFromElemID = async (elemId: ElemID): Promise<PartialFetchTargetWithPath[]> => {
    if (
      elemId.idType === 'type' &&
      isCustomRecordTypeName(elemId.name) &&
      fetchQuery.isCustomRecordTypeMatch(elemId.typeName)
    ) {
      const customRecordTypeAlias = await getAlias(elemId)
      return [
        {
          group: CUSTOM_RECORDS_GROUP,
          name: elemId.typeName,
          path: CUSTOM_RECORDS_PATH.concat(customRecordTypeAlias ?? elemId.typeName),
        },
      ]
    }
    if (elemId.idType === 'instance' && elemId.typeName === FOLDER) {
      const folderPath = invertNaclCase(elemId.name)
      return [
        {
          group: FILE_CABINET_GROUP,
          name: folderPath,
          path: FILE_CABINET_PATH.concat(folderPath.split(FILE_CABINET_PATH_SEPARATOR)),
        },
      ]
    }
    return []
  }

  const groupedTargets = await awu(await elementsSource.list())
    .flatMap(getTargetsWithPathFromElemID)
    .groupBy(type => type.group)

  const sortedCustomRecordsTargets = _.sortBy(groupedTargets[CUSTOM_RECORDS_GROUP], type => type.name)
  const sortedFileCabinetTargets = _.sortBy(groupedTargets[FILE_CABINET_GROUP], type => type.name)
  const sortedTypesTargets = _.sortBy(standardTypesTargets.concat(dataTypesTargets), type => type.name)
  const sortedSettingsTargets = _.sortBy(settingsTargets, type => type.name)

  return sortedCustomRecordsTargets
    .concat(sortedFileCabinetTargets)
    .concat(sortedTypesTargets)
    .concat(sortedSettingsTargets)
}

export const getTargetsForElements: PartialFetchOperations['getTargetsForElements'] = async ({ elemIds }) => {
  const isCustomRecordTypeName = createIsCustomRecordTypeNameFunc()
  const getTargetsFromElemID = (elemId: ElemID): PartialFetchTarget[] => {
    if (isCustomRecordTypeName(elemId.typeName)) {
      return elemId.idType === 'instance'
        ? [{ group: CUSTOM_RECORDS_GROUP, name: elemId.typeName }]
        : [{ group: TYPES_GROUP, name: CUSTOM_RECORD_TYPE }]
    }
    if (elemId.idType === 'instance' && elemId.typeName === FOLDER) {
      const folderPath = invertNaclCase(elemId.name)
      return [{ group: FILE_CABINET_GROUP, name: folderPath }]
    }
    if (elemId.idType === 'instance' && elemId.typeName === FILE) {
      const filePath = invertNaclCase(elemId.name)
      return [{ group: FILE_CABINET_GROUP, name: posix.dirname(filePath) }]
    }
    if (
      elemId.typeName in standardTypesAliasMap ||
      elemId.typeName in dataTypesAliasMap ||
      isSuiteAppConfigTypeName(elemId.typeName) ||
      isSDFConfigTypeName(elemId.typeName)
    ) {
      return [{ group: TYPES_GROUP, name: elemId.typeName }]
    }
    return []
  }

  return elemIds.flatMap(getTargetsFromElemID)
}

export const targetedFetchQuery = (partialFetchTargets: PartialFetchTarget[]): NetsuiteQuery => {
  const {
    [TYPES_GROUP]: types = [],
    [FILE_CABINET_GROUP]: fileCabinet = [],
    [CUSTOM_RECORDS_GROUP]: customRecords = [],
  } = _.groupBy(partialFetchTargets, type => type.group)

  return buildNetsuiteQuery({
    types: types.map(type => ({ name: type.name })),
    fileCabinet: fileCabinet.map(type => posix.join('^', type.name, '.*')),
    customRecords: customRecords.map(type => ({ name: type.name })),
  })
}
