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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, ReferenceExpression, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { safeJsonStringify, createSchemeGuard } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as adapterElements } from '@salto-io/adapter-components'
import JiraClient from '../client/client'
import { ISSUE_LAYOUT_TYPE, JIRA, PROJECT_TYPE } from '../constants'
import { FilterCreator } from '../filter'

const { isDefined } = lowerDashValues
const QUERY = `query SwiftJswCmpInitial($projectId: Long!, $extraDefinerId: Long!, $fieldPropertyKeys: [String!]!, $availableItemsPageSize: Int!, $requestOwnerPropertyKeys: [String!] = []) {
    ...CMPJSWLayoutConfigurationFragment
  }
  
  
  
  fragment JiraIssueLayoutOwnerFragment on JiraIssueLayoutOwner {
    __typename
    ... on JiraIssueLayoutIssueTypeOwner {
      id
      name
      description
      avatarId
      iconUrl
    }
    ... on JiraIssueLayoutRequestTypeOwner {
      id
      name
      description
      avatarId
      iconUrl
      instructions
      properties(keys: $requestOwnerPropertyKeys)
    }
  }
  
  fragment JiraIssueLayoutUsageInfo on JiraIssueLayoutUsageInfoConnection {
    edges {
      currentProject
      node {
        avatarId
        projectId
        projectKey
        projectName
        layoutOwners {
          ... JiraIssueLayoutOwnerFragment
        }
      }
    }
  }
  
  
  
    fragment JiraIssueLayoutActivePanelItemFragment on JiraIssueItemPanelItem {
    __typename
      panelItemId
    }
  
  
  
    fragment JiraIssueLayoutActiveFieldItemFragment on JiraIssueItemFieldItem {
      __typename
      fieldItemId
      containerPosition
    }
  
    fragment JiraIssueLayoutTabContainerFragment on JiraIssueItemTabContainer {
        __typename
        tabContainerId
        name
        items {
          nodes {
            ...JiraIssueLayoutActiveFieldItemFragment
          }
          totalCount
        }
    }
  
  fragment JiraIssueLayoutItemContainerFragment on JiraIssueItemContainer {
    containerType
    items {
      nodes {
        __typename
        ... JiraIssueLayoutActiveFieldItemFragment,
        ... JiraIssueLayoutActivePanelItemFragment,
        ... JiraIssueLayoutTabContainerFragment,
      }
    }
  }
  
  
  
  fragment PanelItemFragment on JiraIssueLayoutPanelItemConfiguration {
    panelItemId
    name
    operations {
        editable
        removable
        categoriesWhitelist
        canAssociateInSettings
        deletable
    }
  }
  
  
  fragment FieldItemOperationsFragment on JiraIssueLayoutFieldOperations {
    editable
    canModifyRequired
    canModifyOptions
    canModifyDefaultValue
    canModifyPropertyConfiguration
    removable
    deletable
    canAssociateInSettings
    categoriesWhitelist
  }
  
  
  fragment FieldItemProviderFragment on JiraIssueLayoutFieldProvider {
    key
    name
  }
  
  
  fragment FieldItemBaseFragment on JiraIssueLayoutFieldItemConfiguration {
    fieldItemId
    key
    name
    type
    custom
    global
    description
    configuration
    required
    externalUuid
    defaultValue
    options {
      ...FieldItemOptionsFragment
    }
    operations {
      ...FieldItemOperationsFragment
    }
    provider {
      ...FieldItemProviderFragment
    }
    availability {
      isHiddenIn {
        __typename
        ... on JiraIssueLayoutFieldConfigurationHiddenInGlobal {
          fieldConfigs {
            id
            configName
          }
        }
        ... on JiraIssueLayoutFieldConfigurationHiddenInLayoutOwner {
          layoutOwnerId
          fieldConfigs {
            id
            configName
          }
        }
      }
      context {
        layoutOwnerIds
        id
      }
    }
  }
  
  
  fragment FieldItemOptionsFragment on JiraIssueLayoutFieldOption {
    value
    id
    externalUuid
    parentId
  }
  
    fragment FieldItemFragment on JiraIssueLayoutFieldItemConfiguration {
      ...FieldItemBaseFragment
      properties(keys: $fieldPropertyKeys)
    }
  
  
  fragment SystemAvailableLayoutItemsGroup on JiraIssueLayoutFieldPanelItemConfigurationResult {
    items {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
            node {
                __typename
                ...FieldItemFragment
                ...PanelItemFragment
            }
        }
    }
  }
  fragment CustomAvailableLayoutItemsGroup on JiraIssueLayoutFieldItemConfigurationResult {
    items {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
            node {
                __typename
                ...FieldItemFragment
            }
        }
    }
  }
  
  
  fragment JiraIssueLayoutItemConfigurationFragment on JiraIssueLayoutItemConfigurationResult {
    items {
      nodes {
        __typename
        ...FieldItemFragment
        ...PanelItemFragment
      }
    }
  }
  
  fragment CMPJSWLayoutConfigurationFragment on Query {
    issueLayoutConfiguration(issueLayoutKey: {projectId: $projectId, extraDefinerId: $extraDefinerId}, type: ISSUE_VIEW) {
      __typename
      ... on JiraIssueLayoutConfigurationResult {
        issueLayoutResult {
          __typename
          id
          name
          usageInfo {
             ...JiraIssueLayoutUsageInfo
          }
          containers {
              ...JiraIssueLayoutItemContainerFragment
          }
        }
        metadata {
          __typename
          configuration {
              ...JiraIssueLayoutItemConfigurationFragment
          }
          availableItems {
            restrictedFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            suggestedFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            systemAndAppFields(first: $availableItemsPageSize) {
              ...SystemAvailableLayoutItemsGroup
            }
            textFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            labelsFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            peopleFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            dateFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            selectFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            numberFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            otherFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
            advancedFields(first: $availableItemsPageSize) {
              ...CustomAvailableLayoutItemsGroup
            }
          }
        }
      }
    }
  }`

