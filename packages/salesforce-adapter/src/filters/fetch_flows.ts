/*
*                      Copyright 2023 Salto Labs Ltd.
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
import _, { isUndefined } from 'lodash'
import { logger } from '@salto-io/logging'
import { FileProperties } from 'jsforce-types'
import { Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { findObjectType } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { FilterResult, RemoteFilterCreator } from '../filter'
import { FLOW_DEFINITION_METADATA_TYPE, FLOW_METADATA_TYPE, SALESFORCE } from '../constants'
import { fetchMetadataInstances, listMetadataObjects } from '../fetch'
import { createInstanceElement } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { FetchElements } from '../types'
import { FetchProfile } from '../fetch_profile/fetch_profile'

const { isDefined } = lowerdashValues

const log = logger(module)

const FLOW_DEFINITION_METADATA_TYPE_ID = new ElemID(
  SALESFORCE, FLOW_DEFINITION_METADATA_TYPE
)

const FLOW_METADATA_TYPE_ID = new ElemID(
  SALESFORCE, FLOW_METADATA_TYPE
)

const fixFilePropertiesName = (props: FileProperties, activeVersions: Map<string, string>)
    : FileProperties => ({
  ...props, fullName: activeVersions.get(`${props.fullName}`) ?? `${props.fullName}`,
})

export const createActiveVersionFileProperties = (fileProp: FileProperties[],
  flowDefinitions: InstanceElement[]): FileProperties[] => {
  const activeVersions = new Map<string, string>()
  flowDefinitions.forEach(flow => activeVersions.set(`${flow.value.fullName}`,
    `${flow.value.fullName}${isDefined(flow.value.activeVersionNumber) ? `-${flow.value.activeVersionNumber}` : ''}`))
  return fileProp.map(prop => fixFilePropertiesName(prop, activeVersions))
}

const getFlowWithoutVersion = (element: InstanceElement, flowType: ObjectType): InstanceElement => {
  const prevFullName = element.value.fullName
  const flowName = prevFullName.includes('-') ? prevFullName.split('-').slice(0, -1).join('-') : prevFullName
  return createInstanceElement(
    { ...element.value, fullName: flowName },
    flowType,
    undefined,
    element.annotations
  )
}

const createActiveVersionProps = async (
  client: SalesforceClient,
  fetchProfile: FetchProfile,
  flowDefinitionType: ObjectType,
  fileProps: FileProperties[]
): Promise<FileProperties[]> => {
  const { elements: definitionFileProps } = await listMetadataObjects(
    client, FLOW_DEFINITION_METADATA_TYPE
  )
  const flowDefinitionInstances = await fetchMetadataInstances({
    client,
    fileProps: definitionFileProps,
    metadataType: flowDefinitionType,
    metadataQuery: fetchProfile.metadataQuery,
    maxInstancesPerType: fetchProfile.maxInstancesPerType,
  })
  return createActiveVersionFileProperties(fileProps, flowDefinitionInstances.elements)
}

const getFlowInstances = async (
  client: SalesforceClient,
  fetchProfile: FetchProfile,
  flowType: ObjectType,
  flowDefinitionType: ObjectType | undefined,
): Promise<FetchElements<InstanceElement[]>> => {
  const { elements: fileProps } = await listMetadataObjects(
    client, FLOW_METADATA_TYPE
  )
  if (fetchProfile.preferActiveFlowVersions && isUndefined(flowDefinitionType)) {
    log.error('Failed to fetch flows active version due to a problem with flowDefinition type')
    return {} as FetchElements<InstanceElement[]>
  }
  const flowsVersionProps = fetchProfile.preferActiveFlowVersions && isDefined(flowDefinitionType)
    ? await createActiveVersionProps(client, fetchProfile, flowDefinitionType, fileProps)
    : fileProps
  const instances = await fetchMetadataInstances({
    client,
    fileProps: flowsVersionProps,
    metadataType: flowType,
    metadataQuery: fetchProfile.metadataQuery,
    maxInstancesPerType: fetchProfile.maxInstancesPerType,
  })
  return { configChanges: instances.configChanges,
    elements: instances.elements.map(e =>
      (fetchProfile.preferActiveFlowVersions ? getFlowWithoutVersion(e, flowType) : e)) }
}

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'fetchFlowsFilter',
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const flowType = findObjectType(elements, FLOW_METADATA_TYPE_ID)
    if (flowType === undefined) {
      return {}
    }
    const flowDefinitionType = findObjectType(elements, FLOW_DEFINITION_METADATA_TYPE_ID)
    const instances = await getFlowInstances(client, config.fetchProfile, flowType,
      flowDefinitionType)
    instances.elements.forEach(e => elements.push(e))
    _.pull(elements, flowDefinitionType)
    return {
      configSuggestions: [...instances.configChanges],
    }
  },
})

export default filterCreator
