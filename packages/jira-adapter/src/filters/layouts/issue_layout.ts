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
import { CORE_ANNOTATIONS, Element, ReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { ISSUE_LAYOUT_TYPE, PROJECT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { createLayoutType } from './layout_types'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'
import { deployLayoutChanges, getLayout, getLayoutResponse } from './layout_service_operations'

const { isDefined } = lowerDashValues


type issueTypeMappingStruct = {
    issueTypeId: string
    screenSchemeId: ReferenceExpression
}

const getProjectToScreenMapping = async (elements: Element[]): Promise<Record<string, number[]>> => {
  const projectToScreenId: Record<string, number[]> = Object.fromEntries(
    (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
      .filter(isInstanceElement)
      .filter(project => isResolvedReferenceExpression(project.value.issueTypeScreenScheme))
      .map(async project => {
        const screenSchemes = (project.value.issueTypeScreenScheme.value
          .value.issueTypeMappings
          .flatMap((struct: issueTypeMappingStruct) => struct.screenSchemeId.value) as unknown[])
          .filter(isInstanceElement)

        const screens = Array.from(new Set(screenSchemes
          .map(screenScheme => screenScheme.value.screens.default)
          .filter(isResolvedReferenceExpression)
          .map(defualtScreen => defualtScreen.value.value.id)))
        return [project.value.id, screens]
      })))
  )
  return projectToScreenId
}


const filter: FilterCreator = ({ client, config, fetchQuery, getElemIdFunc }) => ({
  name: 'issueLayoutFilter',
  onFetch: async elements => {
    if (client.isDataCenter
      || !fetchQuery.isTypeMatch(ISSUE_LAYOUT_TYPE)
      || !config.fetch.enableIssueLayouts) {
      return
    }
    const projectIdToProject = Object.fromEntries(
      (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
        .filter(isInstanceElement)
        .filter(project => !project.value.simplified && project.value.projectTypeKey === 'software')
        .map(async project => [project.value.id, project])))
        .filter(isDefined)
    )
    const projectToScreenId = Object.fromEntries(Object.entries(await getProjectToScreenMapping(elements))
      .filter(([key]) => Object.keys(projectIdToProject).includes(key)))
    const { subTypes, layoutType: issueLayoutType } = createLayoutType(ISSUE_LAYOUT_TYPE)
    elements.push(issueLayoutType)
    subTypes.forEach(type => elements.push(type))

    const issueLayouts = (await Promise.all(Object.entries(projectToScreenId)
      .flatMap(([projectId, screenIds]) => screenIds.map(async screenId => {
        const variables = {
          projectId,
          extraDefinerId: screenId,
        }
        const response = await getLayoutResponse({
          variables,
          client,
        })
        return getLayout({
          variables,
          response,
          instance: projectIdToProject[projectId],
          layoutType: issueLayoutType,
          getElemIdFunc,
          typeName: ISSUE_LAYOUT_TYPE,
        })
      })))).filter(isDefined)
    issueLayouts.forEach(layout => {
      const projectKey = projectIdToProject[layout.value.projectId].value.key
      const url = `/plugins/servlet/project-config/${projectKey}/issuelayout?screenId=${layout.value.extraDefinerId}`
      layout.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, client.baseUrl).href
    })
    issueLayouts.forEach(layout => { elements.push(layout) })
    setTypeDeploymentAnnotations(issueLayoutType)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.DELETABLE)
  },
  deploy: async changes => deployLayoutChanges({
    changes,
    client,
    typeName: ISSUE_LAYOUT_TYPE,
  }),
})

export default filter
