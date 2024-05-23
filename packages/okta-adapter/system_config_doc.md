# Okta system configuration

## Default Configuration

```hcl
okta {
  apiDefinitions = {
    swagger = {
      url = "https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/okta/management-swagger-v3.yaml"
      additionalTypes = [
        {
          typeName = "AccessPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "IdentityProviderPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "MultifactorEnrollmentPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "OktaSignOnPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "PasswordPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "ProfileEnrollmentPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "Automations"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "AccessPolicyRules"
          cloneFrom = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
        },
        {
          typeName = "IdentityProviderPolicyRules"
          cloneFrom = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
        },
        {
          typeName = "MultifactorEnrollmentPolicyRules"
          cloneFrom = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
        },
        {
          typeName = "OktaSignOnPolicyRules"
          cloneFrom = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
        },
        {
          typeName = "PasswordPolicyRules"
          cloneFrom = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
        },
        {
          typeName = "ProfileEnrollmentPolicyRules"
          cloneFrom = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
        },
        {
          typeName = "AutomationRules"
          cloneFrom = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
        },
        {
          typeName = "IdentityProviderPolicyRule"
          cloneFrom = "PolicyRule"
        },
        {
          typeName = "MultifactorEnrollmentPolicyRule"
          cloneFrom = "PolicyRule"
        },
        {
          typeName = "Automation"
          cloneFrom = "AccessPolicy"
        },
        {
          typeName = "AutomationRule"
          cloneFrom = "PolicyRule"
        },
        {
          typeName = "AppUserSchema"
          cloneFrom = "UserSchema"
        },
        {
          typeName = "Group__source"
          cloneFrom = "AppAndInstanceConditionEvaluatorAppOrInstance"
        },
        {
          typeName = "DeviceCondition"
          cloneFrom = "PolicyNetworkCondition"
        },
      ]
      typeNameOverrides = [
        {
          originalName = "DomainResponse"
          newName = "Domain"
        },
        {
          originalName = "EmailDomainResponse"
          newName = "EmailDomain"
        },
        {
          originalName = "ThemeResponse"
          newName = "BrandTheme"
        },
        {
          originalName = "IamRole"
          newName = "Role"
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
            fieldName = "created"
          },
          {
            fieldName = "lastUpdated"
          },
          {
            fieldName = "createdBy"
          },
          {
            fieldName = "lastUpdatedBy"
          },
        ]
        nestStandaloneInstances = true
      }
    }
    types = {
      api__v1__groups = {
        request = {
          url = "/api/v1/groups"
        }
      }
      Group = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "source"
              fieldType = "Group__source"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "lastMembershipUpdated"
            },
            {
              fieldName = "_links"
            },
          ]
          idFields = [
            "profile.name",
          ]
          serviceIdField = "id"
          serviceUrl = "/admin/group/{id}"
          nestStandaloneInstances = false
        }
        deployRequests = {
          add = {
            url = "/api/v1/groups"
            method = "post"
          }
          modify = {
            url = "/api/v1/groups/{groupId}"
            method = "put"
            urlParamsToFields = {
              groupId = "id"
            }
          }
          remove = {
            url = "/api/v1/groups/{groupId}"
            method = "delete"
            urlParamsToFields = {
              groupId = "id"
            }
            omitRequestBody = true
          }
        }
      }
      Role = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "targetGroups"
              fieldType = "list<Group>"
            },
          ]
          idFields = [
            "label",
          ]
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      api__v1__apps = {
        request = {
          url = "/api/v1/apps"
          queryParams = {
            limit = "200"
          }
          recurseInto = [
            {
              type = "api__v1__apps___appId___groups@uuuuuu_00123_00125uu"
              toField = "Groups"
              context = [
                {
                  name = "appId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "AppUserSchema"
              toField = "appUserSchema"
              context = [
                {
                  name = "appId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      Application = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "name"
              fieldType = "string"
            },
            {
              fieldName = "customName"
              fieldType = "string"
            },
            {
              fieldName = "credentials"
              fieldType = "ApplicationCredentials"
            },
            {
              fieldName = "settings"
              fieldType = "unknown"
            },
            {
              fieldName = "Groups"
              fieldType = "list<ApplicationGroupAssignment>"
            },
            {
              fieldName = "profileEnrollment"
              fieldType = "string"
            },
            {
              fieldName = "accessPolicy"
              fieldType = "string"
            },
            {
              fieldName = "appUserSchema"
              fieldType = "list<AppUserSchema>"
            },
          ]
          idFields = [
            "label",
          ]
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "customName"
            },
            {
              fieldName = "id"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_embedded"
            },
          ]
          serviceUrl = "/admin/app/{name}/instance/{id}/#tab-general"
          standaloneFields = [
            {
              fieldName = "appUserSchema"
            },
            {
              fieldName = "Groups"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/api/v1/apps"
            method = "post"
          }
          modify = {
            url = "/api/v1/apps/{applicationId}"
            method = "put"
            urlParamsToFields = {
              applicationId = "id"
            }
          }
          remove = {
            url = "/api/v1/apps/{applicationId}"
            method = "delete"
            urlParamsToFields = {
              applicationId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/apps/{applicationId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              applicationId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/apps/{applicationId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              applicationId = "id"
            }
          }
        }
      }
      api__v1__apps___appId___groups@uuuuuu_00123_00125uu = {
        request = {
          url = "api/v1/apps/{appId}/groups"
          queryParams = {
            limit = "200"
          }
        }
      }
      ApplicationGroupAssignment = {
        transformation = {
          idFields = [
            "&id",
          ]
          extendsParentId = true
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/api/v1/apps/{appId}/groups/{groupId}"
            method = "put"
            urlParamsToFields = {
              appId = "_parent.0.id"
              groupId = "id"
            }
          }
          modify = {
            url = "/api/v1/apps/{appId}/groups/{groupId}"
            method = "put"
            urlParamsToFields = {
              appId = "_parent.0.id"
              groupId = "id"
            }
          }
          remove = {
            url = "/api/v1/apps/{appId}/groups/{groupId}"
            method = "delete"
            urlParamsToFields = {
              appId = "_parent.0.id"
              groupId = "id"
            }
            omitRequestBody = true
          }
        }
      }
      AppUserSchema = {
        request = {
          url = "/api/v1/meta/schemas/apps/{appId}/default"
        }
        transformation = {
          idFields = [
          ]
          extendsParentId = true
          dataField = "."
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "$schema"
            },
            {
              fieldName = "type"
            },
            {
              fieldName = "properties"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
            {
              fieldName = "name"
            },
          ]
        }
        deployRequests = {
          modify = {
            url = "/api/v1/meta/schemas/apps/{applicationId}/default"
            method = "post"
            urlParamsToFields = {
              applicationId = "_parent.0.id"
            }
          }
        }
      }
      UserSchemaPublic = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "properties"
              fieldType = "Map<okta.UserSchemaAttribute>"
            },
          ]
        }
      }
      GroupSchemaCustom = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "properties"
              fieldType = "Map<okta.GroupSchemaAttribute>"
            },
          ]
        }
      }
      AppLogo = {
        deployRequests = {
          add = {
            url = "/api/v1/apps/{appId}/logo"
            method = "post"
            urlParamsToFields = {
              appId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/apps/{appId}/logo"
            method = "post"
            urlParamsToFields = {
              appId = "_parent.0.id"
            }
          }
        }
      }
      ApplicationCredentials = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "oauthClient"
              fieldType = "ApplicationCredentialsOAuthClient"
            },
            {
              fieldName = "password"
              fieldType = "PasswordCredential"
            },
            {
              fieldName = "revealPassword"
              fieldType = "boolean"
            },
            {
              fieldName = "scheme"
              fieldType = "string"
            },
            {
              fieldName = "userName"
              fieldType = "string"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "signing"
              fieldType = "ApplicationCredentialsSigning"
            },
          ]
        }
      }
      ApplicationVisibility = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "appLinks"
            },
          ]
        }
      }
      api__v1__meta__types__user = {
        transformation = {
          dataField = "."
        }
      }
      api__v1__idps = {
        request = {
          url = "/api/v1/idps"
          recurseInto = [
            {
              type = "api__v1__idps___idpId___credentials__csrs@uuuuuu_00123_00125uuuu"
              toField = "CSRs"
              context = [
                {
                  name = "idpId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      IdentityProvider = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "CSRs"
              fieldType = "list<Csr>"
            },
          ]
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          serviceUrl = "/admin/access/identity-providers/edit/{id}"
        }
      }
      Feature = {
        transformation = {
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      UserSchema = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "description"
              fieldType = "string"
            },
            {
              fieldName = "userType"
              fieldType = "string"
            },
          ]
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
            {
              fieldName = "$schema"
            },
            {
              fieldName = "type"
            },
            {
              fieldName = "title"
            },
            {
              fieldName = "description"
            },
            {
              fieldName = "properties"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
            {
              fieldName = "name"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/api/v1/meta/schemas/user/{schemaId}"
            method = "post"
            urlParamsToFields = {
              schemaId = "id"
            }
            fieldsToIgnore = [
              "id",
              "name",
            ]
          }
          modify = {
            url = "/api/v1/meta/schemas/user/{schemaId}"
            method = "post"
            urlParamsToFields = {
              schemaId = "id"
            }
            fieldsToIgnore = [
              "id",
              "name",
            ]
          }
          remove = {
            url = "/api/v1/meta/types/user/{typeId}"
            method = "delete"
            urlParamsToFields = {
              typeId = "_parent.0.id"
            }
            omitRequestBody = true
          }
        }
      }
      OrgContactTypeObj = {
        transformation = {
          idFields = [
            "contactType",
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
        }
      }
      api__v1__templates__sms = {
        transformation = {
          dataField = "."
        }
      }
      api__v1__authorizationServers = {
        request = {
          url = "/api/v1/authorizationServers"
          recurseInto = [
            {
              type = "api__v1__authorizationServers___authServerId___scopes@uuuuuu_00123_00125uu"
              toField = "scopes"
              context = [
                {
                  name = "authServerId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "api__v1__authorizationServers___authServerId___claims@uuuuuu_00123_00125uu"
              toField = "claims"
              context = [
                {
                  name = "authServerId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu"
              toField = "policies"
              context = [
                {
                  name = "authServerId"
                  fromField = "id"
                },
              ]
            },
            {
              type = "api__v1__authorizationServers___authServerId___clients@uuuuuu_00123_00125uu"
              toField = "clients"
              context = [
                {
                  name = "authServerId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu = {
        request = {
          url = "/api/v1/authorizationServers/{authServerId}/policies"
          recurseInto = [
            {
              type = "api__v1__authorizationServers___authServerId___policies___policyId___rules@uuuuuu_00123_00125uuuu_00123_00125uu"
              toField = "policyRules"
              context = [
                {
                  name = "policyId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      AuthorizationServer = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "scopes"
              fieldType = "list<OAuth2Scope>"
            },
            {
              fieldName = "claims"
              fieldType = "list<OAuth2Claim>"
            },
            {
              fieldName = "policies"
              fieldType = "list<AuthorizationServerPolicy>"
            },
            {
              fieldName = "clients"
              fieldType = "list<OAuth2Client>"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
            {
              fieldName = "issuer"
            },
          ]
          serviceIdField = "id"
          standaloneFields = [
            {
              fieldName = "policies"
            },
            {
              fieldName = "scopes"
            },
            {
              fieldName = "claims"
            },
          ]
          serviceUrl = "/admin/oauth2/as/{id}"
        }
      }
      AuthorizationServerCredentialsSigningConfig = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "kid"
            },
            {
              fieldName = "lastRotated"
            },
            {
              fieldName = "nextRotation"
            },
          ]
        }
      }
      AuthorizationServerPolicy = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<AuthorizationServerPolicyRule>"
            },
          ]
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies"
            method = "post"
            urlParamsToFields = {
              authorizationServerId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}"
            method = "put"
            urlParamsToFields = {
              authorizationServerId = "_parent.0.id"
              policyId = "id"
            }
          }
          remove = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}"
            method = "delete"
            urlParamsToFields = {
              authorizationServerId = "_parent.0.id"
              policyId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              authorizationServerId = "_parent.0.id"
              policyId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              authorizationServerId = "_parent.0.id"
              policyId = "id"
            }
          }
        }
      }
      AuthorizationServerPolicyRule = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules"
            method = "post"
            urlParamsToFields = {
              authorizationServerId = "_parent.1.id"
              policyId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              authorizationServerId = "_parent.1.id"
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          remove = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              authorizationServerId = "_parent.1.id"
              policyId = "_parent.0.id"
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              authorizationServerId = "_parent.1.id"
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/authorizationServers/{authorizationServerId}/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              authorizationServerId = "_parent.1.id"
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
        }
      }
      api__v1__brands = {
        request = {
          url = "/api/v1/brands"
          recurseInto = [
            {
              type = "api__v1__brands___brandId___themes@uuuuuu_00123_00125uu"
              toField = "theme"
              context = [
                {
                  name = "brandId"
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
      api__v1__brands___brandId___themes@uuuuuu_00123_00125uu = {
        request = {
          url = "/api/v1/brands/{brandId}/themes"
        }
        transformation = {
          dataField = "."
        }
      }
      GroupSchema = {
        transformation = {
          idFields = [
            "title",
          ]
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
            {
              fieldName = "$schema"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          modify = {
            url = "/api/v1/meta/schemas/group/default"
            method = "post"
          }
        }
      }
      Domain = {
        transformation = {
          idFields = [
            "domain",
          ]
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
        }
      }
      api__v1__email_domains@uuuub = {
        request = {
          url = "/api/v1/email-domains"
        }
        transformation = {
          dataField = "."
        }
      }
      EmailDomain = {
        transformation = {
          idFields = [
            "displayName",
          ]
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      OrgSetting = {
        request = {
          url = "/api/v1/org"
          recurseInto = [
            {
              type = "api__v1__org__contacts"
              toField = "contactTypes"
              context = [
              ]
            },
          ]
        }
        transformation = {
          isSingleton = true
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "contactTypes"
              fieldType = "list<OrgContactTypeObj>"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/settings/account"
        }
        deployRequests = {
          modify = {
            url = "/api/v1/org"
            method = "put"
            fieldsToIgnore = [
              "contactTypes",
            ]
          }
        }
      }
      api__v1__org__contacts = {
        request = {
          url = "/api/v1/org/contacts"
        }
        transformation = {
          dataField = "."
        }
      }
      Brand = {
        transformation = {
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          standaloneFields = [
            {
              fieldName = "theme"
            },
          ]
          nestStandaloneInstances = false
          fieldTypeOverrides = [
            {
              fieldName = "theme"
              fieldType = "list<BrandTheme>"
            },
          ]
          serviceUrl = "/admin/customizations/footer"
        }
        deployRequests = {
          modify = {
            url = "/api/v1/brands/{brandId}"
            method = "put"
            urlParamsToFields = {
              brandId = "id"
            }
          }
        }
      }
      BrandTheme = {
        transformation = {
          idFields = [
          ]
          extendsParentId = true
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
            {
              fieldName = "_links"
            },
            {
              fieldName = "logo"
            },
            {
              fieldName = "favicon"
            },
          ]
          serviceUrl = "/admin/customizations/branding"
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "map<unknown>"
            },
          ]
        }
        deployRequests = {
          modify = {
            url = "/api/v1/brands/{brandId}/themes/{themeId}"
            method = "put"
            urlParamsToFields = {
              brandId = "_parent.0.id"
              themeId = "id"
            }
            fieldsToIgnore = [
              "id",
              "logo",
              "favicon",
              "_links",
            ]
          }
        }
      }
      BrandLogo = {
        deployRequests = {
          add = {
            url = "/api/v1/brands/{brandId}/themes/{themeId}/logo"
            method = "post"
            urlParamsToFields = {
              themeId = "_parent.0.id"
              brandId = "_parent.1.id"
            }
          }
          modify = {
            url = "/api/v1/brands/{brandId}/themes/{themeId}/logo"
            method = "post"
            urlParamsToFields = {
              themeId = "_parent.0.id"
              brandId = "_parent.1.id"
            }
          }
          remove = {
            url = "/api/v1/brands/{brandId}/themes/{themeId}/logo"
            method = "delete"
            urlParamsToFields = {
              themeId = "_parent.0.id"
              brandId = "_parent.1.id"
            }
            omitRequestBody = true
          }
        }
      }
      FavIcon = {
        deployRequests = {
          add = {
            url = "/api/v1/brands/{brandId}/themes/{themeId}/favicon"
            method = "post"
            urlParamsToFields = {
              themeId = "_parent.0.id"
              brandId = "_parent.1.id"
            }
          }
          modify = {
            url = "/api/v1/brands/{brandId}/themes/{themeId}/favicon"
            method = "post"
            urlParamsToFields = {
              themeId = "_parent.0.id"
              brandId = "_parent.1.id"
            }
          }
          remove = {
            url = "/api/v1/brands/{brandId}/themes/{themeId}/favicon"
            method = "delete"
            urlParamsToFields = {
              themeId = "_parent.0.id"
              brandId = "_parent.1.id"
            }
            omitRequestBody = true
          }
        }
      }
      Authenticator = {
        transformation = {
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          serviceUrl = "/admin/access/multifactor#policies"
        }
        deployRequests = {
          add = {
            url = "/api/v1/authenticators"
            method = "post"
          }
          modify = {
            url = "/api/v1/authenticators/{authenticatorId}"
            method = "put"
            urlParamsToFields = {
              authenticatorId = "id"
            }
          }
          activate = {
            url = "/api/v1/authenticators/{authenticatorId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              authenticatorId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/authenticators/{authenticatorId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              authenticatorId = "id"
            }
          }
        }
      }
      EventHook = {
        transformation = {
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          serviceUrl = "/admin/workflow/eventhooks"
        }
      }
      api__v1__groups__rules = {
        request = {
          url = "/api/v1/groups/rules"
          queryParams = {
            limit = "200"
          }
        }
      }
      GroupRule = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "allGroupsValid"
              fieldType = "boolean"
            },
          ]
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          serviceUrl = "/admin/groups#rules"
        }
        deployRequests = {
          add = {
            url = "/api/v1/groups/rules"
            method = "post"
            fieldsToIgnore = [
              "status",
              "allGroupsValid",
            ]
          }
          modify = {
            url = "/api/v1/groups/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              ruleId = "id"
            }
            fieldsToIgnore = [
              "status",
              "allGroupsValid",
            ]
          }
          remove = {
            url = "/api/v1/groups/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/groups/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/groups/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              ruleId = "id"
            }
          }
        }
      }
      InlineHook = {
        transformation = {
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          serviceUrl = "/admin/workflow/inlinehooks#view/{id}"
        }
      }
      NetworkZone = {
        transformation = {
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          serviceUrl = "/admin/access/networks"
        }
        deployRequests = {
          add = {
            url = "/api/v1/zones"
            method = "post"
          }
          modify = {
            url = "/api/v1/zones/{zoneId}"
            method = "put"
            urlParamsToFields = {
              zoneId = "id"
            }
          }
          remove = {
            url = "/api/v1/zones/{zoneId}"
            method = "delete"
            urlParamsToFields = {
              zoneId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/zones/{zoneId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              zoneId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/zones/{zoneId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              zoneId = "id"
            }
          }
        }
      }
      TrustedOrigin = {
        transformation = {
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          serviceUrl = "/admin/access/api/trusted_origins"
        }
        deployRequests = {
          add = {
            url = "/api/v1/trustedOrigins"
            method = "post"
          }
          modify = {
            url = "/api/v1/trustedOrigins/{trustedOriginId}"
            method = "put"
            urlParamsToFields = {
              trustedOriginId = "id"
            }
          }
          remove = {
            url = "/api/v1/trustedOrigins/{trustedOriginId}"
            method = "delete"
            urlParamsToFields = {
              trustedOriginId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/trustedOrigins/{trustedOriginId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              trustedOriginId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/trustedOrigins/{trustedOriginId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              trustedOriginId = "id"
            }
          }
        }
      }
      UserType = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "admin/universaldirectory#okta/{id}"
        }
        deployRequests = {
          add = {
            url = "/api/v1/meta/types/user"
            method = "post"
          }
          modify = {
            url = "/api/v1/meta/types/user/{typeId}"
            method = "put"
            urlParamsToFields = {
              typeId = "id"
            }
          }
          remove = {
            url = "/api/v1/meta/types/user/{typeId}"
            method = "delete"
            urlParamsToFields = {
              typeId = "id"
            }
            omitRequestBody = true
          }
        }
      }
      GroupSchemaAttribute = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "scope"
              fieldType = "string"
            },
          ]
        }
      }
      UserSchemaAttribute = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "scope"
              fieldType = "string"
            },
          ]
        }
      }
      IamRoles = {
        request = {
          url = "/api/v1/iam/roles"
        }
        transformation = {
          dataField = "roles"
        }
      }
      SmsTemplate = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
          ]
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/api/v1/templates/sms"
            method = "post"
          }
          modify = {
            url = "/api/v1/templates/sms/{templateId}"
            method = "put"
            urlParamsToFields = {
              templateId = "id"
            }
          }
          remove = {
            url = "/api/v1/templates/sms/{templateId}"
            urlParamsToFields = {
              templateId = "id"
            }
            method = "delete"
          }
        }
      }
      Protocol = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "credentials"
            },
          ]
        }
      }
      AuthenticatorProviderConfiguration = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "secretKey"
            },
            {
              fieldName = "sharedSecret"
            },
          ]
        }
      }
      OAuth2Scope = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "map<unknown>"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "_links"
            },
          ]
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      OAuth2Claim = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "_links"
            },
          ]
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      ProfileMapping = {
        transformation = {
          idFields = [
            "&source.id",
            "&target.id",
          ]
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
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
            url = "/api/v1/mappings/{mappingId}"
            method = "post"
            urlParamsToFields = {
              mappingId = "id"
            }
          }
          modify = {
            url = "/api/v1/mappings/{mappingId}"
            method = "post"
            urlParamsToFields = {
              mappingId = "id"
            }
          }
        }
      }
      ProfileMappingSource = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
        }
      }
      ApplicationLinks = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "profileEnrollment"
              fieldType = "HrefObject"
            },
          ]
        }
      }
      AccessPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "ACCESS_POLICY"
          }
          recurseInto = [
            {
              type = "AccessPolicyRules"
              toField = "policyRules"
              context = [
                {
                  name = "policyId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<AccessPolicy>"
            },
          ]
        }
      }
      AccessPolicyRules = {
        request = {
          url = "/api/v1/policies/{policyId}/rules"
        }
        transformation = {
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<AccessPolicyRule>"
            },
          ]
        }
      }
      AccessPolicy = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
            {
              fieldName = "priority"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<AccessPolicyRule>"
            },
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
            },
          ]
          serviceUrl = "/admin/authn/authentication-policies#authentication-policies/policy/{id}/"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies"
            method = "post"
          }
          modify = {
            url = "/api/v1/policies/{policyId}"
            method = "put"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
        }
      }
      AccessPolicyRule = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/authn/authentication-policies#authentication-policies/policy/{id}/"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies/{policyId}/rules"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
        }
      }
      IdentityProviderPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "IDP_DISCOVERY"
          }
          recurseInto = [
            {
              type = "IdentityProviderPolicyRules"
              toField = "policyRules"
              context = [
                {
                  name = "policyId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<IdentityProviderPolicy>"
            },
          ]
        }
      }
      IdentityProviderPolicyRules = {
        request = {
          url = "/api/v1/policies/{policyId}/rules"
        }
        transformation = {
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<IdentityProviderPolicyRule>"
            },
          ]
        }
      }
      IdentityProviderPolicy = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
            {
              fieldName = "priority"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<IdentityProviderPolicyRule>"
            },
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
            },
          ]
          serviceUrl = "/admin/access/identity-providers#"
        }
      }
      IdentityProviderPolicyRule = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
            {
              fieldName = "actions"
              fieldType = "PolicyRuleActions"
            },
            {
              fieldName = "conditions"
              fieldType = "PolicyRuleConditions"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/access/identity-providers#rules"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies/{policyId}/rules"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
        }
      }
      MultifactorEnrollmentPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "MFA_ENROLL"
          }
          recurseInto = [
            {
              type = "MultifactorEnrollmentPolicyRules"
              toField = "policyRules"
              context = [
                {
                  name = "policyId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<MultifactorEnrollmentPolicy>"
            },
          ]
        }
      }
      MultifactorEnrollmentPolicyRules = {
        request = {
          url = "/api/v1/policies/{policyId}/rules"
        }
        transformation = {
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<MultifactorEnrollmentPolicyRule>"
            },
          ]
        }
      }
      MultifactorEnrollmentPolicy = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<MultifactorEnrollmentPolicyRule>"
            },
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
            },
          ]
          serviceUrl = "/admin/access/multifactor#policies"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies"
            method = "post"
          }
          modify = {
            url = "/api/v1/policies/{policyId}"
            method = "put"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
        }
      }
      MultifactorEnrollmentPolicyRule = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
            {
              fieldName = "actions"
              fieldType = "PolicyRuleActions"
            },
            {
              fieldName = "conditions"
              fieldType = "PolicyRuleConditions"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/access/multifactor#policies"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies/{policyId}/rules"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
        }
      }
      OktaSignOnPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "OKTA_SIGN_ON"
          }
          recurseInto = [
            {
              type = "OktaSignOnPolicyRules"
              toField = "policyRules"
              context = [
                {
                  name = "policyId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<OktaSignOnPolicy>"
            },
          ]
        }
      }
      OktaSignOnPolicyRules = {
        request = {
          url = "/api/v1/policies/{policyId}/rules"
        }
        transformation = {
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<OktaSignOnPolicyRule>"
            },
          ]
        }
      }
      OktaSignOnPolicy = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<OktaSignOnPolicyRule>"
            },
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
            },
          ]
          serviceUrl = "/admin/access/policies"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies"
            method = "post"
          }
          modify = {
            url = "/api/v1/policies/{policyId}"
            method = "put"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
        }
      }
      OktaSignOnPolicyRule = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/access/policies"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies/{policyId}/rules"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
        }
      }
      PasswordPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "PASSWORD"
          }
          recurseInto = [
            {
              type = "PasswordPolicyRules"
              toField = "policyRules"
              context = [
                {
                  name = "policyId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<PasswordPolicy>"
            },
          ]
        }
      }
      PasswordPolicyRules = {
        request = {
          url = "/api/v1/policies/{policyId}/rules"
        }
        transformation = {
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<PasswordPolicyRule>"
            },
          ]
        }
      }
      PasswordPolicy = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<PasswordPolicyRule>"
            },
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
            },
          ]
          serviceUrl = "/admin/access/authenticators/password"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies"
            method = "post"
          }
          modify = {
            url = "/api/v1/policies/{policyId}"
            method = "put"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
        }
      }
      PasswordPolicyRule = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/access/authenticators/password"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies/{policyId}/rules"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
        }
      }
      ProfileEnrollmentPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "PROFILE_ENROLLMENT"
          }
          recurseInto = [
            {
              type = "ProfileEnrollmentPolicyRules"
              toField = "policyRules"
              context = [
                {
                  name = "policyId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<ProfileEnrollmentPolicy>"
            },
          ]
        }
      }
      ProfileEnrollmentPolicyRules = {
        request = {
          url = "/api/v1/policies/{policyId}/rules"
        }
        transformation = {
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<ProfileEnrollmentPolicyRule>"
            },
          ]
        }
      }
      ProfileEnrollmentPolicy = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
            {
              fieldName = "priority"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<ProfileEnrollmentPolicyRule>"
            },
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
            },
          ]
          serviceUrl = "/admin/authn/policies"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies"
            method = "post"
          }
          modify = {
            url = "/api/v1/policies/{policyId}"
            method = "put"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
        }
      }
      ProfileEnrollmentPolicyRule = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/authn/policies"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies/{policyId}/rules"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
        }
      }
      Automations = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "USER_LIFECYCLE"
          }
          recurseInto = [
            {
              type = "AutomationRules"
              toField = "policyRules"
              context = [
                {
                  name = "policyId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<Automation>"
            },
          ]
        }
      }
      AutomationRules = {
        request = {
          url = "/api/v1/policies/{policyId}/rules"
        }
        transformation = {
          dataField = "."
          fieldTypeOverrides = [
            {
              fieldName = "items"
              fieldType = "list<AutomationRule>"
            },
          ]
        }
      }
      Automation = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<AutomationRule>"
            },
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
            },
          ]
          serviceUrl = "/admin/lifecycle-automation#tab-policy/{id}"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies?activate=false"
            method = "post"
          }
          modify = {
            url = "/api/v1/policies/{policyId}"
            method = "put"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "id"
            }
          }
        }
      }
      AutomationRule = {
        transformation = {
          serviceIdField = "id"
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/lifecycle-automation#tab-policy/{id}"
        }
        deployRequests = {
          add = {
            url = "/api/v1/policies/{policyId}/rules"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          remove = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/policies/{policyId}/rules/{ruleId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              policyId = "_parent.0.id"
              ruleId = "id"
            }
          }
        }
      }
      api__v1__behaviors = {
        request = {
          url = "/api/v1/behaviors"
        }
        transformation = {
          dataField = "."
        }
      }
      BehaviorRule = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          serviceIdField = "id"
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "LinksSelf"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          serviceUrl = "/admin/access/behaviors"
        }
        deployRequests = {
          add = {
            url = "/api/v1/behaviors"
            method = "post"
          }
          modify = {
            url = "/api/v1/behaviors/{behaviorId}"
            method = "put"
            urlParamsToFields = {
              behaviorId = "id"
            }
          }
          remove = {
            url = "/api/v1/behaviors/{behaviorId}"
            method = "delete"
            urlParamsToFields = {
              behaviorId = "id"
            }
            omitRequestBody = true
          }
          activate = {
            url = "/api/v1/behaviors/{behaviorId}/lifecycle/activate"
            method = "post"
            urlParamsToFields = {
              behaviorId = "id"
            }
          }
          deactivate = {
            url = "/api/v1/behaviors/{behaviorId}/lifecycle/deactivate"
            method = "post"
            urlParamsToFields = {
              behaviorId = "id"
            }
          }
        }
      }
      PerClientRateLimitSettings = {
        request = {
          url = "/api/v1/rate-limit-settings/per-client"
        }
        transformation = {
          isSingleton = true
          dataField = "."
          serviceUrl = "/admin/settings/account"
        }
        deployRequests = {
          modify = {
            url = "/api/v1/rate-limit-settings/per-client"
            method = "put"
          }
        }
      }
      RateLimitAdminNotifications = {
        request = {
          url = "/api/v1/rate-limit-settings/admin-notifications"
        }
        transformation = {
          isSingleton = true
          serviceUrl = "/admin/settings/account"
        }
        deployRequests = {
          modify = {
            url = "/api/v1/rate-limit-settings/admin-notifications"
            method = "put"
          }
        }
      }
      ProfileEnrollmentPolicyRuleProfileAttribute = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "name"
              fieldType = "UserSchemaAttribute"
            },
          ]
        }
      }
      ResourceSets = {
        request = {
          url = "/api/v1/iam/resource-sets"
        }
        transformation = {
          dataField = "resource-sets"
        }
      }
      ResourceSetResources = {
        request = {
          url = "/api/v1/iam/resource-sets/{resourceSetId}/resources"
        }
        transformation = {
          dataField = "resources"
        }
      }
      ResourceSet = {
        transformation = {
          idFields = [
            "label",
          ]
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "_links"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      ProfileEnrollmentPolicyRuleAction = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "uiSchemaId"
              fieldType = "string"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "uiSchemaId"
            },
          ]
        }
      }
      DevicePolicyRuleCondition = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "registered"
              fieldType = "boolean"
            },
            {
              fieldName = "managed"
              fieldType = "boolean"
            },
            {
              fieldName = "assurance"
              fieldType = "DeviceCondition"
            },
          ]
        }
      }
      DeviceAssurance = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "lastUpdate"
              fieldType = "string"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created"
            },
            {
              fieldName = "lastUpdated"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "lastUpdatedBy"
            },
            {
              fieldName = "createdDate"
            },
            {
              fieldName = "lastUpdate"
            },
            {
              fieldName = "_links"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/api/v1/device-assurances"
            method = "post"
          }
          modify = {
            url = "/api/v1/device-assurances/{deviceAssuranceId}"
            method = "put"
            urlParamsToFields = {
              deviceAssuranceId = "id"
            }
          }
          remove = {
            url = "/api/v1/device-assurances/{deviceAssuranceId}"
            method = "delete"
            urlParamsToFields = {
              deviceAssuranceId = "id"
            }
            omitRequestBody = true
          }
        }
      }
    }
    supportedTypes = {
      Application = [
        "api__v1__apps",
      ]
      Authenticator = [
        "api__v1__authenticators",
      ]
      AuthorizationServer = [
        "api__v1__authorizationServers",
      ]
      AuthorizationServerPolicy = [
        "api__v1__authorizationServers___authServerId___policies@uuuuuu_00123_00125uu",
      ]
      Brand = [
        "api__v1__brands",
      ]
      BrandTheme = [
        "api__v1__brands___brandId___themes@uuuuuu_00123_00125uu",
      ]
      EventHook = [
        "api__v1__eventHooks",
      ]
      Feature = [
        "api__v1__features",
      ]
      Group = [
        "api__v1__groups",
      ]
      GroupRule = [
        "api__v1__groups__rules",
      ]
      IdentityProvider = [
        "api__v1__idps",
      ]
      InlineHook = [
        "api__v1__inlineHooks",
      ]
      ProfileMapping = [
        "api__v1__mappings",
      ]
      LinkedObjectDefinitions = [
        "api__v1__meta__schemas__user__linkedObjects",
      ]
      GroupSchema = [
        "GroupSchema",
      ]
      UserSchema = [
        "UserSchema",
      ]
      UserType = [
        "api__v1__meta__types__user",
      ]
      OrgSettings = [
        "OrgSetting",
      ]
      AccessPolicy = [
        "AccessPolicies",
      ]
      IdentityProviderPolicy = [
        "IdentityProviderPolicies",
      ]
      MultifactorEnrollmentPolicy = [
        "MultifactorEnrollmentPolicies",
      ]
      OktaSignOnPolicy = [
        "OktaSignOnPolicies",
      ]
      PasswordPolicy = [
        "PasswordPolicies",
      ]
      ProfileEnrollmentPolicy = [
        "ProfileEnrollmentPolicies",
      ]
      Automation = [
        "Automations",
      ]
      SmsTemplate = [
        "api__v1__templates__sms",
      ]
      TrustedOrigin = [
        "api__v1__trustedOrigins",
      ]
      NetworkZone = [
        "api__v1__zones",
      ]
      Domain = [
        "DomainListResponse",
      ]
      EmailDomain = [
        "api__v1__email_domains@uuuub",
      ]
      Role = [
        "IamRoles",
      ]
      BehaviorRule = [
        "api__v1__behaviors",
      ]
      PerClientRateLimit = [
        "PerClientRateLimitSettings",
      ]
      RateLimitAdmin = [
        "RateLimitAdminNotifications",
      ]
      ResourceSet = [
        "ResourceSets",
      ]
      DeviceAssurance = [
        "api__v1__device_assurances@uuuub",
      ]
    }
  }
  privateApiDefinitions = {
    typeDefaults = {
      transformation = {
        idFields = [
          "name",
        ]
        fieldsToOmit = [
          {
            fieldName = "created"
          },
          {
            fieldName = "lastUpdated"
          },
          {
            fieldName = "createdBy"
          },
          {
            fieldName = "lastUpdatedBy"
          },
        ]
        nestStandaloneInstances = true
      }
    }
    types = {
      EmailNotifications = {
        request = {
          url = "/api/internal/email-notifications"
        }
        transformation = {
          isSingleton = true
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          dataField = "."
          serviceUrl = "/admin/settings/account"
        }
        deployRequests = {
          modify = {
            url = "/api/internal/email-notifications"
            method = "put"
          }
        }
      }
      EndUserSupport = {
        request = {
          url = "/api/internal/enduser-support"
        }
        transformation = {
          isSingleton = true
          serviceUrl = "/admin/settings/account"
        }
        deployRequests = {
          modify = {
            url = "/api/internal/enduser-support"
            method = "post"
          }
        }
      }
      ThirdPartyAdmin = {
        request = {
          url = "/api/internal/orgSettings/thirdPartyAdminSetting"
        }
        transformation = {
          isSingleton = true
          serviceUrl = "/admin/settings/account"
        }
        deployRequests = {
          modify = {
            url = "/api/internal/orgSettings/thirdPartyAdminSetting"
            method = "post"
          }
        }
      }
      EmbeddedSignInSuppport = {
        request = {
          url = "/admin/api/v1/embedded-login-settings"
        }
        transformation = {
          isSingleton = true
          serviceUrl = "/admin/settings/account"
        }
        deployRequests = {
          modify = {
            url = "/admin/api/v1/embedded-login-settings"
            method = "post"
          }
        }
      }
      SignOutPage = {
        request = {
          url = "/api/internal/org/settings/signout-page"
        }
        transformation = {
          isSingleton = true
          serviceUrl = "/admin/customizations/other"
        }
        deployRequests = {
          modify = {
            url = "/api/internal/org/settings/signout-page"
            method = "post"
          }
        }
      }
      BrowserPlugin = {
        request = {
          url = "/api/internal/org/settings/browserplugin"
        }
        transformation = {
          isSingleton = true
          serviceUrl = "/admin/customizations/other"
        }
        deployRequests = {
          modify = {
            url = "/api/internal/org/settings/browserplugin"
            method = "post"
          }
        }
      }
      DisplayLanguage = {
        request = {
          url = "/api/internal/org/settings/locale"
        }
        transformation = {
          dataField = "."
          isSingleton = true
          serviceUrl = "/admin/customizations/other"
        }
        deployRequests = {
          modify = {
            url = "/api/internal/org/settings/locale"
            method = "post"
          }
        }
      }
      Reauthentication = {
        request = {
          url = "/api/internal/org/settings/reauth-expiration"
        }
        transformation = {
          isSingleton = true
          serviceUrl = "/admin/customizations/other"
        }
        deployRequests = {
          modify = {
            url = "/api/internal/org/settings/reauth-expiration"
            method = "post"
          }
        }
      }
      GroupPush = {
        transformation = {
          idFields = [
            "&userGroupId",
          ]
          serviceIdField = "mappingId"
          extendsParentId = true
        }
        deployRequests = {
          add = {
            url = "/api/internal/instance/{appId}/grouppush"
            method = "post"
            urlParamsToFields = {
              appId = "_parent.0.id"
            }
          }
          remove = {
            url = "/api/internal/instance/{appId}/grouppush/{pushId}/delete"
            method = "post"
            urlParamsToFields = {
              appId = "_parent.0.id"
              pushId = "mappingId"
            }
            fieldsToIgnore = [
              "mappingId",
              "status",
              "userGroupId",
              "newAppGroupName",
              "groupPushRule",
            ]
          }
        }
      }
      GroupPushRule = {
        transformation = {
          idFields = [
            "name",
          ]
          serviceIdField = "mappingRuleId"
          extendsParentId = true
        }
        deployRequests = {
          add = {
            url = "/api/internal/instance/{appId}/grouppushrules"
            method = "post"
            urlParamsToFields = {
              appId = "_parent.0.id"
            }
          }
          modify = {
            url = "/api/internal/instance/{appId}/grouppushrules/{ruleId}"
            method = "put"
            urlParamsToFields = {
              appId = "_parent.0.id"
              ruleId = "mappingRuleId"
            }
            fieldsToIgnore = [
              "mappingRuleId",
            ]
          }
          remove = {
            url = "/api/internal/instance/{appId}/grouppushrules/{ruleId}"
            method = "delete"
            urlParamsToFields = {
              appId = "_parent.0.id"
              ruleId = "mappingRuleId"
            }
            fieldsToIgnore = [
              "mappingRuleId",
              "name",
              "status",
              "searchExpression",
              "descriptionSearchExpression",
              "searchExpressionType",
              "descriptionSearchExpressionType",
            ]
          }
        }
      }
    }
    supportedTypes = {
      EmailNotifications = [
        "EmailNotifications",
      ]
      EndUserSupport = [
        "EndUserSupport",
      ]
      ThirdPartyAdmin = [
        "ThirdPartyAdmin",
      ]
      EmbeddedSignInSuppport = [
        "EmbeddedSignInSuppport",
      ]
      SignOutPage = [
        "SignOutPage",
      ]
      BrowserPlugin = [
        "BrowserPlugin",
      ]
      DisplayLanguage = [
        "DisplayLanguage",
      ]
      Reauthentication = [
        "Reauthentication",
      ]
    }
  }
}
```
