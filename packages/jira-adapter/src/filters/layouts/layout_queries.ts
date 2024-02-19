/*
 *                      Copyright 2024 Salto Labs Ltd.
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
export const QUERY = `query SwiftJswCmpInitial($projectId: Long!, $extraDefinerId: Long!) {
  ...CMPJSWLayoutConfigurationFragment
}

fragment JiraIssueLayoutActivePanelItemFragment on JiraIssueItemPanelItem {
  panelItemId
}

fragment JiraIssueLayoutActiveFieldItemFragment on JiraIssueItemFieldItem {
  fieldItemId
  containerPosition
}

fragment JiraIssueLayoutTabContainerFragment on JiraIssueItemTabContainer {
  tabContainerId
  name
  items {
    nodes {
      ...JiraIssueLayoutActiveFieldItemFragment
    }
  }
}

fragment JiraIssueLayoutItemContainerFragment on JiraIssueItemContainer {
  containerType
  items {
    nodes {
      ... JiraIssueLayoutActiveFieldItemFragment,
      ... JiraIssueLayoutActivePanelItemFragment,
      ... JiraIssueLayoutTabContainerFragment,
    }
  }
}

fragment PanelItemFragment on JiraIssueLayoutPanelItemConfiguration {
  panelItemId
  name
}

fragment FieldItemBaseFragment on JiraIssueLayoutFieldItemConfiguration {
  fieldItemId
  custom
  global
  description
  configuration
  required
  defaultValue
}

fragment FieldItemFragment on JiraIssueLayoutFieldItemConfiguration {
  ...FieldItemBaseFragment
  properties(keys: [])
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

export const QUERY_JSM = `query SwiftJsmCmpCustomerViewInitial($projectId: Long!, $extraDefinerId: Long!, $layoutType: IssueLayoutType!) {
  ...CMPJSMLayoutConfigurationFragment
}

fragment JiraIssueLayoutActivePanelItemFragment on JiraIssueItemPanelItem {
  panelItemId
}

fragment JiraIssueLayoutActiveFieldItemFragment on JiraIssueItemFieldItem {
  fieldItemId
  containerPosition
}

fragment JiraIssueLayoutTabContainerFragment on JiraIssueItemTabContainer {
  tabContainerId
  name
  items {
    nodes {
      ...JiraIssueLayoutActiveFieldItemFragment
    }
  }
}

fragment JiraIssueLayoutItemContainerFragment on JiraIssueItemContainer {
  containerType
  items {
    nodes {
      ... JiraIssueLayoutActiveFieldItemFragment,
      ... JiraIssueLayoutActivePanelItemFragment,
      ... JiraIssueLayoutTabContainerFragment,
    }
  }
}



fragment PanelItemFragment on JiraIssueLayoutPanelItemConfiguration {
  panelItemId
  name
}


fragment FieldItemBaseFragment on JiraIssueLayoutFieldItemConfiguration {
  fieldItemId
  custom
  global
  description
  configuration
  required
  defaultValue
}

fragment FieldItemFragment on JiraIssueLayoutFieldItemConfiguration {
  ...FieldItemBaseFragment
  properties(keys: [])
}

fragment JiraIssueLayoutItemConfigurationFragment on JiraIssueLayoutItemConfigurationResult {
  items {
    nodes {
      ...FieldItemFragment
      ...PanelItemFragment
    }
  }
}

fragment CMPJSMLayoutConfigurationFragment on Query {
  issueLayoutConfiguration(issueLayoutKey: {projectId: $projectId, extraDefinerId: $extraDefinerId}, type: $layoutType) {
    ... on JiraIssueLayoutConfigurationResult {
      issueLayoutResult {
        id
        name
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
