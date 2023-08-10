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

export const QUERY = `query SwiftJswCmpInitial($projectId: Long!, $extraDefinerId: Long!, $fieldPropertyKeys: [String!]!, $availableItemsPageSize: Int!, $requestOwnerPropertyKeys: [String!] = []) {
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
