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
import Joi from 'joi'
import { BuiltinTypes, CORE_ANNOTATIONS, Change, ElemID, InstanceElement, ListType, ObjectType, ReferenceExpression, getChangeData, isInstanceChange, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { createSchemeGuard, naclCase, pathNaclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as adapterElements } from '@salto-io/adapter-components'
import _ from 'lodash'
import { deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { ISSUE_LAYOUT_TYPE, JIRA, PROJECT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { QUERY } from './issue_layout_query'
import { ISSUE_LAYOUT_SUB_TYPES, IssueLayoutConfig, IssueLayoutConfigItem, IssueLayoutResponse, LayoutOwners, Owner, Owners, issueLayoutConfigType, onwerIssueLayoutType } from './issue_layout_types'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'

const { isDefined } = lowerDashValues

type issueTypeMappingStruct = {
    issueTypeId: string
    screenSchemeId: ReferenceExpression
}

const CAPITAL_CONTAINER_TO_LOWER_CONTAINER: Record<string, string> = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  CONTENT: 'content',
}

const ISSUE_LAYOUT_RESPONSE_SCHEME = Joi.object({
  issueLayoutConfiguration: Joi.object({
    issueLayoutResult: Joi.object({
      id: Joi.string().required(),
      usageInfo: Joi.object({
        edges: Joi.array().items(Joi.object({
          node: Joi.object({
            layoutOwners: Joi.array().items(Joi.object({
              avatarId: Joi.string().required().allow(null),
              description: Joi.string().required(),
              iconUrl: Joi.string().required(),
              id: Joi.string().required(),
              name: Joi.string().required(),
            }).unknown(true)).required(),
          }).unknown(true).required(),
        }).unknown(true)).required(),
      }).unknown(true).required(),
      containers: Joi.array().items(Joi.object({
        containerType: Joi.string().required(),
        items: Joi.object({
          nodes: Joi.array().items(Joi.object({
            fieldItemId: Joi.string(),
            panelItemId: Joi.string(),
          }).unknown(true)).required(),
        }).unknown(true).required(),
      }).unknown(true)).required(),
    }).unknown(true).required(),
    metadata: Joi.object({
      configuration: Joi.object({
        items: Joi.object({
          nodes: Joi.array().items(Joi.object({
            name: Joi.string().allow(null),
            type: Joi.string().allow(null),
            key: Joi.string().allow(null),
          }).unknown(true)),
        }).unknown(true),
      }).unknown(true),
    }).unknown(true),
  }).unknown(true).required(),
}).unknown(true).required()

const isIssueLayoutResponse = createSchemeGuard<IssueLayoutResponse>(ISSUE_LAYOUT_RESPONSE_SCHEME, 'Failed to get issue layout from jira service')

const createIssueLayoutType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, ISSUE_LAYOUT_TYPE),
    fields: {
      projectId: {
        refType: BuiltinTypes.NUMBER,
      },
      extraDefinerId: {
        refType: BuiltinTypes.NUMBER,
      },
      owners: {
        refType: new ListType(onwerIssueLayoutType),
      },
      issueLayoutConfig: {
        refType: issueLayoutConfigType,
      },
    },
    path: [JIRA, adapterElements.TYPES_PATH, ISSUE_LAYOUT_TYPE],
  })

const getIssueLayout = async ({
  projectId,
  screenId,
  client,
}:{
    projectId: number
    screenId: number
    client: JiraClient
  }):
  Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> => {
  const baseUrl = '/rest/gira/1'
  const variables = {
    projectId,
    extraDefinerId: screenId,
    fieldPropertyKeys: [],
    availableItemsPageSize: 30,
  }
  const response = await client.gqlPost({
    url: baseUrl,
    query: QUERY,
    variables,
  })

  return response
}

const fromResponseLayoutOwnersToLayoutOwners = (layoutOwners: LayoutOwners): Owners => {
  const owners = layoutOwners.map(owner => ({
    data: {
      id: owner.id,
      name: owner.name,
      description: owner.description,
      avatarId: owner.avatarId,
      iconUrl: owner.iconUrl,
    },
  }))
  return owners
}


// const fromIssueLayoutConfigRespToIssueLayoutConfig = (
//   containers: containerIssueLayoutResponse[]
// ):
// IssueLayoutConfig => {
//   const items = containers.filter(container => container.containerType !== 'HIDDEN_ITEMS')
//     .flatMap(container => container.items.nodes.map(node => ({
//       type: node.fieldItemId ? 'FIELD' : 'PANEL',
//       sectionType: container.containerType,
//       key: node.fieldItemId || node.panelItemId || '',
//     })))
//   return { items }
// }

