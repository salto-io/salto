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
import { Element, InstanceElement, isInstanceElement, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'


type ServiceUrlInformation = {
    typeName: string
    informationSupplier: (instance: InstanceElement) => string | undefined
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

const boardInformation: ServiceUrlInformation = {
  typeName: 'Board',
  informationSupplier: createBoardServiceUrl,
}

const ProjectComponentInformation: ServiceUrlInformation = {
  typeName: 'ProjectComponent',
  informationSupplier: createProjectComponentServiceUrl,
}

const CustomFieldContextInformation: ServiceUrlInformation = {
  typeName: 'CustomFieldContext',
  informationSupplier: createCustomFieldContextServiceUrl,
}

const FieldInformation: ServiceUrlInformation = {
  typeName: 'Field',
  informationSupplier: createFieldServiceUrl,
}

const DashboardGadgetInformation: ServiceUrlInformation = {
  typeName: 'DashboardGadget',
  informationSupplier: createDashboardGadgetServiceUrl,
}

const AutomationInformation: ServiceUrlInformation = {
  typeName: 'Automation',
  informationSupplier: createAutomationServiceUrl,
}

const serviceUrlInformation: ServiceUrlInformation[] = [
  boardInformation,
  ProjectComponentInformation,
  CustomFieldContextInformation,
  FieldInformation,
  DashboardGadgetInformation,
  AutomationInformation,
]

const filter: FilterCreator = params => ({
  onFetch: async (elements: Element[]) => {
    const supplyServiceUrl = (information: ServiceUrlInformation): void => {
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === information.typeName)
        .forEach(instance => {
          const serviceUrl = information.informationSupplier(instance)
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
