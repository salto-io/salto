# JIRA system configuration
## Default Configuration
```hcl
jira {
  apiDefinitions = {
    platformSwagger = {
      url = "https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json"
      typeNameOverrides = [
        {
          originalName = "FilterDetails"
          newName = "Filter"
        },
        {
          originalName = "IssueTypeDetails"
          newName = "IssueType"
        },
        {
          originalName = "StatusDetails"
          newName = "Status"
        },
        {
          originalName = "rest__api__3__application_properties@uuuuuub"
          newName = "ApplicationProperties"
        },
        {
          originalName = "rest__api__3__applicationrole"
          newName = "ApplicationRoles"
        },
        {
          originalName = "rest__api__3__configuration__timetracking__list"
          newName = "TimeTrackingProviders"
        },
        {
          originalName = "PageBeanDashboard"
          newName = "Dashboards"
        },
        {
          originalName = "PageBeanField"
          newName = "Fields"
        },
        {
          originalName = "PageBeanFieldConfigurationDetails"
          newName = "FieldConfigurations"
        },
        {
          originalName = "FieldConfigurationDetails"
          newName = "FieldConfiguration"
        },
        {
          originalName = "PageBeanFieldConfigurationScheme"
          newName = "FieldsConfigurationScheme"
        },
        {
          originalName = "PageBeanFieldConfigurationIssueTypeItem"
          newName = "FieldsConfigurationIssueTypeItem"
        },
        {
          originalName = "PageBeanFilterDetails"
          newName = "Filters"
        },
        {
          originalName = "PageBeanIssueTypeScheme"
          newName = "IssueTypeSchemes"
        },
        {
          originalName = "PageBeanIssueTypeSchemeMapping"
          newName = "IssueTypeSchemeMappings"
        },
        {
          originalName = "PageBeanIssueTypeScreenScheme"
          newName = "IssueTypeScreenSchemes"
        },
        {
          originalName = "PageBeanIssueTypeScreenSchemeItem"
          newName = "IssueTypeScreenSchemeItems"
        },
        {
          originalName = "PageBeanNotificationScheme"
          newName = "NotificationSchemes"
        },
        {
          originalName = "rest__api__3__priority"
          newName = "Priorities"
        },
        {
          originalName = "rest__api__3__projectCategory"
          newName = "ProjectCategories"
        },
        {
          originalName = "PageBeanProject"
          newName = "Projects"
        },
        {
          originalName = "rest__api__3__project__type"
          newName = "ProjectTypes"
        },
        {
          originalName = "rest__api__3__resolution"
          newName = "Resolutions"
        },
        {
          originalName = "rest__api__3__role"
          newName = "Roles"
        },
        {
          originalName = "PageBeanScreen"
          newName = "Screens"
        },
        {
          originalName = "PageBeanScreenScheme"
          newName = "ScreenSchemes"
        },
        {
          originalName = "rest__api__3__status"
          newName = "Statuses"
        },
        {
          originalName = "rest__api__3__statuscategory"
          newName = "StatusCategories"
        },
        {
          originalName = "PageBeanWorkflow"
          newName = "Workflows"
        },
        {
          originalName = "PageBeanWorkflowScheme"
          newName = "WorkflowSchemes"
        },
      ]
    }
    jiraSwagger = {
      url = "https://developer.atlassian.com/cloud/jira/software/swagger.v3.json"
      typeNameOverrides = [
        {
          originalName = "agile__1_0__board@uuvuu"
          newName = "Boards"
        },
        {
          originalName = "Boards_values"
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
      Dashboards = {
        request = {
          url = "/rest/api/3/dashboard/search"
          paginationField = "startAt"
          queryParams = {
            expand = "description,owner,sharePermissions"
          }
        }
      }
      NotificationEvent = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      EventNotification = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      Dashboard = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "isFavourite"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/dashboard"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/dashboard/{id}"
            method = "put"
          }
          remove = {
            url = "/rest/api/3/dashboard/{id}"
            method = "delete"
          }
        }
      }
      Fields = {
        request = {
          url = "/rest/api/3/field/search"
          paginationField = "startAt"
          queryParams = {
            expand = "searcherKey,isLocked"
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
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
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
        deployRequests = {
          add = {
            url = "/rest/api/3/field"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/field/{fieldId}"
            method = "put"
            urlParamsToFields = {
              fieldId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/field/{id}"
            method = "delete"
          }
        }
      }
      ApplicationProperty = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "key"
            },
          ]
        }
        deployRequests = {
          modify = {
            url = "/rest/api/3/application-properties/{id}"
            method = "put"
          }
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
      CustomFieldContextOption = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
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
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "isGlobalContext"
            },
            {
              fieldName = "isAnyIssueType"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/field/{fieldId}/context"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/field/{fieldId}/context/{contextId}"
            method = "put"
            urlParamsToFields = {
              contextId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/field/{fieldId}/context/{contextId}"
            method = "delete"
            urlParamsToFields = {
              contextId = "id"
            }
          }
        }
      }
      PageBeanCustomFieldContextOption = {
        request = {
          url = "/rest/api/3/field/{fieldId}/context/{contextId}/option"
          paginationField = "startAt"
        }
      }
      FieldConfigurations = {
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
      FieldConfiguration = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "fields"
              fieldType = "list<FieldConfigurationItem>"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/fieldconfiguration"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/fieldconfiguration/{id}"
            method = "put"
          }
          remove = {
            url = "/rest/api/3/fieldconfiguration/{id}"
            method = "delete"
          }
        }
      }
      PageBeanFieldConfigurationItem = {
        request = {
          url = "/rest/api/3/fieldconfiguration/{id}/fields"
          paginationField = "startAt"
        }
      }
      FieldsConfigurationScheme = {
        request = {
          url = "/rest/api/3/fieldconfigurationscheme"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "FieldsConfigurationIssueTypeItem"
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
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      FieldsConfigurationIssueTypeItem = {
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
      Filters = {
        request = {
          url = "/rest/api/3/filter/search"
          queryParams = {
            expand = "description,owner,jql,sharePermissions,subscriptions"
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
      Filter = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "columns"
              fieldType = "list<ColumnItem>"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/filter"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/filter/{id}"
            method = "put"
          }
          remove = {
            url = "/rest/api/3/filter/{id}"
            method = "delete"
          }
        }
      }
      IssueTypeSchemes = {
        request = {
          url = "/rest/api/3/issuetypescheme"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "IssueTypeSchemeMappings"
              toField = "issueTypeIds"
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
      Board_location = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      IssueTypeScheme = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "issueTypeIds"
              fieldType = "list<IssueTypeSchemeMapping>"
            },
          ]
          serviceIdField = "issueTypeSchemeId"
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/issuetypescheme"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/issuetypescheme/{issueTypeSchemeId}"
            method = "put"
          }
          remove = {
            url = "/rest/api/3/issuetypescheme/{issueTypeSchemeId}"
            method = "delete"
          }
        }
      }
      IssueTypeSchemeMappings = {
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
      IssueTypeScreenSchemes = {
        request = {
          url = "/rest/api/3/issuetypescreenscheme"
          paginationField = "startAt"
          recurseInto = [
            {
              type = "IssueTypeScreenSchemeItems"
              toField = "issueTypeMappings"
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
              fieldName = "issueTypeMappings"
              fieldType = "list<IssueTypeScreenSchemeItem>"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        request = {
          url = "/rest/api/3/issuetypescreenscheme"
          paginationField = "startAt"
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/issuetypescreenscheme"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/issuetypescreenscheme/{issueTypeScreenSchemeId}"
            method = "put"
            urlParamsToFields = {
              issueTypeScreenSchemeId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/issuetypescreenscheme/{issueTypeScreenSchemeId}"
            method = "delete"
            urlParamsToFields = {
              issueTypeScreenSchemeId = "id"
            }
          }
        }
      }
      IssueTypeScreenSchemeItems = {
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
      NotificationSchemes = {
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
            expand = "permissions,user"
          }
        }
      }
      PermissionHolder = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "user"
              fieldType = "User"
            },
          ]
        }
      }
      PermissionGrant = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      PermissionScheme = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        request = {
          url = "/rest/api/3/project/{projectId}/permissionscheme"
          queryParams = {
            expand = "all"
          }
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/permissionscheme"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/permissionscheme/{schemeId}"
            method = "put"
            urlParamsToFields = {
              schemeId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/permissionscheme/{schemeId}"
            method = "delete"
            urlParamsToFields = {
              schemeId = "id"
            }
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
      Projects = {
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
              isSingle = true
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
              isSingle = true
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
              isSingle = true
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
              isSingle = true
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
              isSingle = true
            },
          ]
        }
      }
      RoleActor = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      ProjectCategory = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/projectCategory"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/projectCategory/{id}"
            method = "put"
          }
          remove = {
            url = "/rest/api/3/projectCategory/{id}"
            method = "delete"
          }
        }
      }
      Project = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "projectKeys"
              fieldType = "List<string>"
            },
            {
              fieldName = "entityId"
              fieldType = "string"
            },
            {
              fieldName = "leadAccountId"
              fieldType = "string"
            },
            {
              fieldName = "components"
              fieldType = "list<ComponentWithIssueCount>"
            },
            {
              fieldName = "workflowScheme"
              fieldType = "WorkflowScheme"
            },
            {
              fieldName = "permissionScheme"
              fieldType = "PermissionScheme"
            },
            {
              fieldName = "notificationScheme"
              fieldType = "NotificationScheme"
            },
            {
              fieldName = "issueTypeScreenScheme"
              fieldType = "IssueTypeScreenScheme"
            },
            {
              fieldName = "fieldConfigurationScheme"
              fieldType = "FieldConfigurationScheme"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/project"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/project/{projectIdOrKey}"
            method = "put"
            urlParamsToFields = {
              projectIdOrKey = "id"
            }
          }
          remove = {
            url = "/rest/api/3/project/{projectIdOrKey}"
            method = "delete"
            urlParamsToFields = {
              projectIdOrKey = "id"
            }
          }
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
            {
              fieldName = "id"
            },
            {
              fieldName = "projectId"
            },
          ]
        }
      }
      NotificationScheme = {
        request = {
          url = "/rest/api/3/project/{projectId}/notificationscheme"
        }
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
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
      Screens = {
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
      Resolution = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
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
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          standaloneFields = [
            {
              fieldName = "tabs"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/screens"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/screens/{screenId}"
            method = "put"
            urlParamsToFields = {
              screenId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/screens/{screenId}"
            method = "delete"
            urlParamsToFields = {
              screenId = "id"
            }
          }
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
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/screens/{screenId}/tabs"
            method = "post"
            urlParamsToFields = {
              screenId = "_parent.0.id"
            }
          }
          modify = {
            url = "/rest/api/3/screens/{screenId}/tabs/{tabId}"
            method = "put"
            urlParamsToFields = {
              screenId = "_parent.0.id"
              tabId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/screens/{screenId}/tabs/{tabId}"
            method = "delete"
            urlParamsToFields = {
              screenId = "_parent.0.id"
              tabId = "id"
            }
          }
        }
      }
      ScreenSchemes = {
        request = {
          url = "/rest/api/3/screenscheme"
          paginationField = "startAt"
        }
      }
      Statuses = {
        transformation = {
          dataField = "."
        }
      }
      Workflows = {
        request = {
          url = "/rest/api/3/workflow/search"
          paginationField = "startAt"
          queryParams = {
            expand = "transitions,transitions.rules,statuses,statuses.properties"
          }
        }
      }
      WorkflowCondition = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "nodeType"
            },
          ]
        }
      }
      WorkflowStatus = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "name"
            },
          ]
        }
      }
      TransitionScreenDetails = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "name"
            },
          ]
        }
      }
      Transition = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      Workflow = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "name"
              fieldType = "string"
            },
            {
              fieldName = "entityId"
              fieldType = "string"
            },
          ]
          idFields = [
            "id.name",
          ]
          serviceIdField = "entityId"
          fieldsToHide = [
            {
              fieldName = "entityId"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "updated"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/workflow"
            method = "post"
          }
          remove = {
            url = "/rest/api/3/workflow/{entityId}"
            method = "delete"
          }
        }
      }
      WorkflowSchemes = {
        request = {
          url = "/rest/api/3/workflowscheme"
          paginationField = "startAt"
        }
      }
      SecurityScheme = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      StatusCategory = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      Status = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      WorkflowScheme = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/workflowscheme"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/workflowscheme/{id}"
            method = "put"
          }
          remove = {
            url = "/rest/api/3/workflowscheme/{id}"
            method = "delete"
          }
        }
      }
      IssueType = {
        request = {
          url = "/rest/api/3/issuetype"
        }
        transformation = {
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "untranslatedName"
              fieldType = "string"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "subtask"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/issuetype"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/issuetype/{id}"
            method = "put"
          }
          remove = {
            url = "/rest/api/3/issuetype/{id}"
            method = "delete"
          }
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
      Boards = {
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
              isSingle = true
            },
          ]
        }
      }
      Board = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "config"
              fieldType = "agile__1_0__board___boardId___configuration@uuvuuuu_00123_00125uu"
            },
            {
              fieldName = "filterId"
              fieldType = "string"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/agile/1.0/board"
            method = "post"
          }
          remove = {
            url = "/rest/agile/1.0/board/{boardId}"
            method = "delete"
            urlParamsToFields = {
              boardId = "id"
            }
          }
        }
      }
      IssueLinkType = {
        deployRequests = {
          add = {
            url = "/rest/api/3/issueLinkType"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/issueLinkType/{issueLinkTypeId}"
            method = "put"
            urlParamsToFields = {
              issueLinkTypeId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/issueLinkType/{issueLinkTypeId}"
            method = "delete"
            urlParamsToFields = {
              issueLinkTypeId = "id"
            }
          }
        }
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      ProjectRole = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/role"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/role/{id}"
            method = "put"
          }
          remove = {
            url = "/rest/api/3/role/{id}"
            method = "delete"
          }
        }
      }
      Priority = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      SharePermission = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      ScreenScheme = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/rest/api/3/screenscheme"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/screenscheme/{screenSchemeId}"
            method = "put"
            urlParamsToFields = {
              screenSchemeId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/screenscheme/{screenSchemeId}"
            method = "delete"
            urlParamsToFields = {
              screenSchemeId = "id"
            }
          }
        }
      }
      agile__1_0__board___boardId___configuration@uuvuuuu_00123_00125uu = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "id"
            },
          ]
        }
        request = {
          url = "/rest/agile/1.0/board/{boardId}/configuration"
        }
      }
    }
  }
}
```
