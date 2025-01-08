/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FileProperties } from '@salto-io/jsforce-types'
import {
  Change,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isObjectType,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { inspectValue, resolveTypeShallow } from '@salto-io/adapter-utils'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { FilterResult, FilterCreator } from '../filter'
import {
  ACTIVE_VERSION_NUMBER,
  FLOW_DEFINITION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_ID_FIELD,
  SALESFORCE,
} from '../constants'
import { fetchMetadataInstances } from '../fetch'
import { createInstanceElement } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { FetchElements, FetchProfile } from '../types'
import {
  apiNameSync,
  findObjectType,
  isDeactivatedFlowChangeOnly,
  isInstanceOfTypeChangeSync,
  isInstanceOfTypeSync,
  listMetadataObjects,
} from './utils'
import { SalesforceRecord } from '../client/types'

const { isDefined } = lowerdashValues

const log = logger(module)
const { toArrayAsync } = collections.asynciterable

const DEFAULT_CHUNK_SIZE = 500

const fixFilePropertiesName = (props: FileProperties, activeVersions: Map<string, string>): FileProperties => ({
  ...props,
  fullName: activeVersions.get(`${props.fullName}`) ?? `${props.fullName}`,
})

type FlowDefinitionViewRecord = SalesforceRecord & {
  ActiveVersionId: string | null
  ApiName: string
}
const isFlowDefinitionViewRecord = (record: SalesforceRecord): record is FlowDefinitionViewRecord =>
  (record.ActiveVersionId === null || _.isString(record.ActiveVersionId)) && _.isString(record.ApiName)

const getActiveFlowVersionIdByApiName = async ({
  client,
  flowDefinitions,
  chunkSize,
}: {
  client: SalesforceClient
  flowDefinitions: InstanceElement[]
  chunkSize: number
}): Promise<Record<string, string>> => {
  const flowDefinitionsIds = flowDefinitions.map(flow => flow.value[INTERNAL_ID_FIELD])
  const records = _.flatten(
    await Promise.all(
      _.chunk(flowDefinitionsIds, chunkSize).map(async chunk => {
        const query = `SELECT Id, ApiName, ActiveVersionId FROM FlowDefinitionView WHERE Id IN ('${chunk.join("','")}')`
        return (await toArrayAsync(await client.queryAll(query))).flat()
      }),
    ),
  )
  const [validRecords, invalidRecords] = _.partition(records, isFlowDefinitionViewRecord)
  if (invalidRecords.length > 0) {
    log.error(
      'Some FlowDefinitionView records are invalid. Records are: %s',
      inspectValue(invalidRecords, { maxArrayLength: 10 }),
    )
    if (invalidRecords.length > 10) {
      log.trace(
        'All Invalid FlowDefinitionView records are: %s',
        inspectValue(invalidRecords, { maxArrayLength: null }),
      )
    }
  }
  return validRecords.reduce<Record<string, string>>((acc, record) => {
    if (record.ActiveVersionId !== null) {
      acc[record.ApiName] = record.ActiveVersionId
    }
    return acc
  }, {})
}

export const createActiveVersionFileProperties = async ({
  flowsFileProps,
  flowDefinitions,
  client,
  fetchProfile,
}: {
  flowsFileProps: FileProperties[]
  flowDefinitions: InstanceElement[]
  client: SalesforceClient
  fetchProfile: FetchProfile
}): Promise<FileProperties[]> => {
  const activeVersions = new Map<string, string>()
  const activeFlowVersionIdByApiName = await getActiveFlowVersionIdByApiName({
    client,
    flowDefinitions,
    chunkSize: fetchProfile.limits?.flowDefinitionsQueryChunkSize ?? DEFAULT_CHUNK_SIZE,
  })
  flowDefinitions.forEach(flow =>
    activeVersions.set(
      `${flow.value.fullName}`,
      `${flow.value.fullName}${isDefined(flow.value[ACTIVE_VERSION_NUMBER]) ? `-${flow.value[ACTIVE_VERSION_NUMBER]}` : ''}`,
    ),
  )
  return flowsFileProps.map(prop => ({
    ...fixFilePropertiesName(prop, activeVersions),
    id: activeFlowVersionIdByApiName[prop.fullName] ?? prop.id,
  }))
}

const getFlowWithoutVersion = (element: InstanceElement, flowType: ObjectType): InstanceElement => {
  const prevFullName = element.value.fullName
  const flowName = prevFullName.includes('-') ? prevFullName.split('-').slice(0, -1).join('-') : prevFullName
  return createInstanceElement({ ...element.value, fullName: flowName }, flowType, undefined, element.annotations)
}

const createDeactivatedFlowDefinitionChange = (
  flowChange: Change<InstanceElement>,
  flowDefinitionMetadataType: ObjectType,
): Change<InstanceElement> => {
  const flowApiName = apiNameSync(getChangeData(flowChange))
  if (flowApiName === undefined) {
    throw new Error('Attempting to deploy a flow with no apiName')
  }
  const flowDefinitionInstance = createInstanceElement(
    {
      [INSTANCE_FULL_NAME_FIELD]: flowApiName,
      [ACTIVE_VERSION_NUMBER]: 0,
    },
    flowDefinitionMetadataType,
  )
  return toChange({ after: flowDefinitionInstance })
}

const getFlowInstances = async (
  client: SalesforceClient,
  fetchProfile: FetchProfile,
  flowType: ObjectType,
  flowDefinitions: InstanceElement[],
): Promise<FetchElements<InstanceElement[]>> => {
  const { elements: flowsFileProps, configChanges } = await listMetadataObjects(client, FLOW_METADATA_TYPE)

  const flowsVersionProps = fetchProfile.preferActiveFlowVersions
    ? await createActiveVersionFileProperties({ flowsFileProps, flowDefinitions, client, fetchProfile })
    : flowsFileProps

  const instances = await fetchMetadataInstances({
    client,
    fileProps: flowsVersionProps,
    metadataType: flowType,
    metadataQuery: fetchProfile.metadataQuery,
    maxInstancesPerType: fetchProfile.maxInstancesPerType,
  })
  return {
    configChanges: instances.configChanges.concat(configChanges),
    elements: instances.elements.map(e =>
      fetchProfile.preferActiveFlowVersions ? getFlowWithoutVersion(e, flowType) : e,
    ),
  }
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'flowsFilter',
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    if (client === undefined) {
      return {}
    }
    // Hide the FlowDefinition type and its instances
    const flowDefinitionType = findObjectType(elements, FLOW_DEFINITION_METADATA_TYPE)
    const flowDefinitions = elements.filter(isInstanceOfTypeSync(FLOW_DEFINITION_METADATA_TYPE))
    if (flowDefinitionType !== undefined) {
      flowDefinitionType.annotations[CORE_ANNOTATIONS.HIDDEN] = true
    }
    flowDefinitions.forEach(flowDefinition => {
      flowDefinition.annotations[CORE_ANNOTATIONS.HIDDEN] = true
    })

    const flowType = findObjectType(elements, FLOW_METADATA_TYPE)
    if (!config.fetchProfile.metadataQuery.isTypeMatch(FLOW_METADATA_TYPE) || flowType === undefined) {
      return {}
    }
    const instances = await getFlowInstances(client, config.fetchProfile, flowType, flowDefinitions)
    instances.elements.forEach(e => elements.push(e))
    return {
      configSuggestions: [...instances.configChanges],
    }
  },
  // In order to deactivate a Flow, we need to create a FlowDefinition instance with activeVersionNumber of 0
  preDeploy: async changes => {
    const deactivatedFlowOnlyChanges = changes.filter(isDeactivatedFlowChangeOnly)
    if (deactivatedFlowOnlyChanges.length === 0) {
      return
    }
    const flowDefinitionType = await config.elementsSource.get(new ElemID(SALESFORCE, FLOW_DEFINITION_METADATA_TYPE))
    if (!isObjectType(flowDefinitionType)) {
      log.error(
        'Failed to deactivate flows since the FlowDefinition metadata type does not exist in the elements source',
      )
      return
    }
    await resolveTypeShallow(flowDefinitionType, config.elementsSource)
    deactivatedFlowOnlyChanges
      .map(flowChange => createDeactivatedFlowDefinitionChange(flowChange, flowDefinitionType))
      .forEach(flowDefinitionChange => changes.push(flowDefinitionChange))
  },

  // Remove the created FlowDefinition instances
  onDeploy: async changes => {
    const flowDefinitionChanges = changes.filter(isInstanceOfTypeChangeSync(FLOW_DEFINITION_METADATA_TYPE))
    if (flowDefinitionChanges.length === 0) {
      return
    }
    const deactivatedFlowNames = flowDefinitionChanges
      .map(getChangeData)
      .map(change => apiNameSync(change))
      .filter(isDefined)
    log.info(`Successfully deactivated the following flows: ${deactivatedFlowNames.join(' ')}`)
    _.pullAll(changes, flowDefinitionChanges)
  },
})

export default filterCreator
