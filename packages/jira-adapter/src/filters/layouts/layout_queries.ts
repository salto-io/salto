/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
