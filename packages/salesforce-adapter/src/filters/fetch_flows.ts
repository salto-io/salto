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
  const flow = createInstanceElement(
    { ...element.value, fullName: flowName },
    flowType,
    undefined,
    element.annotations
  ) as InstanceElement
  return flow
}

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const flowType = findObjectType(elements, FLOW_METADATA_TYPE_ID)
    if (flowType === undefined) {
      return {}
    }
    const { elements: fileProps, configChanges } = await listMetadataObjects(
      client, FLOW_METADATA_TYPE, [],
    )
    const flowDefinitionType = findObjectType(
      elements, FLOW_DEFINITION_METADATA_TYPE_ID
    )
    _.pull(elements, flowDefinitionType)
    if (config.preferActiveFlowVersions === false || flowDefinitionType === undefined) {
      // should fetch the latest version of each flow (as by default)
      const instances = await fetchMetadataInstances({
        client,
        fileProps,
        metadataType: flowType,
        metadataQuery: config.fetchProfile.metadataQuery,
        maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
      })
      instances.elements.forEach(e => elements.push(e))
      return {
        configSuggestions: [...instances.configChanges, ...configChanges],
      }
    }
    // should fetch the active version of each Flow
    const { elements: definitionFileProps } = await listMetadataObjects(
      client, FLOW_DEFINITION_METADATA_TYPE, [],
    )
    const flowDefinitionInstances = await fetchMetadataInstances({
      client,
      fileProps: definitionFileProps,
      metadataType: flowDefinitionType,
      metadataQuery: config.fetchProfile.metadataQuery,
      maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
    })
    const flowsVersionProps = findActiveVersion(fileProps, flowDefinitionInstances.elements)
    const instances = await fetchMetadataInstances({
      client,
      fileProps: flowsVersionProps,
      metadataType: flowType,
      metadataQuery: config.fetchProfile.metadataQuery,
      maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
    })
    instances.elements.forEach(e => elements.push(removeFlowVersion(e, flowType)))
    return {
      configSuggestions: [...instances.configChanges, ...configChanges],
    }
  },
})

export default filterCreator
