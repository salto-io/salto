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
import gql from 'graphql-tag'

export const QUERY = gql`query SwiftJswCmpInitial($projectId: Long!, $extraDefinerId: Long!, $fieldPropertyKeys: [String!]!, $requestOwnerPropertyKeys: [String!] = []) {
    ...CMPJSWLayoutConfigurationFragment
  }
  
  
  
  fragment JiraIssueLayoutOwnerFragment on JiraIssueLayoutOwner {
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
      panelItemId
    }
  
  
  
    fragment JiraIssueLayoutActiveFieldItemFragment on JiraIssueItemFieldItem {
      fieldItemId
      containerPosition
    }
  
  
  fragment JiraIssueLayoutItemContainerFragment on JiraIssueItemContainer {
    containerType
    items {
      nodes {
        ... JiraIssueLayoutActiveFieldItemFragment,
        ... JiraIssueLayoutActivePanelItemFragment,
      }
    }
  }
  
  fragment PanelItemFragment on JiraIssueLayoutPanelItemConfiguration {
    panelItemId
    name
  }
  
  fragment FieldItemBaseFragment on JiraIssueLayoutFieldItemConfiguration {
    fieldItemId
    key
    name
    type
  }
  
    fragment FieldItemFragment on JiraIssueLayoutFieldItemConfiguration {
      ...FieldItemBaseFragment
      properties(keys: $fieldPropertyKeys)
    } 
  
  fragment JiraIssueLayoutItemConfigurationFragment on JiraIssueLayoutItemConfigurationResult {
    items {
      nodes {
        ...FieldItemFragment
        ...PanelItemFragment
      }
    }
  }
  
  fragment CMPJSWLayoutConfigurationFragment on Query {
    issueLayoutConfiguration(issueLayoutKey: {projectId: $projectId, extraDefinerId: $extraDefinerId}, type: ISSUE_VIEW) {
      ... on JiraIssueLayoutConfigurationResult {
        issueLayoutResult {
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
          configuration {
              ...JiraIssueLayoutItemConfigurationFragment
          }
        }
      }
    }
  }`
