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
import { FileProperties } from 'jsforce-types'
import { Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { findObjectType } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { FilterResult, RemoteFilterCreator } from '../filter'
import { FLOW_DEFINITION_METADATA_TYPE, FLOW_METADATA_TYPE, SALESFORCE } from '../constants'
import { fetchMetadataInstances, listMetadataObjects } from '../fetch'
import { createInstanceElement } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { MetadataQuery } from '../fetch_profile/metadata_query'
import { FetchElements } from '../types'

const { isDefined } = lowerdashValues

const FLOW_DEFINITION_METADATA_TYPE_ID = new ElemID(
  SALESFORCE, FLOW_DEFINITION_METADATA_TYPE
)

const FLOW_METADATA_TYPE_ID = new ElemID(
  SALESFORCE, FLOW_METADATA_TYPE
)

const fixFlowName = (props: FileProperties, activeVersions: Map<string, string>)
    : FileProperties => ({
  ...props, fullName: activeVersions.get(`${props.fullName}`) ?? `${props.fullName}`,
})

export const findActiveVersion = (fileProp: FileProperties[], flowDefinitions: InstanceElement[]):
    FileProperties[] => {
  const activeVersions = new Map<string, string>()
  flowDefinitions.forEach(flow => activeVersions.set(`${flow.value.fullName}`,
    `${flow.value.fullName}${isDefined(flow.value.activeVersionNumber) ? `-${flow.value.activeVersionNumber}` : ''}`))
  return fileProp.map(prop => fixFlowName(prop, activeVersions))
}

const removeFlowVersion = (element: InstanceElement, flowType: ObjectType):InstanceElement => {
  const prevFullName = element.value.fullName
  const flowName = prevFullName.includes('-') ? prevFullName.split('-').slice(0, -1).join('-') : prevFullName
  return createInstanceElement(
    { ...element.value, fullName: flowName },
    flowType,
    undefined,
    element.annotations
  ) as InstanceElement
}
const getFlowInstances = async (client: SalesforceClient, metadataQuery: MetadataQuery,
  maxNum: number, flowType: ObjectType, flowDefinitionType: ObjectType | undefined,
  preferActiveFlow: boolean, fileProps: FileProperties[]):
    Promise<FetchElements<InstanceElement[]>> => {
  let flowsVersionProps = fileProps
  if (preferActiveFlow) {
    if (flowDefinitionType === undefined) {
      return {} as FetchElements<InstanceElement[]>
    }
    const { elements: definitionFileProps } = await listMetadataObjects(
      client, FLOW_DEFINITION_METADATA_TYPE, [],
    )
    const flowDefinitionInstances = await fetchMetadataInstances({
      client,
      fileProps: definitionFileProps,
      metadataType: flowDefinitionType,
      metadataQuery,
      maxInstancesPerType: maxNum,
    })
    flowsVersionProps = findActiveVersion(fileProps, flowDefinitionInstances.elements)
  }
  const instances = await fetchMetadataInstances({
    client,
    fileProps: flowsVersionProps,
    metadataType: flowType,
    metadataQuery,
    maxInstancesPerType: maxNum,
  })
  return { configChanges: instances.configChanges,
    elements: instances.elements.map(e => (preferActiveFlow ? removeFlowVersion(e, flowType) : e)) }
}

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const flowType = findObjectType(elements, FLOW_METADATA_TYPE_ID)
    const preferActiveFlow = config.fetchProfile.preferActiveFlowVersions ?? false
    if (flowType === undefined) {
      return {}
    }
    const flowDefinitionType = findObjectType(
      elements, FLOW_DEFINITION_METADATA_TYPE_ID
    )
    const { elements: fileProps, configChanges } = await listMetadataObjects(
      client, FLOW_METADATA_TYPE, [],
    )
    const instances = await getFlowInstances(client, config.fetchProfile.metadataQuery,
      config.fetchProfile.maxInstancesPerType, flowType, flowDefinitionType, preferActiveFlow,
      fileProps)
    instances.elements.forEach(e => elements.push(e))
    _.pull(elements, flowDefinitionType)
    return {
      configSuggestions: [...instances.configChanges, ...configChanges],
    }
  },
})

export default filterCreator