type issueTypeMappingStruct = {
    issueTypeId: string
    screenSchemeId: ReferenceExpression
}

type IssueLayoutResponse = {
  issueLayoutConfiguration: {
      issueLayoutResult: {
          id: string
          name: string
        }
      }
}

const ISSUE_LAYOUT_RESPONSE_SCHEME = Joi.object({
  issueLayoutConfiguration: Joi.object({
    issueLayoutResult: Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
    }).unknown(true),
  }).unknown(true).required(),
}).unknown(true)

const isIssueLayoutResponse = createSchemeGuard<IssueLayoutResponse>(ISSUE_LAYOUT_RESPONSE_SCHEME, 'Failed to get issue layout from jira service')

const createIssueLayoutType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, ISSUE_LAYOUT_TYPE),
    fields: {
      id: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      name: { refType: BuiltinTypes.STRING },
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


const filter: FilterCreator = ({ client }) => ({
  name: 'issueLayoutFilter',
  onFetch: async elements => {
    const projectToScreenId: Record<number, number[]> = Object.fromEntries(
      (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
        .filter(isInstanceElement)
        .map(async project => {
          if (isReferenceExpression(project.value.issueTypeScreenScheme)) {
            const screenSchemes = (await Promise.all(((await project.value.issueTypeScreenScheme.getResolvedValue())
              ?.value?.issueTypeMappings
              .flatMap((struct: issueTypeMappingStruct) => struct.screenSchemeId.getResolvedValue()))))
              .filter(isInstanceElement)

            const screens = screenSchemes.map(screenScheme => screenScheme.value.screens.default.value.value.id)
            return [Number(project.value.id), screens]
          }
          return undefined
        })))
        .filter(isDefined)
    )
    const issueLayoutType = createIssueLayoutType()
    // eslint-disable-next-line no-console
    console.log(issueLayoutType)

    await Promise.all(Object.entries(projectToScreenId)
      .flatMap(([projectId, screenIds]) => screenIds.map(async screenId => {
        const response = await getIssueLayout({
          projectId: Number(projectId),
          screenId,
          client,
        })
        if (!Array.isArray(response.data) && isIssueLayoutResponse(response.data.data)) {
        // eslint-disable-next-line no-console
          console.log(`projId is: ${projectId} and response is: ${safeJsonStringify(response.data)}`)
        }
      })))
  },
})

export default filter
