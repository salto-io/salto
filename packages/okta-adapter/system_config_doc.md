# Okta system configuration
## Default Configuration
```hcl
okta {
  apiDefinitions = {
    swaggerApiConfig = {
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
            typeName = "IdentityProviderPolicyRule"
            cloneFrom = "PolicyRule"
          },
          {
            typeName = "MultifactorEnrollmentPolicyRule"
            cloneFrom = "PolicyRule"
          },
          {
            typeName = "RolePage"
            cloneFrom = "api__v1__groups___groupId___roles@uuuuuu_00123_00125uu"
          },
        ]
        typeNameOverrides = [
          {
            originalName = "DomainResponse"
            newName = "Domain"
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
        }
      }
      types = {
        api__v1__groups = {
          request = {
            url = "/api/v1/groups"
            recurseInto = [
              {
                type = "api__v1__groups___groupId___roles@uuuuuu_00123_00125uu"
                toField = "roles"
                context = [
                  {
                    name = "groupId"
                    fromField = "id"
                  },
                ]
              },
            ]
          }
        }
        Group = {
          transformation = {
            fieldTypeOverrides = [
              {
                fieldName = "apps"
                fieldType = "list<Application>"
              },
              {
                fieldName = "roles"
                fieldType = "list<Role>"
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
            }
          }
        }
        api__v1__groups___groupId___roles@uuuuuu_00123_00125uu = {
          request = {
            url = "/api/v1/groups/{groupId}/roles"
            recurseInto = [
              {
                type = "api__v1__groups___groupId___roles___roleId___targets__groups@uuuuuu_00123_00125uuuu_00123_00125uuuu"
                toField = "targetGroups"
                context = [
                  {
                    name = "roleId"
                    fromField = "id"
                  },
                ]
              },
            ]
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
            recurseInto = [
              {
                type = "api__v1__apps___appId___groups@uuuuuu_00123_00125uu"
                toField = "assignedGroups"
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
                fieldName = "assignedGroups"
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
            fieldsToHide = [
              {
                fieldName = "signing"
                fieldType = "ApplicationCredentialsSigning"
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
          }
        }
        api__v1__features = {
          request = {
            url = "/api/v1/features"
            recurseInto = [
              {
                type = "api__v1__features___featureId___dependencies@uuuuuu_00123_00125uu"
                toField = "featureDependencies"
                context = [
                  {
                    name = "featureId"
                    fromField = "id"
                  },
                ]
              },
            ]
          }
        }
        Feature = {
          transformation = {
            fieldTypeOverrides = [
              {
                fieldName = "featureDependencies"
                fieldType = "list<Feature>"
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
          }
        }
        UserSchema = {
          request = {
            url = "/api/v1/meta/schemas/user/default"
          }
          transformation = {
            fieldTypeOverrides = [
              {
                fieldName = "description"
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
            ]
            fieldsToHide = [
              {
                fieldName = "id"
              },
            ]
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
            ]
            serviceIdField = "id"
            standaloneFields = [
              {
                fieldName = "policies"
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
        }
        api__v1__brands = {
          request = {
            url = "/api/v1/brands"
            recurseInto = [
              {
                type = "api__v1__brands___brandId___templates__email@uuuuuu_00123_00125uuuu"
                toField = "emailTemplates"
                context = [
                  {
                    name = "brandId"
                    fromField = "id"
                  },
                ]
              },
              {
                type = "api__v1__brands___brandId___themes@uuuuuu_00123_00125uu"
                toField = "themes"
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
          transformation = {
            dataField = "."
          }
        }
        api__v1__brands___brandId___templates__email@uuuuuu_00123_00125uuuu = {
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
            ]
            fieldsToHide = [
              {
                fieldName = "id"
              },
            ]
          }
        }
        Domain = {
          transformation = {
            isSingleton = true
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
            isSingleton = true
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
        RolePage = {
          request = {
            url = "/api/v1/iam/roles"
          }
          transformation = {
            fieldTypeOverrides = [
              {
                fieldName = "roles"
                fieldType = "Role"
              },
            ]
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
          }
        }
        OAuth2Claim = {
          transformation = {
            fieldsToOmit = [
              {
                fieldName = "_links"
              },
            ]
          }
        }
        ProfileMapping = {
          transformation = {
            idFields = [
              "source.name",
              "target.name",
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
          }
          deployRequests = {
            add = {
              url = "/api/v1/policies"
              method = "post"
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            modify = {
              url = "/api/v1/policies/{policyId}"
              method = "put"
              urlParamsToFields = {
                policyId = "id"
              }
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            remove = {
              url = "/api/v1/policies/{policyId}"
              method = "delete"
              urlParamsToFields = {
                policyId = "id"
              }
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
          }
          deployRequests = {
            add = {
              url = "/api/v1/policies"
              method = "post"
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            modify = {
              url = "/api/v1/policies/{policyId}"
              method = "put"
              urlParamsToFields = {
                policyId = "id"
              }
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            remove = {
              url = "/api/v1/policies/{policyId}"
              method = "delete"
              urlParamsToFields = {
                policyId = "id"
              }
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
          }
          deployRequests = {
            add = {
              url = "/api/v1/policies"
              method = "post"
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            modify = {
              url = "/api/v1/policies/{policyId}"
              method = "put"
              urlParamsToFields = {
                policyId = "id"
              }
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            remove = {
              url = "/api/v1/policies/{policyId}"
              method = "delete"
              urlParamsToFields = {
                policyId = "id"
              }
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
          }
          deployRequests = {
            add = {
              url = "/api/v1/policies"
              method = "post"
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            modify = {
              url = "/api/v1/policies/{policyId}"
              method = "put"
              urlParamsToFields = {
                policyId = "id"
              }
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            remove = {
              url = "/api/v1/policies/{policyId}"
              method = "delete"
              urlParamsToFields = {
                policyId = "id"
              }
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
          }
          deployRequests = {
            add = {
              url = "/api/v1/policies"
              method = "post"
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            modify = {
              url = "/api/v1/policies/{policyId}"
              method = "put"
              urlParamsToFields = {
                policyId = "id"
              }
              fieldsToIgnore = [
                "policyRules",
              ]
            }
            remove = {
              url = "/api/v1/policies/{policyId}"
              method = "delete"
              urlParamsToFields = {
                policyId = "id"
              }
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
          }
          deployRequests = {
            modify = {
              url = "/api/v1/rate-limit-settings/admin-notifications"
              method = "put"
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
        AccessPolicy = "AccessPolicies"
        IdentityProviderPolicy = "IdentityProviderPolicies"
        MultifactorEnrollmentPolicy = "MultifactorEnrollmentPolicies"
        OktaSignOnPolicy = "OktaSignOnPolicies"
        PasswordPolicy = "PasswordPolicies"
        ProfileEnrollmentPolicy = "ProfileEnrollmentPolicies"
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
        Role = [
          "RolePage",
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
      }
    }
    ducktypeApiConfig = {
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
          }
          deployRequests = {
            modify = {
              url = "/api/internal/org/settings/reauth-expiration"
              method = "post"
            }
          }
        }
      }
      supportedTypes = {
        EmailNotificationSettings = [
          "EmailNotifications",
        ]
        EndUserSupportSettings = [
          "EndUserSupport",
        ]
        ThirdPartyAdminSettings = [
          "ThirdPartyAdmin",
        ]
        EmbeddedSignInSuppportSettings = [
          "EmbeddedSignInSuppport",
        ]
        SignOutPageSettings = [
          "SignOutPage",
        ]
        BrowserPluginSettings = [
          "BrowserPlugin",
        ]
        DisplayLanguageSettings = [
          "DisplayLanguage",
        ]
        ReauthenticationSettings = [
          "Reauthentication",
        ]
      }
    }
  }
}
```
