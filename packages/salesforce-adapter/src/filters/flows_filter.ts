/*
 * Copyright 2024 Salto Labs Ltd.
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
import { findObjectType, resolveTypeShallow } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { FilterResult, RemoteFilterCreator } from '../filter'
import {
  ACTIVE_VERSION_NUMBER,
  FLOW_DEFINITION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  SALESFORCE,
} from '../constants'
import { fetchMetadataInstances } from '../fetch'
import { createInstanceElement } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { FetchElements, FetchProfile } from '../types'
import {
  apiNameSync,
  isDeactivatedFlowChangeOnly,
  isInstanceOfTypeChangeSync,
  isInstanceOfTypeSync,
  listMetadataObjects,
} from './utils'

const { isDefined } = lowerdashValues

const log = logger(module)

const FLOW_DEFINITION_METADATA_TYPE_ID = new ElemID(SALESFORCE, FLOW_DEFINITION_METADATA_TYPE)

const FLOW_METADATA_TYPE_ID = new ElemID(SALESFORCE, FLOW_METADATA_TYPE)

const fixFilePropertiesName = (props: FileProperties, activeVersions: Map<string, string>): FileProperties => ({
  ...props,
  fullName: activeVersions.get(`${props.fullName}`) ?? `${props.fullName}`,
})

export const createActiveVersionFileProperties = (
  fileProp: FileProperties[],
  flowDefinitions: InstanceElement[],
): FileProperties[] => {
  const activeVersions = new Map<string, string>()
  flowDefinitions.forEach(flow =>
    activeVersions.set(
      `${flow.value.fullName}`,
      `${flow.value.fullName}${isDefined(flow.value[ACTIVE_VERSION_NUMBER]) ? `-${flow.value[ACTIVE_VERSION_NUMBER]}` : ''}`,
    ),
  )
  return fileProp.map(prop => fixFilePropertiesName(prop, activeVersions))
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
  flowDefinitionInstances: InstanceElement[],
): Promise<FetchElements<InstanceElement[]>> => {
  const { elements: fileProps, configChanges } = await listMetadataObjects(client, FLOW_METADATA_TYPE)

  const flowsVersionProps = fetchProfile.preferActiveFlowVersions
    ? createActiveVersionFileProperties(fileProps, flowDefinitionInstances)
    : fileProps

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

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'flowsFilter',
  remote: true,
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const flowType = findObjectType(elements, FLOW_METADATA_TYPE_ID)
    if (!config.fetchProfile.metadataQuery.isTypeMatch(FLOW_METADATA_TYPE) || flowType === undefined) {
      return {}
    }
    const flowDefinitionType = findObjectType(elements, FLOW_DEFINITION_METADATA_TYPE_ID)
    const instances = await getFlowInstances(
      client,
      config.fetchProfile,
      flowType,
      elements.filter(isInstanceOfTypeSync(FLOW_DEFINITION_METADATA_TYPE)),
    )
    instances.elements.forEach(e => elements.push(e))
    // Hide the FlowDefinition type and it's instances
    if (flowDefinitionType !== undefined) {
      flowDefinitionType.annotations[CORE_ANNOTATIONS.HIDDEN] = true
    }
    elements.filter(isInstanceOfTypeSync(FLOW_DEFINITION_METADATA_TYPE)).forEach(flowDefinition => {
      flowDefinition.annotations[CORE_ANNOTATIONS.HIDDEN] = true
    })
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
    const flowDefinitionType = await config.elementsSource.get(FLOW_DEFINITION_METADATA_TYPE_ID)
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
