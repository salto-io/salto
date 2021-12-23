# JIRA system configuration
## Default Configuration
```hcl
jira {
  apiDefinitions = {
    platformSwagger = {
      url = "https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json"
    }
    jiraSwagger = {
      url = "https://developer.atlassian.com/cloud/jira/software/swagger.v3.json"
      typeNameOverrides = [
        {
          originalName = "agile__1_0__board_values@uuvuuu"
          newName = "Board"
        },
      ]
    }
    typeDefaults = {
      transformation = {
        idFields = [
          "name",
        ]
        fieldsToOmit = [
          {
            fieldName = "expand"
            fieldType = "string"
          },
        ]
      }
    }
    types = {
      Configuration = {
        transformation = {
          dataField = "."
          isSingleton = true
        }
      }
      PageBeanDashboard = {
        request = {
          url = "/rest/api/3/dashboard/search"
          paginationField = "startAt"
          queryParams = {
            expand = "description,owner,viewUrl,favouritedCount,sharePermissions"
          }
        }
      }
      PageBeanField = {
        request = {
          url = "/rest/api/3/field/search"
          paginationField = "startAt"
          queryParams = {
            expand = "key,searcherKey"
          }
          recurseInto = [
            {
              type = "PageBeanCustomFieldContext"
              toField = "contexts"
              context = [
                {
                  name = "fieldId"
                  fromField = "id"
                },
                {
                  name = "fieldSchema"
                  fromField = "schema.custom"
                },
              ]
              conditions = [
                {
                  fromField = "id"
                  match = [
                    "customfield_.*",
                  ]
                },
              ]
            },
            {
              type = "PageBeanCustomFieldContextDefaultValue"
              toField = "contextDefaults"
              context = [
                {
                  name = "fieldId"
                  fromField = "id"
                },
              ]
              conditions = [
                {
                  fromField = "schema.custom"
                  match = [
                    "com.atlassian.jira.plugin.system.customfieldtypes:*",
                  ]
                },
              ]
            },
            {
              type = "PageBeanIssueTypeToContextMapping"
              toField = "contextIssueTypes"
              context = [
                {
                  name = "fieldId"
                  fromField = "id"
                },
              ]
              conditions = [
                {
                  fromField = "id"
                  match = [
                    "customfield_.*",
                  ]
                },
              ]
            },
            {
              type = "PageBeanCustomFieldContextProjectMapping"
              toField = "contextProjects"
              context = [
                {
                  name = "fieldId"
                  fromField = "id"
                },
              ]
              conditions = [
                {
                  fromField = "id"
                  match = [
                    "customfield_.*",
                  ]
                },
              ]
            },
          ]
        }
      }
      Field = {
        transformation = {
          idFields = [
            "id",
          ]
          fieldTypeOverrides = [
            {
              fieldName = "contexts"
              fieldType = "list<CustomFieldContext>"
            },
            {
              fieldName = "contextDefaults"
              fieldType = "list<CustomFieldContextDefaultValue>"
            },
            {
              fieldName = "contextIssueTypes"
              fieldType = "list<IssueTypeToContextMapping>"
            },
            {
              fieldName = "contextProjects"
              fieldType = "list<CustomFieldContextProjectMapping>"
            },
          ]
        }
      }
      PageBeanCustomFieldContext = {
        request = {
          url = "/rest/api/3/field/{fieldId}/context"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "PageBeanCustomFieldContextOption"
              toField = "options"
              context = [
                {
                  name = "contextId"
                  fromField = "id"
                },
              ]
              conditions = [
                {
                  fromContext = "fieldSchema"
                  match = [
                    "com.atlassian.jira.plugin.system.customfieldtypes:select",
                    "com.atlassian.jira.plugin.system.customfieldtypes:multiselect",
                    "com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect",
                    "com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons",
                    "com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes",
                  ]
                },
              ]
            },
          ]
        }
      }
      CustomFieldContext = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "options"
              fieldType = "list<CustomFieldContextOption>"
            },
          ]
        }
      }
      PageBeanCustomFieldContextOption = {
        request = {
          url = "/rest/api/3/field/{fieldId}/context/{contextId}/option"
          paginationField = "startAt"
        }
      }
      PageBeanFieldConfigurationDetails = {
        request = {
          url = "/rest/api/3/fieldconfiguration"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "PageBeanFieldConfigurationItem"
              toField = "fields"
              context = [
                {
                  name = "id"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      FieldConfigurationDetails = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "fields"
              fieldType = "list<FieldConfigurationItem>"
            },
          ]
        }
      }
      PageBeanFieldConfigurationItem = {
        request = {
          url = "/rest/api/3/fieldconfiguration/{id}/fields"
          paginationField = "startAt"
        }
      }
      PageBeanFieldConfigurationScheme = {
        request = {
          url = "/rest/api/3/fieldconfigurationscheme"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "PageBeanFieldConfigurationIssueTypeItem"
              toField = "items"
              context = [
                {
                  name = "schemeId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      FieldConfigurationScheme = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<FieldConfigurationIssueTypeItem>"
            },
          ]
        }
      }
      PageBeanFieldConfigurationIssueTypeItem = {
        request = {
          url = "/rest/api/3/fieldconfigurationscheme/mapping?fieldConfigurationSchemeId={schemeId}"
          paginationField = "startAt"
        }
      }
      FieldConfigurationIssueTypeItem = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "fieldConfigurationSchemeId"
            },
          ]
        }
      }
      PageBeanFilterDetails = {
        request = {
          url = "/rest/api/3/filter/search"
          queryParams = {
            expand = "description,owner,jql,searchUrl,viewUrl,sharePermissions,subscriptions"
          }
          paginationField = "startAt"
          recurseInto = [
            {
              type = "rest__api__3__filter___id___columns@uuuuuuuu_00123_00125uu"
              toField = "columns"
              context = [
                {
                  name = "id"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      FilterDetails = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "columns"
              fieldType = "list<ColumnItem>"
            },
          ]
        }
      }
      PageBeanIssueTypeScheme = {
        request = {
          url = "/rest/api/3/issuetypescheme"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "PageBeanIssueTypeSchemeMapping"
              toField = "issueTypes"
              context = [
                {
                  name = "schemeId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      IssueTypeScheme = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "issueTypes"
              fieldType = "list<IssueTypeSchemeMapping>"
            },
          ]
        }
      }
      PageBeanIssueTypeSchemeMapping = {
        request = {
          url = "/rest/api/3/issuetypescheme/mapping?issueTypeSchemeId={schemeId}"
          paginationField = "startAt"
        }
      }
      IssueTypeSchemeMapping = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "issueTypeSchemeId"
            },
          ]
        }
      }
      PageBeanIssueTypeScreenScheme = {
        request = {
          url = "/rest/api/3/issuetypescreenscheme"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "PageBeanIssueTypeScreenSchemeItem"
              toField = "items"
              context = [
                {
                  name = "schemeId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      IssueTypeScreenScheme = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<IssueTypeScreenSchemeItem>"
            },
          ]
        }
      }
      PageBeanIssueTypeScreenSchemeItem = {
        request = {
          url = "/rest/api/3/issuetypescreenscheme/mapping?issueTypeScreenSchemeId={schemeId}"
          paginationField = "startAt"
        }
      }
      IssueTypeScreenSchemeItem = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "issueTypeScreenSchemeId"
            },
          ]
        }
      }
      PageBeanNotificationScheme = {
        request = {
          url = "/rest/api/3/notificationscheme"
          queryParams = {
            expand = "all"
          }
          paginationField = "startAt"
        }
      }
      Permissions = {
        request = {
          url = "/rest/api/3/permissions"
        }
      }
      PermissionSchemes = {
        request = {
          url = "/rest/api/3/permissionscheme"
          queryParams = {
            expand = "all"
          }
        }
      }
      ProjectType = {
        transformation = {
          idFields = [
            "key",
          ]
        }
      }
      PageBeanProject = {
        request = {
          url = "/rest/api/3/project/search"
          queryParams = {
            expand = "description,lead,issueTypes,url,projectKeys,permissions"
          }
          recurseInto = [
            {
              type = "PageBeanComponentWithIssueCount"
              toField = "components"
              context = [
                {
                  name = "projectIdOrKey"
                  fromField = "id"
                },
              ]
            },
            {
              type = "ContainerOfWorkflowSchemeAssociations"
              toField = "workflowScheme"
              context = [
                {
                  name = "projectId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "PermissionScheme"
              toField = "permissionScheme"
              context = [
                {
                  name = "projectId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "NotificationScheme"
              toField = "notificationScheme"
              context = [
                {
                  name = "projectId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "PageBeanIssueTypeScreenSchemesProjects"
              toField = "issueTypeScreenScheme"
              context = [
                {
                  name = "projectId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "PageBeanFieldConfigurationSchemeProjects"
              toField = "fieldConfigurationScheme"
              context = [
                {
                  name = "projectId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      Project = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "components"
              fieldType = "list<ComponentWithIssueCount>"
            },
            {
              fieldName = "workflowScheme"
              fieldType = "list<WorkflowSchemeAssociations>"
            },
            {
              fieldName = "permissionScheme"
              fieldType = "list<PermissionScheme>"
            },
            {
              fieldName = "notificationScheme"
              fieldType = "list<NotificationScheme>"
            },
            {
              fieldName = "issueTypeScreenScheme"
              fieldType = "list<IssueTypeScreenSchemesProjects>"
            },
            {
              fieldName = "fieldConfigurationScheme"
              fieldType = "list<FieldConfigurationSchemeProjects>"
            },
          ]
        }
      }
      ContainerOfWorkflowSchemeAssociations = {
        request = {
          url = "/rest/api/3/workflowscheme/project?projectId={projectId}"
        }
      }
      WorkflowSchemeAssociations = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "projectIds"
            },
          ]
        }
      }
      ComponentWithIssueCount = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "issueCount"
            },
          ]
        }
      }
      PermissionScheme = {
        request = {
          url = "/rest/api/3/project/{projectId}/permissionscheme"
        }
      }
      NotificationScheme = {
        request = {
          url = "/rest/api/3/project/{projectId}/notificationscheme"
        }
      }
      PageBeanIssueTypeScreenSchemesProjects = {
        request = {
          url = "/rest/api/3/issuetypescreenscheme/project?projectId={projectId}"
        }
      }
      IssueTypeScreenSchemesProjects = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "projectIds"
            },
          ]
        }
      }
      PageBeanFieldConfigurationSchemeProjects = {
        request = {
          url = "/rest/api/3/fieldconfigurationscheme/project?projectId={projectId}"
        }
      }
      PageBeanScreen = {
        request = {
          url = "/rest/api/3/screens"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "rest__api__3__screens___screenId___tabs@uuuuuuuu_00123_00125uu"
              toField = "tabs"
              context = [
                {
                  name = "screenId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "rest__api__3__screens___screenId___availableFields@uuuuuuuu_00123_00125uu"
              toField = "availableFields"
              context = [
                {
                  name = "screenId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      Screen = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "tabs"
              fieldType = "list<ScreenableTab>"
            },
            {
              fieldName = "availableFields"
              fieldType = "list<ScreenableField>"
            },
          ]
        }
      }
      rest__api__3__screens___screenId___tabs@uuuuuuuu_00123_00125uu = {
        request = {
          url = "/rest/api/3/screens/{screenId}/tabs"
          recurseInto = [
            {
              type = "rest__api__3__screens___screenId___tabs___tabId___fields@uuuuuuuu_00123_00125uuuu_00123_00125uu"
              toField = "fields"
              context = [
                {
                  name = "tabId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          dataField = "."
        }
      }
      ScreenableTab = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "fields"
              fieldType = "list<ScreenableField>"
            },
          ]
        }
      }
      PageBeanScreenScheme = {
        request = {
          url = "/rest/api/3/screenscheme"
          paginationField = "startAt"
        }
      }
      rest__api__3__status = {
        transformation = {
          dataField = "."
        }
      }
      PageBeanWorkflow = {
        request = {
          url = "/rest/api/3/workflow/search"
          paginationField = "startAt"
          queryParams = {
            expand = "transitions,transitions.rules,statuses,statuses.properties"
          }
        }
      }
      Workflow = {
        transformation = {
          idFields = [
            "id.name",
          ]
        }
      }
      PageBeanWorkflowScheme = {
        request = {
          url = "/rest/api/3/workflowscheme"
          paginationField = "startAt"
        }
      }
      IssueTypeDetails = {
        request = {
          url = "/rest/api/3/issuetype"
        }
        transformation = {
          dataField = "."
        }
      }
      AttachmentSettings = {
        transformation = {
          isSingleton = true
        }
      }
      Permissions_permissions = {
        transformation = {
          isSingleton = true
        }
      }
      agile__1_0__board@uuvuu = {
        request = {
          url = "/rest/agile/1.0/board"
          paginationField = "startAt"
          queryParams = {
            expand = "admins,permissions"
          }
          recurseInto = [
            {
              type = "agile__1_0__board___boardId___configuration@uuvuuuu_00123_00125uu"
              toField = "config"
              context = [
                {
                  name = "boardId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      Board = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "config"
              fieldType = "list<agile__1_0__board___boardId___configuration@uuvuuuu_00123_00125uu>"
            },
          ]
        }
      }
      agile__1_0__board___boardId___configuration@uuvuuuu_00123_00125uu = {
        request = {
          url = "/rest/agile/1.0/board/{boardId}/configuration"
        }
      }
    }
  }
}
```
