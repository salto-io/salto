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
import { FilterCreator } from '../../filter'


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

const createProjectComponentServiceUrl = (instance: InstanceElement): string => {
  const parentKey = getParents(instance)[0].resValue.value.key
  return `/plugins/servlet/project-config/${parentKey}/administer-components?filter=${instance.value.name}&orderDirection=DESC&orderField=NAME&page=1`
}

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

const createDashboardGadgetServiceUrl = (instance: InstanceElement): string =>
  `/jira/dashboards/${getParentId(instance)}?maximized=${instance.value.id}`

const boardInformation: ServiceUrlSupplier = {
  typeName: 'Board',
  supplier: createBoardServiceUrl,
}

const ProjectComponentInformation: ServiceUrlSupplier = {
  typeName: 'ProjectComponent',
  supplier: createProjectComponentServiceUrl,
}

const CustomFieldContextInformation: ServiceUrlSupplier = {
  typeName: 'CustomFieldContext',
  supplier: createCustomFieldContextServiceUrl,
}

const FieldInformation: ServiceUrlSupplier = {
  typeName: 'Field',
  supplier: createFieldServiceUrl,
}

const DashboardGadgetInformation: ServiceUrlSupplier = {
  typeName: 'DashboardGadget',
  supplier: createDashboardGadgetServiceUrl,
}

const AutomationInformation: ServiceUrlSupplier = {
  typeName: 'Automation',
  supplier: createAutomationServiceUrl,
}

const WebhookInformation: ServiceUrlSupplier = {
  typeName: 'Webhook',
  supplier: (_: InstanceElement) => '/plugins/servlet/webhooks#',
}

const IssueEventInformation: ServiceUrlSupplier = {
  typeName: 'IssueEvent',
  supplier: (_: InstanceElement) => '/secure/admin/ListEventTypes.jspa',
}

const serviceUrlInformation: ServiceUrlSupplier[] = [
  boardInformation,
  ProjectComponentInformation,
  CustomFieldContextInformation,
  FieldInformation,
  DashboardGadgetInformation,
  AutomationInformation,
  WebhookInformation,
  IssueEventInformation,
]

const filter: FilterCreator = params => ({
  onFetch: async (elements: Element[]) => {
    const supplyServiceUrl = (information: ServiceUrlSupplier): void => {
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === information.typeName)
        .forEach(instance => {
          const serviceUrl = information.supplier(instance)
          if (serviceUrl) {
            instance.annotate(
              { [CORE_ANNOTATIONS.SERVICE_URL]:
                new URL(serviceUrl, params.client.getUrl().href).href },
            )
          }
        })
    }
    serviceUrlInformation.forEach(supplyServiceUrl)
  },
  onDeploy: async changes => {
    const supplyServiceUrl = (information: ServiceUrlSupplier): void => {
      changes
        .filter(isInstanceChange)
        .filter(isAdditionChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === information.typeName)
        .forEach(instance => {
          const serviceUrl = information.supplier(instance)
          if (serviceUrl) {
            instance.annotate(
              { [CORE_ANNOTATIONS.SERVICE_URL]:
                new URL(serviceUrl, params.client.getUrl().href).href },
            )
          }
        })
    }
    serviceUrlInformation.forEach(supplyServiceUrl)
  },
})

export default filter
