# Okta system configuration
## Default Configuration
```hcl
okta {
  apiDefinitions = {
    swagger = {
      url = "https://raw.githubusercontent.com/okta/okta-management-openapi-spec/master/dist/spec.yaml"
      additionalTypes = [
        {
          typeName = "AuthenticatorEnrollmentPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "GlobalSessionPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "AuthenticationPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "ProfileEnrollmentPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "IdentityProviderRoutingRules"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "PasswordPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "OAuthAuthorizationPolicies"
          cloneFrom = "api__v1__policies"
        },
        {
          typeName = "RolePage"
          cloneFrom = "api__v1__groups___groupId___roles@uuuuuu_00123_00125uu"
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
              fieldName = "users"
              fieldType = "list<User>"
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
        }
      }
      api__v1__apps = {
        request = {
          url = "/api/v1/apps"
          recurseInto = [
            {
              type = "api__v1__apps___appId___credentials__csrs@uuuuuu_00123_00125uuuu"
              toField = "CSRs"
              context = [
                {
                  name = "appId"
                  fromField = "id"
                },
              ]
            },
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
            {
              type = "api__v1__apps___appId___features@uuuuuu_00123_00125uu"
              toField = "appFeatures"
              context = [
                {
                  name = "appId"
                  fromField = "id"
                },
              ]
              skipOnError = true
            },
          ]
        }
      }
      Application = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "appUsers"
              fieldType = "list<AppUser>"
            },
            {
              fieldName = "CSRs"
              fieldType = "list<Csr>"
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
          standaloneFields = [
            {
              fieldName = "appUsers"
            },
          ]
          idFields = [
            "name",
            "status",
          ]
          serviceIdField = "id"
          fieldsToHide = [
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
        }
      }
      AppUser = {
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
              fieldName = "statusChanged"
            },
            {
              fieldName = "_links"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/api/v1/apps/{applicationId}/users/{userId}"
            urlParamsToFields = {
              applicationId = "_parent.0.id"
              userId = "id"
            }
            method = "post"
            fieldsToIgnore = [
              "id",
              "status",
              "syncState",
            ]
          }
          modify = {
            url = "/api/v1/apps/{applicationId}/users/{userId}"
            urlParamsToFields = {
              applicationId = "_parent.0.id"
              userId = "id"
            }
            method = "post"
            fieldsToIgnore = [
              "id",
              "status",
              "syncState",
            ]
          }
          remove = {
            url = "/api/v1/apps/{applicationId}/users/{userId}"
            urlParamsToFields = {
              applicationId = "_parent.0.id"
              userId = "id"
            }
            method = "delete"
            fieldsToIgnore = [
              "id",
            ]
          }
        }
      }
      api__v1__meta__types__user = {
        transformation = {
          dataField = "."
        }
      }
      api__v1__users = {
        request = {
          url = "/api/v1/users"
          recurseInto = [
            {
              type = "api__v1__users___userId___roles@uuuuuu_00123_00125uu"
              toField = "roles"
              context = [
                {
                  name = "userId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      api__v1__idps = {
        request = {
          url = "/api/v1/idps"
          recurseInto = [
            {
              type = "api__v1__idps___idpId___users@uuuuuu_00123_00125uu"
              toField = "users"
              context = [
                {
                  name = "idpId"
                  fromField = "id"
                },
              ]
            },
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
              fieldName = "users"
              fieldType = "list<IdentityProviderApplicationUser>"
            },
            {
              fieldName = "CSRs"
              fieldType = "list<Csr>"
            },
          ]
          serviceIdField = "id"
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
        }
      }
      AuthenticatorEnrollmentPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "MFA_ENROLL"
          }
          recurseInto = [
            {
              type = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
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
      GlobalSessionPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "OKTA_SIGN_ON"
          }
          recurseInto = [
            {
              type = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
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
      AuthenticationPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "ACCESS_POLICY"
          }
          recurseInto = [
            {
              type = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
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
      ProfileEnrollmentPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "PROFILE_ENROLLMENT"
          }
          recurseInto = [
            {
              type = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
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
      IdentityProviderRoutingRules = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "IDP_DISCOVERY"
          }
          recurseInto = [
            {
              type = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
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
      PasswordPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "PASSWORD"
          }
          recurseInto = [
            {
              type = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
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
      OAuthAuthorizationPolicies = {
        request = {
          url = "/api/v1/policies"
          queryParams = {
            type = "OAUTH_AUTHORIZATION_POLICY"
          }
          recurseInto = [
            {
              type = "api__v1__policies___policyId___rules@uuuuuu_00123_00125uu"
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
      UserSchema = {
        request = {
          url = "/api/v1/meta/schemas/user/default"
        }
        transformation = {
          serviceIdField = "id"
        }
      }
      User = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "roles"
              fieldType = "list<Role>"
            },
          ]
          idFields = [
            "profile.firstName",
            "profile.lastName",
          ]
          serviceIdField = "id"
          fieldsToOmit = [
            {
              fieldName = "lastLogin"
            },
          ]
        }
      }
      Policy = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "policyRules"
              fieldType = "list<PolicyRule>"
            },
            {
              fieldName = "settings"
              fieldType = "map<unknown>"
            },
          ]
          idFields = [
            "name",
            "type",
          ]
          standaloneFields = [
            {
              fieldName = "policyRules"
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
              fieldName = "_links"
            },
          ]
        }
      }
      PolicyRule = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "_links"
              fieldType = "list<Policy__links>"
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
              fieldName = "_links"
            },
          ]
          serviceIdField = "id"
        }
      }
      OrgContactTypeObj = {
        transformation = {
          idFields = [
            "contactType",
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
              fieldName = "_links"
            },
          ]
          serviceIdField = "id"
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
        }
      }
      Domain = {
        transformation = {
          isSingleton = true
          serviceIdField = "id"
        }
      }
      OrgSetting = {
        transformation = {
          isSingleton = true
          serviceIdField = "id"
        }
      }
      Brand = {
        transformation = {
          isSingleton = true
          serviceIdField = "id"
        }
      }
      Authenticator = {
        transformation = {
          serviceIdField = "id"
        }
      }
      EventHook = {
        transformation = {
          serviceIdField = "id"
        }
      }
      GroupRule = {
        transformation = {
          serviceIdField = "id"
        }
      }
      InlineHook = {
        transformation = {
          serviceIdField = "id"
        }
      }
      NetworkZone = {
        transformation = {
          serviceIdField = "id"
        }
      }
      TrustedOrigin = {
        transformation = {
          serviceIdField = "id"
        }
      }
      UserType = {
        transformation = {
          serviceIdField = "id"
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
        }
      }
      AppUserCredentials = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "password"
            },
          ]
        }
      }
      UserCredentials = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "password"
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
      OrgContactTypeObj = [
        "api__v1__org__contacts",
      ]
      OrgSettings = [
        "OrgSetting",
      ]
      Policy = [
        "AuthenticatorEnrollmentPolicies",
        "GlobalSessionPolicies",
        "AuthenticationPolicies",
        "ProfileEnrollmentPolicies",
        "IdentityProviderRoutingRules",
        "PasswordPolicies",
        "OAuthAuthorizationPolicies",
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
      Role = [
        "RolePage",
      ]
    }
  }
}
```
