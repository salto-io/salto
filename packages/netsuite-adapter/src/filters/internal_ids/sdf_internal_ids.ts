/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  Element,
  Field,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import Ajv from 'ajv'
import { logger } from '@salto-io/logging'
import { RemoteFilterCreator } from '../../filter'
import { RECORD_ID_SCHEMA, SAVED_SEARCH_RESULTS_SCHEMA, TABLE_NAME_TO_ID_PARAMETER_MAP } from './constants'
import NetsuiteClient from '../../client/client'
import { isSdfCreateOrUpdateGroupId } from '../../group_changes'
import { getElementValueOrAnnotations, isCustomRecordType } from '../../types'
import { CUSTOM_RECORD_TYPE, SAVED_SEARCH, INTERNAL_ID, SCRIPT_ID } from '../../constants'
import { getCustomListValues, isCustomListInstance } from '../../elements_source_index/elements_source_index'

const log = logger(module)

type RecordIdResult = {
  scriptid: string
  id: string
}

type QueryResponse = {
  scriptid: string
} & (
  | {
      id: string
    }
  | {
      internalid: string
    }
)

type SavedSearchResult = {
  id: string
  internalid: [
    {
      value: string
    },
  ]
}

const CUSTOM_FIELD = 'customfield'

const TYPE_NAMES_TO_TABLE_NAME: Record<string, string> = {
  entitycustomfield: CUSTOM_FIELD,
  transactionbodycustomfield: CUSTOM_FIELD,
  itemcustomfield: CUSTOM_FIELD,
  crmcustomfield: CUSTOM_FIELD,
  itemnumbercustomfield: CUSTOM_FIELD,
  itemoptioncustomfield: CUSTOM_FIELD,
  transactioncolumncustomfield: CUSTOM_FIELD,
  othercustomfield: CUSTOM_FIELD,
  sspapplication: 'webapp',
  sdfinstallationscript: 'script',
}

const hasScriptId = (element: Element): boolean => {
  if (!getElementValueOrAnnotations(element)[SCRIPT_ID]) {
    log.warn('element %s has no scriptid', element.elemID.getFullName())
    return false
  }
  return true
}

const getTableName = (element: Element): string => {
  if (element.elemID.typeName in TYPE_NAMES_TO_TABLE_NAME) {
    return TYPE_NAMES_TO_TABLE_NAME[element.elemID.typeName]
  }
  return element.elemID.typeName
}

const queryRecordIds = async (
  client: NetsuiteClient,
  idParamName: 'id' | 'internalid',
  recordType: string,
): Promise<RecordIdResult[]> => {
  const recordIdResults = await client.runSuiteQL({
    select: `scriptid, ${idParamName}`,
    from: recordType,
    orderBy: idParamName,
  })
  if (recordIdResults === undefined) {
    return []
  }
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<QueryResponse[]>(RECORD_ID_SCHEMA, recordIdResults)) {
    log.error(`Got invalid results from listing ${recordType} table: ${ajv.errorsText()}`)
    return []
  }
  return recordIdResults.map(res => ({
    scriptid: res.scriptid,
    id: 'id' in res ? res.id : res.internalid,
  }))
}

const isSavedSearch = (element: Element): boolean => element.elemID.typeName === SAVED_SEARCH

const addInternalIdFieldToSupportedType = (elements: Element[]): void => {
  elements
    .filter(isObjectType)
    .filter(object => getTableName(object) in TABLE_NAME_TO_ID_PARAMETER_MAP || isSavedSearch(object))
    .forEach(object => {
      if (_.isUndefined(object.fields[INTERNAL_ID])) {
        object.fields[INTERNAL_ID] = new Field(object, INTERNAL_ID, BuiltinTypes.STRING, {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        })
      }
    })
}

const fetchRecordType = async (
  idParamName: 'id' | 'internalid',
  client: NetsuiteClient,
  recordType: string,
): Promise<Record<string, string>> => {
  const recordTypeIds = await queryRecordIds(client, idParamName, recordType)
  if (_.isUndefined(recordTypeIds) || _.isEmpty(recordTypeIds)) {
    return {}
  }
  // SDF returns script ids as lowercase even if they are in upper case in the service.
  return Object.fromEntries(recordTypeIds.map(entry => [entry.scriptid.toLowerCase(), entry.id]))
}

const fetchRecordIdsForRecordType = async (
  recordType: string,
  client: NetsuiteClient,
): Promise<Record<string, string>> => fetchRecordType(TABLE_NAME_TO_ID_PARAMETER_MAP[recordType], client, recordType)

const createRecordIdsMap = async (
  client: NetsuiteClient,
  recordTypes: string[],
): Promise<Record<string, Record<string, string>>> =>
  Object.fromEntries(
    await Promise.all(
      recordTypes.map(async recordType => [recordType, await fetchRecordIdsForRecordType(recordType, client)]),
    ),
  )

export const isSupportedInstance = (instance: InstanceElement): boolean =>
  getTableName(instance) in TABLE_NAME_TO_ID_PARAMETER_MAP

const getAdditionInstances = (changes: Change[]): InstanceElement[] =>
  changes.filter(isAdditionChange).filter(isInstanceChange).map(getChangeData).filter(isSupportedInstance)

const addInternalIdToInstances = async (client: NetsuiteClient, instances: InstanceElement[]): Promise<void> => {
  const recordIdMap = await createRecordIdsMap(client, _.uniq(instances.map(getTableName)))
  instances.filter(hasScriptId).forEach(instance => {
    const typeRecordIdMap = recordIdMap[getTableName(instance)]
    const scriptId = instance.value[SCRIPT_ID].toLowerCase()
    if (scriptId in typeRecordIdMap) {
      instance.value[INTERNAL_ID] = typeRecordIdMap[scriptId]
    }
  })
}