const fromIssueLayoutConfigRespToIssueLayoutConfigTwo = (
  issueLayoutConfiguration: IssueLayoutResponse
): IssueLayoutConfig => {
  const { issueLayoutResult, metadata } = issueLayoutConfiguration.issueLayoutConfiguration
  const { containers } = issueLayoutResult
  const items = containers.filter(container => container.containerType !== 'HIDDEN_ITEMS')
    .flatMap(container => container.items.nodes.map(node => ({
      type: node.fieldItemId ? 'FIELD' : 'PANEL',
      sectionType: container.containerType,
      key: node.fieldItemId || node.panelItemId || '',
    })))

  const itemKeyToNameAndType = Object.fromEntries(metadata.configuration.items.nodes
    .filter(item => Object.keys(item).includes('key'))
    .map(item => [item.key, { name: item.name, type: item.type }]))

  const itemsFull = items.map(item => ({
    ...item,
    data: itemKeyToNameAndType[item.key],
  }))
  return { items: itemsFull }
}

const deployIssueLayoutChanges = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const issueLayout = getChangeData(change)
  const response = await getIssueLayout({
    projectId: issueLayout.value.projectId,
    screenId: issueLayout.value.extraDefinerId,
    client,
  })
  if (!Array.isArray(response.data) && isIssueLayoutResponse(response.data.data)) {
    const { issueLayoutResult } = response.data.data.issueLayoutConfiguration
    const issueLayoutId = issueLayoutResult.id
    const items = issueLayout.value.issueLayoutConfig.items.map((item: IssueLayoutConfigItem) => ({
      type: item.type,
      sectionType: CAPITAL_CONTAINER_TO_LOWER_CONTAINER[item.sectionType],
      key: item.key,
      data: item.data ?? {},
    }))

    const data = {
      projectId: issueLayout.value.projectId,
      extraDefinerId: issueLayout.value.extraDefinerId,
      owners: issueLayout.value.owners.map((owner: Owner) => ({
        type: 'ISSUE_TYPE',
        data: owner.data,
      })),
      issueLayoutType: 'ISSUE_VIEW',
      issueLayoutConfig: {
        items,
      },
    }
    // eslint-disable-next-line no-console
    console.log(`data is ${safeJsonStringify(data, undefined, 2)}`)
    const url = `/rest/internal/1.0/issueLayouts/${issueLayoutId}`
    await client.put({ url, data })
  }
}

const filter: FilterCreator = ({ client }) => ({
  name: 'issueLayoutFilter',
  onFetch: async elements => {
    const projectToScreenId: Record<number, number[]> = Object.fromEntries(
      (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
        .filter(isInstanceElement)
        .map(async project => {
          if (isReferenceExpression(project.value.issueTypeScreenScheme)) {
            const screenSchemes = (await Promise.all(((await project.value.issueTypeScreenScheme.getResolvedValue())
              .value.issueTypeMappings
              .flatMap((struct: issueTypeMappingStruct) => struct.screenSchemeId.getResolvedValue()))))
              .filter(isInstanceElement)

            const screens = screenSchemes.map(screenScheme => screenScheme.value.screens.default.value.value.id)
            return [Number(project.value.id), screens]
          }
          return undefined
        })))
        .filter(isDefined)
    )
    const projectIdToProjectName = Object.fromEntries(
      (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
        .filter(isInstanceElement)
        .map(async project => {
          const projectName = project.value.name
          return [Number(project.value.id), projectName]
        })))
        .filter(isDefined)
    )
    const issueLayoutType = createIssueLayoutType()
    elements.push(issueLayoutType)
    ISSUE_LAYOUT_SUB_TYPES.forEach(type => elements.push(type))

    await Promise.all(Object.entries(projectToScreenId)
      .flatMap(([projectId, screenIds]) => screenIds.map(async screenId => {
        const response = await getIssueLayout({
          projectId: Number(projectId),
          screenId,
          client,
        })
        if (!Array.isArray(response.data) && isIssueLayoutResponse(response.data.data)) {
          const { issueLayoutResult } = response.data.data.issueLayoutConfiguration
          const name = `${projectIdToProjectName[projectId]}_${issueLayoutResult.name}`
          const issueLayout = new InstanceElement(
            naclCase(name),
            issueLayoutType,
            {
              projectId: Number(projectId),
              extraDefinerId: screenId,
              owners: fromResponseLayoutOwnersToLayoutOwners(issueLayoutResult.usageInfo.edges[0].node.layoutOwners),
              issueLayoutConfig: fromIssueLayoutConfigRespToIssueLayoutConfigTwo(response.data.data),
            },
            [JIRA, adapterElements.RECORDS_PATH, ISSUE_LAYOUT_TYPE, pathNaclCase(name)],
          )
          elements.push(issueLayout)
          setTypeDeploymentAnnotations(issueLayoutType)
          await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.CREATABLE)
          await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.UPDATABLE)
        }
      })))
  },
  deploy: async changes => {
    const [issueLayoutChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === ISSUE_LAYOUT_TYPE
    )
    const deployResult = await deployChanges(issueLayoutChanges,
      async change => {
        if (isInstanceChange(change)) {
          return deployIssueLayoutChanges(change, client)
        }
        return undefined
      })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
