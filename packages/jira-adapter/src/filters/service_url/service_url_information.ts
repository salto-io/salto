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
import { Element, InstanceElement, isInstanceElement, CORE_ANNOTATIONS, getChangeData, isInstanceChange, isAdditionChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'

const log = logger(module)

type ServiceUrlSupplier = {
    typeName: string
    supplier: (instance: InstanceElement) => string | undefined
}

const getParentId = (instance: InstanceElement): string =>
  getParents(instance)[0].resValue.value.id

const createAutomationServiceUrl = (instance: InstanceElement): string | undefined => {
  if (instance.value.projects === undefined || instance.value.projects[0].projectId === undefined) {
    return undefined
  }
  const projectKey = instance.value.projects[0].projectId.resValue.value.key
  return `/jira/software/projects/${projectKey}/settings/automate#/rule/${instance.value.id}`
}

const createBoardServiceUrl = (instance: InstanceElement): string =>
  `/jira/software/projects/${instance.value.name.replace(' board', '')}/boards/${instance.value.id}`

const createCustomFieldContextServiceUrl = (instance: InstanceElement): string | undefined => {
  const parentId = getParentId(instance)
  if (!parentId.startsWith('customfield_')) {
    return undefined
  }
  const cleanParentId = parentId.replace('customfield_', '')
  return `/secure/admin/ManageConfigurationScheme!default.jspa?=&customFieldId=${cleanParentId}&fieldConfigSchemeId=${instance.value.id}`
}

const createFieldServiceUrl = (instance: InstanceElement): string | undefined => {
  if (!instance.value.id.startsWith('customfield_')) {
    return undefined
  }
  return `/secure/admin/EditCustomField!default.jspa?id=${instance.value.id.replace('customfield_', '')}`
}

const boardInformation: ServiceUrlSupplier = {
  typeName: 'Board',
  supplier: createBoardServiceUrl,
}

const CustomFieldContextInformation: ServiceUrlSupplier = {
  typeName: 'CustomFieldContext',
  supplier: createCustomFieldContextServiceUrl,
}

const FieldInformation: ServiceUrlSupplier = {
  typeName: 'Field',
  supplier: createFieldServiceUrl,
}

const AutomationInformation: ServiceUrlSupplier = {
  typeName: 'Automation',
  supplier: createAutomationServiceUrl,
}

const WebhookInformation: ServiceUrlSupplier = {
  typeName: 'Webhook',
  supplier: (_: InstanceElement) => '/plugins/servlet/webhooks#',
}

const serviceUrlInformation: ServiceUrlSupplier[] = [
  boardInformation,
  CustomFieldContextInformation,
  FieldInformation,
  AutomationInformation,
  WebhookInformation,
]

const supplyServiceUrl = (
  instances: InstanceElement[],
  supplier: ServiceUrlSupplier,
  baseUrl: string
): void => {
  try {
    instances.forEach(instance => {
      const serviceUrl = supplier.supplier(instance)
      if (serviceUrl) {
        instance.annotate(
          { [CORE_ANNOTATIONS.SERVICE_URL]:
            new URL(serviceUrl, baseUrl).href },
        )
      }
    })
  } catch (error) {
    log.error(`Failed to supply service url for ${supplier.typeName}`, error)
  }
}

const filter: FilterCreator = params => ({
  onFetch: async (elements: Element[]) => {
    const filterElementsBySupplier = (information: ServiceUrlSupplier): void => {
      const instances = elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === information.typeName)
      supplyServiceUrl(instances, information, params.client.baseUrl)
    }
    serviceUrlInformation.forEach(filterElementsBySupplier)
  },
  onDeploy: async changes => {
    const filterElementsBySupplier = (information: ServiceUrlSupplier): void => {
      const instances = changes
        .filter(isInstanceChange)
        .filter(isAdditionChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === information.typeName)
      supplyServiceUrl(instances, information, params.client.baseUrl)
    }
    serviceUrlInformation.forEach(filterElementsBySupplier)
  },
})

export default filter