const addInternalIdToCustomRecordTypes = async (client: NetsuiteClient, elements: Element[]): Promise<void> => {
  const customRecordTypes = elements.filter(isObjectType).filter(isCustomRecordType)
  if (customRecordTypes.length > 0) {
    const recordIdMap = await fetchRecordIdsForRecordType(CUSTOM_RECORD_TYPE, client)
    customRecordTypes.filter(hasScriptId).forEach(type => {
      const scriptId = type.annotations[SCRIPT_ID].toLowerCase()
      if (scriptId in recordIdMap) {
        type.annotations[INTERNAL_ID] = recordIdMap[scriptId]
      }
    })
  }
}

const addInternalIdToCustomListValues = async (client: NetsuiteClient, elements: Element[]): Promise<void> => {
  const customListInstancesWithMissingValuesInternalIds = elements
    .filter(isInstanceElement)
    .filter(isCustomListInstance)
    .filter(instance => getCustomListValues(instance).some(([value]) => !value[INTERNAL_ID]))
  const recordIdMap = Object.fromEntries(
    await Promise.all(
      customListInstancesWithMissingValuesInternalIds
        .filter(hasScriptId)
        .map(instance => instance.value[SCRIPT_ID])
        .map(
          async (customListScriptId: string): Promise<[string, Record<string, string>]> => [
            customListScriptId,
            await fetchRecordType('id', client, customListScriptId),
          ],
        ),
    ),
  )
  customListInstancesWithMissingValuesInternalIds.filter(hasScriptId).forEach(instance => {
    const customListRecordIdMap = recordIdMap[instance.value[SCRIPT_ID]]
    getCustomListValues(instance)
      .filter(([value]) => !value[INTERNAL_ID] && value[SCRIPT_ID])
      .forEach(([value]) => {
        const scriptId = value[SCRIPT_ID].toLowerCase()
        if (scriptId in customListRecordIdMap) {
          value[INTERNAL_ID] = customListRecordIdMap[scriptId]
        }
      })
  })
}

const addInternalIdToSavedSearches = async (client: NetsuiteClient, elements: Element[]): Promise<void> => {
  const queryScriptIdToInternalId = async (): Promise<Record<string, string>> => {
    const results = await client.runSavedSearchQuery({
      type: 'savedsearch',
      filters: [],
      columns: ['id', 'internalid'],
    })
    if (results === undefined) {
      log.error('SavedSearch query failed')
      return {}
    }

    const ajv = new Ajv({ allErrors: true })
    if (!ajv.validate<SavedSearchResult[]>(SAVED_SEARCH_RESULTS_SCHEMA, results)) {
      log.error(`Got invalid results from SavedSearch query: ${ajv.errorsText()}`)
      return {}
    }

    return Object.fromEntries(results.map(({ id, internalid }) => [id.toLowerCase(), internalid[0].value]))
  }

  const savedSearchElements = elements.filter(isInstanceElement).filter(isSavedSearch)

  if (savedSearchElements.length === 0) {
    return
  }

  const scriptIdToInternalId = await queryScriptIdToInternalId()

  savedSearchElements.forEach(element => {
    const id = scriptIdToInternalId[element.value[SCRIPT_ID].toLowerCase()]
    if (id !== undefined) {
      element.value[INTERNAL_ID] = id
    }
  })
}

/**
 * This filter adds the internal id to instances.
 * so we will be able to reference them in other instances
 * that are returned from SOAP API (e.g., Employee)
 */
const filterCreator: RemoteFilterCreator = ({ client, changesGroupId }) => ({
  name: 'SDFInternalIds',
  remote: true,
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    addInternalIdFieldToSupportedType(elements)

    const instances = elements.filter(isInstanceElement).filter(isSupportedInstance)
    await addInternalIdToInstances(client, instances)
    await addInternalIdToCustomRecordTypes(client, elements)
    await addInternalIdToCustomListValues(client, elements)
    await addInternalIdToSavedSearches(client, elements)
  },

  /**
   * This removes the internal id before deploy since we don't want to actually deploy it to SDF
   */
  preDeploy: async changes => {
    if (!changesGroupId || !isSdfCreateOrUpdateGroupId(changesGroupId)) {
      return
    }
    const elements = changes.filter(isAdditionOrModificationChange).map(getChangeData)
    elements.forEach(element => {
      delete getElementValueOrAnnotations(element)[INTERNAL_ID]
    })
    elements
      .filter(isInstanceElement)
      .filter(isCustomListInstance)
      .forEach(instance => {
        getCustomListValues(instance).forEach(([value]) => {
          delete value[INTERNAL_ID]
        })
      })
  },
  /**
   * This assigns the internal id for new instances created through Salto
   */
  onDeploy: async changes => {
    if (!client.isSuiteAppConfigured()) {
      return
    }
    const additionInstances = getAdditionInstances(changes)
    if (additionInstances.length > 0) {
      await addInternalIdToInstances(client, additionInstances)
    }
    await addInternalIdToCustomRecordTypes(client, changes.filter(isAdditionChange).map(getChangeData))
    await addInternalIdToCustomListValues(client, changes.filter(isAdditionOrModificationChange).map(getChangeData))
    await addInternalIdToSavedSearches(client, changes.filter(isAdditionChange).map(getChangeData))
  },
})

export default filterCreator
