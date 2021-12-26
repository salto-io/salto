# JIRA system configuration
## Default Configuration
```hcl
jira {
  fetch = {
    includeTypes = [
      "rest__api__3__application_properties@uuuuuub",
      "rest__api__3__applicationrole",
      "AttachmentSettings",
      "Configuration",
      "rest__api__3__configuration__timetracking__list",
      "PageBeanDashboard",
      "PageBeanField",
      "PageBeanFieldConfigurationDetails",
      "PageBeanFieldConfigurationScheme",
      "PageBeanFieldConfigurationIssueTypeItem",
      "PageBeanFilterDetails",
      "IssueTypeDetails",
      "IssueLinkTypes",
      "SecuritySchemes",
      "PageBeanIssueTypeScheme",
      "PageBeanIssueTypeSchemeMapping",
      "PageBeanIssueTypeScreenScheme",
      "PageBeanIssueTypeScreenSchemeItem",
      "PageBeanNotificationScheme",
      "Permissions",
      "PermissionSchemes",
      "rest__api__3__priority",
      "rest__api__3__projectCategory",
      "PageBeanProject",
      "rest__api__3__project__type",
      "rest__api__3__resolution",
      "rest__api__3__role",
      "PageBeanScreen",
      "PageBeanScreenScheme",
      "rest__api__3__status",
      "rest__api__3__statuscategory",
      "PageBeanWorkflow",
      "PageBeanWorkflowScheme",
      "ServerInformation",
      "agile__1_0__board@uuvuu",
    ]
  }
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
      CustomFieldContext = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "options"
              fieldType = "list<CustomFieldContextOption>"
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
          fieldsToHide = [
            {
              fieldName = "id"
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
          fieldsToHide = [
            {
              fieldName = "id"
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
              fieldName = "issueTypes"
              fieldType = "list<IssueTypeSchemeMapping>"
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
            url = "/rest/api/3/issuetypescheme"
            method = "post"
          }
          modify = {
            url = "/rest/api/3/issuetypescheme/{issueTypeSchemeId}"
            method = "put"
            urlParamsToFields = {
              issueTypeSchemeId = "id"
            }
          }
          remove = {
            url = "/rest/api/3/issuetypescheme/{issueTypeSchemeId}"
            method = "delete"
            urlParamsToFields = {
              issueTypeSchemeId = "id"
            }
          }
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
          idFields = [
            "id.name",
          ]
          serviceIdField = "entityId"
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
      PageBeanWorkflowScheme = {
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
      StatusDetails = {
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
      IssueTypeDetails = {
        request = {
          url = "/rest/api/3/issuetype"
        }
        transformation = {
          dataField = "."
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
