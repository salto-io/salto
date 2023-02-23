# SAP system configuration
## Default Configuration
```hcl
sap {
  apiDefinitions = {
    typeDefaults = {
      request = {
        paginationField = "next_page"
      }
      transformation = {
        idFields = [
          "name",
        ]
        fileNameFields = [
          "name",
        ]
        fieldsToOmit = [
          {
            fieldName = "extended_input_schema"
          },
          {
            fieldName = "extended_output_schema"
          },
          {
            fieldName = "url"
            fieldType = "string"
          },
          {
            fieldName = "count"
            fieldType = "number"
          },
        ]
        fieldsToHide = [
          {
            fieldName = "created_at"
            fieldType = "string"
          },
          {
            fieldName = "updated_at"
            fieldType = "string"
          },
        ]
        serviceIdField = "id"
      }
    }
    types = {
      group = {
        transformation = {
          sourceTypeName = "groups__groups"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/people/team/groups"
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/groups"
            deployAsField = "group"
            method = "post"
          }
          modify = {
            url = "/groups/{groupId}"
            method = "put"
            deployAsField = "group"
            urlParamsToFields = {
              groupId = "id"
            }
          }
          remove = {
            url = "/groups/{groupId}"
            method = "delete"
            deployAsField = "group"
            urlParamsToFields = {
              groupId = "id"
            }
          }
        }
      }
      custom_role = {
        transformation = {
          sourceTypeName = "custom_roles__custom_roles"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "role_type"
              fieldType = "number"
            },
            {
              fieldName = "team_member_count"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/people/team/roles/{id}"
        }
        deployRequests = {
          add = {
            url = "/custom_roles"
            deployAsField = "custom_role"
            method = "post"
          }
          modify = {
            url = "/custom_roles/{customRoleId}"
            method = "put"
            deployAsField = "custom_role"
            urlParamsToFields = {
              customRoleId = "id"
            }
          }
          remove = {
            url = "/custom_roles/{customRoleId}"
            method = "delete"
            deployAsField = "custom_role"
            urlParamsToFields = {
              customRoleId = "id"
            }
          }
        }
      }
      organization = {
        transformation = {
          sourceTypeName = "organizations__organizations"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "organization_fields"
              fieldType = "map<unknown>"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/agent/organizations/{id}/tickets"
        }
        deployRequests = {
          add = {
            url = "/organizations"
            deployAsField = "organization"
            method = "post"
          }
          modify = {
            url = "/organizations/{organizationId}"
            method = "put"
            deployAsField = "organization"
            urlParamsToFields = {
              organizationId = "id"
            }
          }
          remove = {
            url = "/organizations/{organizationId}"
            method = "delete"
            deployAsField = "organization"
            urlParamsToFields = {
              organizationId = "id"
            }
          }
        }
      }
      view = {
        transformation = {
          sourceTypeName = "views__views"
          idFields = [
            "title",
          ]
          fileNameFields = [
            "title",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/workspaces/agent-workspace/views/{id}"
        }
        deployRequests = {
          add = {
            url = "/views"
            deployAsField = "view"
            method = "post"
          }
          modify = {
            url = "/views/{viewId}"
            method = "put"
            deployAsField = "view"
            urlParamsToFields = {
              viewId = "id"
            }
          }
          remove = {
            url = "/views/{viewId}"
            method = "delete"
            deployAsField = "view"
            urlParamsToFields = {
              viewId = "id"
            }
          }
        }
      }
      view_order = {
        deployRequests = {
          modify = {
            url = "/views/update_many"
            method = "put"
          }
        }
      }
      view__restriction = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "unknown"
            },
          ]
        }
      }
      trigger = {
        transformation = {
          sourceTypeName = "triggers__triggers"
          idFields = [
            "title",
          ]
          fileNameFields = [
            "title",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/objects-rules/rules/triggers/{id}"
        }
        deployRequests = {
          add = {
            url = "/triggers"
            deployAsField = "trigger"
            method = "post"
          }
          modify = {
            url = "/triggers/{triggerId}"
            method = "put"
            deployAsField = "trigger"
            urlParamsToFields = {
              triggerId = "id"
            }
          }
          remove = {
            url = "/triggers/{triggerId}"
            method = "delete"
            deployAsField = "trigger"
            urlParamsToFields = {
              triggerId = "id"
            }
          }
        }
      }
      trigger_category = {
        transformation = {
          sourceTypeName = "trigger_categories__trigger_categories"
          fileNameFields = [
            "name",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
            },
          ]
          serviceUrl = "/admin/objects-rules/rules/triggers"
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/trigger_categories"
            deployAsField = "trigger_category"
            method = "post"
          }
          modify = {
            url = "/trigger_categories/{triggerCategoryId}"
            method = "patch"
            deployAsField = "trigger_category"
            urlParamsToFields = {
              triggerCategoryId = "id"
            }
          }
          remove = {
            url = "/trigger_categories/{triggerCategoryId}"
            method = "delete"
            deployAsField = "trigger_category"
            urlParamsToFields = {
              triggerCategoryId = "id"
            }
          }
        }
      }
      trigger_order = {
        deployRequests = {
          modify = {
            url = "/trigger_categories/jobs"
            method = "post"
            deployAsField = "job"
          }
        }
      }
      trigger_order_entry = {
        transformation = {
          sourceTypeName = "trigger_order__order"
        }
      }
      automation = {
        transformation = {
          sourceTypeName = "automations__automations"
          idFields = [
            "title",
          ]
          fileNameFields = [
            "title",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/objects-rules/rules/automations/{id}"
        }
        deployRequests = {
          add = {
            url = "/automations"
            deployAsField = "automation"
            method = "post"
          }
          modify = {
            url = "/automations/{automationId}"
            method = "put"
            deployAsField = "automation"
            urlParamsToFields = {
              automationId = "id"
            }
          }
          remove = {
            url = "/automations/{automationId}"
            method = "delete"
            deployAsField = "automation"
            urlParamsToFields = {
              automationId = "id"
            }
          }
        }
      }
      automation_order = {
        deployRequests = {
          modify = {
            url = "/automations/update_many"
            method = "put"
          }
        }
      }
      sla_policy = {
        transformation = {
          sourceTypeName = "sla_policies__sla_policies"
          idFields = [
            "title",
          ]
          fileNameFields = [
            "title",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/objects-rules/rules/slas"
        }
        deployRequests = {
          add = {
            url = "/slas/policies"
            deployAsField = "sla_policy"
            method = "post"
          }
          modify = {
            url = "/slas/policies/{slaPolicyId}"
            method = "put"
            deployAsField = "sla_policy"
            urlParamsToFields = {
              slaPolicyId = "id"
            }
          }
          remove = {
            url = "/slas/policies/{slaPolicyId}"
            method = "delete"
            deployAsField = "sla_policy"
            urlParamsToFields = {
              slaPolicyId = "id"
            }
          }
        }
      }
      sla_policy_order = {
        deployRequests = {
          modify = {
            url = "/slas/policies/reorder"
            method = "put"
          }
        }
      }
      sla_policy_definition = {
        transformation = {
          sourceTypeName = "sla_policies_definitions__definitions"
          isSingleton = true
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      target = {
        transformation = {
          sourceTypeName = "targets__targets"
          idFields = [
            "title",
            "type",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/apps-integrations/targets/targets"
        }
        deployRequests = {
          add = {
            url = "/targets"
            deployAsField = "target"
            method = "post"
          }
          modify = {
            url = "/targets/{targetId}"
            method = "put"
            deployAsField = "target"
            urlParamsToFields = {
              targetId = "id"
            }
          }
          remove = {
            url = "/targets/{targetId}"
            method = "delete"
            deployAsField = "target"
            urlParamsToFields = {
              targetId = "id"
            }
          }
        }
      }
      macro = {
        transformation = {
          sourceTypeName = "macros__macros"
          idFields = [
            "title",
          ]
          fileNameFields = [
            "title",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "position"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/workspaces/agent-workspace/macros/{id}"
        }
        deployRequests = {
          add = {
            url = "/macros"
            deployAsField = "macro"
            method = "post"
          }
          modify = {
            url = "/macros/{macroId}"
            method = "put"
            deployAsField = "macro"
            urlParamsToFields = {
              macroId = "id"
            }
          }
          remove = {
            url = "/macros/{macroId}"
            method = "delete"
            deployAsField = "macro"
            urlParamsToFields = {
              macroId = "id"
            }
          }
        }
      }
      macro_attachment = {
        transformation = {
          idFields = [
            "filename",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      macro_action = {
        transformation = {
          sourceTypeName = "macros_actions__actions"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      macro_category = {
        transformation = {
          sourceTypeName = "macros_categories__categories"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      macro_definition = {
        transformation = {
          sourceTypeName = "macros_definitions__definitions"
          isSingleton = true
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      brand = {
        transformation = {
          sourceTypeName = "brands__brands"
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "ticket_form_ids"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "help_center_state"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "enabled",
                  "disabled",
                  "restricted",
                ]
              }
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/account/brand_management/brands"
        }
        deployRequests = {
          add = {
            url = "/brands"
            deployAsField = "brand"
            method = "post"
          }
          modify = {
            url = "/brands/{brandId}"
            method = "put"
            deployAsField = "brand"
            urlParamsToFields = {
              brandId = "id"
            }
          }
          remove = {
            url = "/brands/{brandId}"
            method = "delete"
            deployAsField = "brand"
            urlParamsToFields = {
              brandId = "id"
            }
          }
        }
      }
      locale = {
        transformation = {
          sourceTypeName = "locales__locales"
          idFields = [
            "locale",
          ]
          fileNameFields = [
            "locale",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      business_hours_schedules = {
        request = {
          url = "/business_hours/schedules"
          recurseInto = [
            {
              type = "business_hours_schedule_holiday"
              toField = "holidays"
              context = [
                {
                  name = "scheduleId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          dataField = "schedules"
        }
      }
      business_hours_schedule = {
        transformation = {
          standaloneFields = [
            {
              fieldName = "holidays"
            },
          ]
          sourceTypeName = "business_hours_schedules__schedules"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/objects-rules/rules/schedules"
        }
        deployRequests = {
          add = {
            url = "/business_hours/schedules"
            deployAsField = "schedule"
            method = "post"
          }
          modify = {
            url = "/business_hours/schedules/{scheduleId}"
            method = "put"
            deployAsField = "schedule"
            urlParamsToFields = {
              scheduleId = "id"
            }
          }
          remove = {
            url = "/business_hours/schedules/{scheduleId}"
            method = "delete"
            deployAsField = "schedule"
            urlParamsToFields = {
              scheduleId = "id"
            }
          }
        }
      }
      sharing_agreement = {
        transformation = {
          sourceTypeName = "sharing_agreements__sharing_agreements"
          fieldTypeOverrides = [
            {
              fieldName = "status"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "accepted",
                  "declined",
                  "pending",
                  "inactive",
                ]
              }
            },
            {
              fieldName = "type"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "inbound",
                  "outbound",
                ]
              }
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/sharing_agreements"
            deployAsField = "sharing_agreement"
            method = "post"
          }
          modify = {
            url = "/sharing_agreements/{sharingAgreementId}"
            method = "put"
            deployAsField = "sharing_agreement"
            urlParamsToFields = {
              sharingAgreementId = "id"
            }
          }
          remove = {
            url = "/sharing_agreements/{sharingAgreementId}"
            method = "delete"
            deployAsField = "sharing_agreement"
            urlParamsToFields = {
              sharingAgreementId = "id"
            }
          }
        }
      }
      support_address = {
        transformation = {
          sourceTypeName = "support_addresses__recipient_addresses"
          fieldTypeOverrides = [
            {
              fieldName = "cname_status"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "unknown",
                  "verified",
                  "failed",
                ]
              }
            },
            {
              fieldName = "dns_results"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "verified",
                  "failed",
                ]
              }
            },
            {
              fieldName = "domain_verification_status"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "unknown",
                  "verified",
                  "failed",
                ]
              }
            },
            {
              fieldName = "forwarding_status"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "unknown",
                  "waiting",
                  "verified",
                  "failed",
                ]
              }
            },
            {
              fieldName = "spf_status"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "unknown",
                  "verified",
                  "failed",
                ]
              }
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
            {
              fieldName = "domain_verification_code"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/recipient_addresses"
            deployAsField = "recipient_address"
            method = "post"
          }
          modify = {
            url = "/recipient_addresses/{supportAddressId}"
            method = "put"
            deployAsField = "recipient_address"
            urlParamsToFields = {
              supportAddressId = "id"
            }
          }
          remove = {
            url = "/recipient_addresses/{supportAddressId}"
            method = "delete"
            deployAsField = "recipient_address"
            urlParamsToFields = {
              supportAddressId = "id"
            }
          }
        }
      }
      ticket_form = {
        transformation = {
          sourceTypeName = "ticket_forms__ticket_forms"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "display_name"
              fieldType = "string"
            },
            {
              fieldName = "name"
              fieldType = "string"
            },
          ]
          serviceUrl = "/admin/objects-rules/tickets/ticket-forms/edit/{id}"
        }
        deployRequests = {
          add = {
            url = "/ticket_forms"
            deployAsField = "ticket_form"
            method = "post"
          }
          modify = {
            url = "/ticket_forms/{ticketFormId}"
            method = "put"
            deployAsField = "ticket_form"
            urlParamsToFields = {
              ticketFormId = "id"
            }
          }
          remove = {
            url = "/ticket_forms/{ticketFormId}"
            method = "delete"
            deployAsField = "ticket_form"
            urlParamsToFields = {
              ticketFormId = "id"
            }
          }
        }
      }
      ticket_field = {
        transformation = {
          sourceTypeName = "ticket_fields__ticket_fields"
          idFields = [
            "raw_title",
            "type",
          ]
          fileNameFields = [
            "raw_title",
            "type",
          ]
          standaloneFields = [
            {
              fieldName = "custom_field_options"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "position"
              fieldType = "number"
            },
            {
              fieldName = "title"
              fieldType = "string"
            },
            {
              fieldName = "description"
              fieldType = "string"
            },
            {
              fieldName = "title_in_portal"
              fieldType = "string"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/objects-rules/tickets/ticket-fields/{id}"
        }
        deployRequests = {
          add = {
            url = "/ticket_fields"
            deployAsField = "ticket_field"
            method = "post"
          }
          modify = {
            url = "/ticket_fields/{ticketFieldId}"
            method = "put"
            deployAsField = "ticket_field"
            urlParamsToFields = {
              ticketFieldId = "id"
            }
          }
          remove = {
            url = "/ticket_fields/{ticketFieldId}"
            method = "delete"
            deployAsField = "ticket_field"
            urlParamsToFields = {
              ticketFieldId = "id"
            }
          }
        }
      }
      ticket_field__custom_field_options = {
        deployRequests = {
          add = {
            url = "/ticket_fields/{ticketFieldId}/options"
            method = "post"
            deployAsField = "custom_field_option"
            urlParamsToFields = {
              ticketFieldId = "_parent.0.id"
            }
          }
          modify = {
            url = "/ticket_fields/{ticketFieldId}/options"
            method = "post"
            deployAsField = "custom_field_option"
            urlParamsToFields = {
              ticketFieldId = "_parent.0.id"
            }
          }
          remove = {
            url = "/ticket_fields/{ticketFieldId}/options/{ticketFieldOptionId}"
            method = "delete"
            urlParamsToFields = {
              ticketFieldId = "_parent.0.id"
              ticketFieldOptionId = "id"
            }
          }
        }
        transformation = {
          idFields = [
            "value",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      user_field = {
        transformation = {
          sourceTypeName = "user_fields__user_fields"
          idFields = [
            "key",
          ]
          standaloneFields = [
            {
              fieldName = "custom_field_options"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "type"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "checkbox",
                  "date",
                  "decimal",
                  "dropdown",
                  "integer",
                  "regexp",
                  "text",
                  "textarea",
                ]
              }
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "title"
              fieldType = "string"
            },
            {
              fieldName = "description"
              fieldType = "string"
            },
          ]
          serviceUrl = "/agent/admin/user_fields/{id}"
        }
        deployRequests = {
          add = {
            url = "/user_fields"
            deployAsField = "user_field"
            method = "post"
          }
          modify = {
            url = "/user_fields/{userFieldId}"
            method = "put"
            deployAsField = "user_field"
            urlParamsToFields = {
              userFieldId = "id"
            }
          }
          remove = {
            url = "/user_fields/{userFieldId}"
            method = "delete"
            deployAsField = "user_field"
            urlParamsToFields = {
              userFieldId = "id"
            }
          }
        }
      }
      user_field__custom_field_options = {
        deployRequests = {
          add = {
            url = "/user_fields/{userFieldId}/options"
            method = "post"
            deployAsField = "custom_field_option"
            urlParamsToFields = {
              userFieldId = "_parent.0.id"
            }
          }
          modify = {
            url = "/user_fields/{userFieldId}/options"
            method = "post"
            deployAsField = "custom_field_option"
            urlParamsToFields = {
              userFieldId = "_parent.0.id"
            }
          }
          remove = {
            url = "/user_fields/{userFieldId}/options/{userFieldOptionId}"
            method = "delete"
            urlParamsToFields = {
              userFieldId = "_parent.0.id"
              userFieldOptionId = "id"
            }
          }
        }
        transformation = {
          idFields = [
            "value",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
            {
              fieldName = "default"
              fieldType = "boolean"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      user_field_order = {
        deployRequests = {
          modify = {
            url = "/user_fields/reorder"
            method = "put"
          }
        }
      }
      organization_field = {
        transformation = {
          sourceTypeName = "organization_fields__organization_fields"
          idFields = [
            "key",
          ]
          standaloneFields = [
            {
              fieldName = "custom_field_options"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "type"
              fieldType = "string"
              restrictions = {
                enforce_value = true
                values = [
                  "checkbox",
                  "date",
                  "decimal",
                  "dropdown",
                  "integer",
                  "regexp",
                  "text",
                  "textarea",
                ]
              }
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "title"
              fieldType = "string"
            },
            {
              fieldName = "description"
              fieldType = "string"
            },
          ]
          serviceUrl = "/agent/admin/organization_fields/{id}"
        }
        deployRequests = {
          add = {
            url = "/organization_fields"
            deployAsField = "organization_field"
            method = "post"
          }
          modify = {
            url = "/organization_fields/{organizationFieldId}"
            method = "put"
            deployAsField = "organization_field"
            urlParamsToFields = {
              organizationFieldId = "id"
            }
          }
          remove = {
            url = "/organization_fields/{organizationFieldId}"
            method = "delete"
            deployAsField = "organization_field"
            urlParamsToFields = {
              organizationFieldId = "id"
            }
          }
        }
      }
      organization_field__custom_field_options = {
        transformation = {
          idFields = [
            "value",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "name"
              fieldType = "string"
            },
          ]
        }
      }
      organization_field_order = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
        deployRequests = {
          modify = {
            url = "/organization_fields/reorder"
            method = "put"
          }
        }
      }
      routing_attribute = {
        transformation = {
          standaloneFields = [
            {
              fieldName = "values"
            },
          ]
          sourceTypeName = "routing_attributes__attributes"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          serviceUrl = "/admin/objects-rules/rules/routing"
        }
        deployRequests = {
          add = {
            url = "/routing/attributes"
            deployAsField = "attribute"
            method = "post"
          }
          modify = {
            url = "/routing/attributes/{attributeId}"
            method = "put"
            deployAsField = "attribute"
            urlParamsToFields = {
              attributeId = "id"
            }
          }
          remove = {
            url = "/routing/attributes/{attributeId}"
            method = "delete"
            deployAsField = "attribute"
            urlParamsToFields = {
              attributeId = "id"
            }
          }
        }
      }
      routing_attribute_definition = {
        transformation = {
          sourceTypeName = "routing_attribute_definitions__definitions"
          hasDynamicFields = true
          isSingleton = true
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      workspace = {
        transformation = {
          sourceTypeName = "workspaces__workspaces"
          idFields = [
            "title",
          ]
          fileNameFields = [
            "title",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/workspaces/agent-workspace/contextual-workspaces"
        }
        deployRequests = {
          add = {
            url = "/workspaces"
            deployAsField = "workspace"
            method = "post"
          }
          modify = {
            url = "/workspaces/{workspaceId}"
            method = "put"
            deployAsField = "workspace"
            urlParamsToFields = {
              workspaceId = "id"
            }
          }
          remove = {
            url = "/workspaces/{workspaceId}"
            method = "delete"
            deployAsField = "workspace"
            urlParamsToFields = {
              workspaceId = "id"
            }
          }
        }
      }
      workspace__selected_macros = {
        transformation = {
          fieldsToHide = [
          ]
        }
      }
      workspace__selected_macros__restriction = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "unknown"
            },
          ]
        }
      }
      workspace__apps = {
        transformation = {
          fieldsToHide = [
          ]
        }
      }
      workspace_order = {
        deployRequests = {
          modify = {
            url = "/workspaces/reorder"
            method = "put"
          }
        }
      }
      app_installation = {
        transformation = {
          sourceTypeName = "app_installations__installations"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "updated"
              fieldType = "string"
            },
          ]
          idFields = [
            "settings.name",
            "app_id",
          ]
          fileNameFields = [
            "settings.name",
            "app_id",
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/apps-integrations/apps/support-apps"
        }
        deployRequests = {
          add = {
            url = "/apps/installations"
            method = "post"
          }
          modify = {
            url = "/apps/installations/{appInstallationId}"
            method = "put"
            urlParamsToFields = {
              appInstallationId = "id"
            }
          }
          remove = {
            url = "/apps/installations/{appInstallationId}"
            method = "delete"
            urlParamsToFields = {
              appInstallationId = "id"
            }
          }
        }
      }
      app_owned = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
            {
              fieldName = "parameters"
              fieldType = "map<app_owned__parameters>"
            },
          ]
          sourceTypeName = "apps_owned__apps"
        }
      }
      app_owned__parameters = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
            },
            {
              fieldName = "app_id"
            },
          ]
          fieldsToOmit = [
          ]
        }
      }
      oauth_client = {
        transformation = {
          sourceTypeName = "oauth_clients__clients"
          idFields = [
            "identifier",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
            {
              fieldName = "secret"
              fieldType = "string"
            },
            {
              fieldName = "user_id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/apps-integrations/apis/sap-api/oauth_clients"
        }
        deployRequests = {
          add = {
            url = "/oauth/clients"
            deployAsField = "client"
            method = "post"
          }
          modify = {
            url = "/oauth/clients/{oauthClientId}"
            method = "put"
            deployAsField = "client"
            urlParamsToFields = {
              oauthClientId = "id"
            }
          }
          remove = {
            url = "/oauth/clients/{oauthClientId}"
            method = "delete"
            deployAsField = "client"
            urlParamsToFields = {
              oauthClientId = "id"
            }
          }
        }
      }
      oauth_global_client = {
        transformation = {
          sourceTypeName = "oauth_global_clients__global_clients"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      account_setting = {
        transformation = {
          sourceTypeName = "account_settings__settings"
          isSingleton = true
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
        deployRequests = {
          modify = {
            url = "/account/settings"
            method = "put"
            deployAsField = "settings"
          }
        }
      }
      resource_collection = {
        transformation = {
          sourceTypeName = "resource_collections__resource_collections"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      monitored_twitter_handle = {
        transformation = {
          sourceTypeName = "monitored_twitter_handles__monitored_twitter_handles"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      groups = {
        request = {
          url = "/groups"
        }
        transformation = {
          dataField = "groups"
        }
      }
      custom_roles = {
        request = {
          url = "/custom_roles"
        }
        transformation = {
          dataField = "custom_roles"
        }
      }
      organizations = {
        request = {
          url = "/organizations"
        }
        transformation = {
          dataField = "organizations"
        }
      }
      views = {
        request = {
          url = "/views"
        }
        transformation = {
          dataField = "views"
          fileNameFields = [
            "title",
          ]
        }
      }
      triggers = {
        request = {
          url = "/triggers"
        }
      }
      trigger_definitions = {
        request = {
          url = "/triggers/definitions"
        }
        transformation = {
          dataField = "definitions"
        }
      }
      trigger_definition = {
        transformation = {
          sourceTypeName = "trigger_definitions__definitions"
          isSingleton = true
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      trigger_categories = {
        request = {
          url = "/trigger_categories"
          paginationField = "links.next"
        }
        transformation = {
          dataField = "trigger_categories"
        }
      }
      automations = {
        request = {
          url = "/automations"
        }
        transformation = {
          dataField = "automations"
        }
      }
      sla_policies = {
        request = {
          url = "/slas/policies"
        }
      }
      sla_policies_definitions = {
        request = {
          url = "/slas/policies/definitions"
        }
        transformation = {
          dataField = "value"
        }
      }
      targets = {
        request = {
          url = "/targets"
        }
      }
      macros = {
        request = {
          url = "/macros"
        }
        transformation = {
          dataField = "macros"
        }
      }
      macros_actions = {
        request = {
          url = "/macros/actions"
        }
        transformation = {
          dataField = "."
          isSingleton = true
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      macro_categories = {
        request = {
          url = "/macros/categories"
        }
        transformation = {
          isSingleton = true
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      macros_definitions = {
        request = {
          url = "/macros/definitions"
        }
        transformation = {
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      macro__restriction = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "unknown"
            },
          ]
        }
      }
      brands = {
        request = {
          url = "/brands"
        }
        transformation = {
          dataField = "brands"
        }
      }
      dynamic_content_item = {
        request = {
          url = "/dynamic_content/items"
        }
        transformation = {
          dataField = "."
          standaloneFields = [
            {
              fieldName = "variants"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/admin/workspaces/agent-workspace/dynamic_content"
        }
        deployRequests = {
          add = {
            url = "/dynamic_content/items"
            deployAsField = "item"
            method = "post"
          }
          modify = {
            url = "/dynamic_content/items/{dynamicContentItemId}"
            method = "put"
            deployAsField = "item"
            urlParamsToFields = {
              dynamicContentItemId = "id"
            }
          }
          remove = {
            url = "/dynamic_content/items/{dynamicContentItemId}"
            method = "delete"
            deployAsField = "item"
            urlParamsToFields = {
              dynamicContentItemId = "id"
            }
          }
        }
      }
      dynamic_content_item__variants = {
        transformation = {
          idFields = [
            "&locale_id",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
        deployRequests = {
          add = {
            url = "/dynamic_content/items/{dynamicContentItemId}/variants"
            deployAsField = "variant"
            method = "post"
            urlParamsToFields = {
              dynamicContentItemId = "_parent.0.id"
            }
          }
          modify = {
            url = "/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}"
            deployAsField = "variant"
            method = "put"
            urlParamsToFields = {
              dynammicContentVariantId = "id"
              dynamicContentItemId = "_parent.0.id"
            }
          }
          remove = {
            url = "/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}"
            method = "delete"
            urlParamsToFields = {
              dynammicContentVariantId = "id"
              dynamicContentItemId = "_parent.0.id"
            }
          }
        }
      }
      locales = {
        request = {
          url = "/locales"
        }
        transformation = {
          dataField = "locales"
        }
      }
      business_hours_schedule_holiday = {
        request = {
          url = "/business_hours/schedules/{scheduleId}/holidays"
        }
        deployRequests = {
          add = {
            url = "/business_hours/schedules/{scheduleId}/holidays"
            deployAsField = "holiday"
            method = "post"
            urlParamsToFields = {
              scheduleId = "_parent.0.id"
            }
          }
          modify = {
            url = "/business_hours/schedules/{scheduleId}/holidays/{holidayId}"
            deployAsField = "holiday"
            method = "put"
            urlParamsToFields = {
              holidayId = "id"
              scheduleId = "_parent.0.id"
            }
          }
          remove = {
            url = "/business_hours/schedules/{scheduleId}/holidays/{holidayId}"
            method = "delete"
            urlParamsToFields = {
              holidayId = "id"
              scheduleId = "_parent.0.id"
            }
          }
        }
        transformation = {
          sourceTypeName = "business_hours_schedule__holidays"
          dataField = "holidays"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      sharing_agreements = {
        request = {
          url = "/sharing_agreements"
        }
      }
      support_addresses = {
        request = {
          url = "/recipient_addresses"
        }
        transformation = {
          sourceTypeName = "recipient_addresses"
          dataField = "recipient_addresses"
        }
      }
      ticket_forms = {
        request = {
          url = "/ticket_forms"
        }
        transformation = {
          dataField = "ticket_forms"
        }
      }
      ticket_form_order = {
        deployRequests = {
          modify = {
            url = "/ticket_forms/reorder"
            method = "put"
          }
        }
      }
      ticket_fields = {
        request = {
          url = "/ticket_fields"
        }
        transformation = {
          dataField = "ticket_fields"
          fileNameFields = [
            "title",
          ]
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      user_fields = {
        request = {
          url = "/user_fields"
        }
      }
      organization_fields = {
        request = {
          url = "/organization_fields"
        }
      }
      routing_attribute_value = {
        request = {
          url = "/routing/attributes/{attributeId}/values"
        }
        deployRequests = {
          add = {
            url = "/routing/attributes/{attributeId}/values"
            deployAsField = "attribute_value"
            method = "post"
            urlParamsToFields = {
              attributeId = "_parent.0.id"
            }
          }
          modify = {
            url = "/routing/attributes/{attributeId}/values/{attributeValueId}"
            deployAsField = "attribute_value"
            method = "put"
            urlParamsToFields = {
              attributeValueId = "id"
              attributeId = "_parent.0.id"
            }
          }
          remove = {
            url = "/routing/attributes/{attributeId}/values/{attributeValueId}"
            method = "delete"
            urlParamsToFields = {
              attributeValueId = "id"
              attributeId = "_parent.0.id"
            }
          }
        }
        transformation = {
          sourceTypeName = "routing_attribute__values"
          dataField = "attribute_values"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          serviceUrl = "/admin/objects-rules/rules/routing"
        }
      }
      routing_attributes = {
        request = {
          url = "/routing/attributes"
          recurseInto = [
            {
              type = "routing_attribute_value"
              toField = "values"
              context = [
                {
                  name = "attributeId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
      }
      routing_attribute_definitions = {
        request = {
          url = "/routing/attributes/definitions"
        }
        transformation = {
          dataField = "definitions"
        }
      }
      workspaces = {
        request = {
          url = "/workspaces"
        }
      }
      app_installations = {
        request = {
          url = "/apps/installations"
        }
      }
      apps_owned = {
        request = {
          url = "/apps/owned"
        }
      }
      oauth_clients = {
        request = {
          url = "/oauth/clients"
        }
      }
      oauth_global_clients = {
        request = {
          url = "/oauth/global_clients"
        }
      }
      account_settings = {
        request = {
          url = "/account/settings"
        }
        transformation = {
          dataField = "settings"
        }
      }
      resource_collections = {
        request = {
          url = "/resource_collections"
        }
      }
      monitored_twitter_handles = {
        request = {
          url = "/channels/twitter/monitored_twitter_handles"
        }
      }
      webhooks = {
        request = {
          url = "/webhooks"
          paginationField = "links.next"
        }
        transformation = {
          dataField = "webhooks"
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "meta"
            },
          ]
        }
      }
      webhook = {
        transformation = {
          sourceTypeName = "webhooks__webhooks"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "string"
            },
            {
              fieldName = "created_by"
              fieldType = "string"
            },
            {
              fieldName = "updated_by"
              fieldType = "string"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          serviceUrl = "/admin/apps-integrations/webhooks/webhooks/{id}/details"
        }
        deployRequests = {
          add = {
            url = "/webhooks"
            deployAsField = "webhook"
            method = "post"
          }
          modify = {
            url = "/webhooks/{webhookId}"
            method = "patch"
            deployAsField = "webhook"
            urlParamsToFields = {
              webhookId = "id"
            }
          }
          remove = {
            url = "/webhooks/{webhookId}"
            method = "delete"
            urlParamsToFields = {
              webhookId = "id"
            }
          }
        }
      }
      articles = {
        request = {
          url = "/help_center/articles"
          recurseInto = [
            {
              type = "article_translation"
              toField = "translations"
              context = [
                {
                  name = "articleId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          dataField = "articles"
        }
      }
      article = {
        transformation = {
          idFields = [
            "&brand",
            "name",
          ]
          fileNameFields = [
            "&brand",
            "name",
          ]
          standaloneFields = [
            {
              fieldName = "translations"
            },
          ]
          sourceTypeName = "articles__articles"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
            {
              fieldName = "author_id"
              fieldType = "unknown"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "vote_sum"
            },
            {
              fieldName = "vote_count"
            },
            {
              fieldName = "edited_at"
            },
            {
              fieldName = "html_url"
              fieldType = "string"
            },
          ]
          serviceUrl = "/knowledge/articles/{id}"
        }
      }
      article_translation = {
        request = {
          url = "/help_center/articles/{articleId}/translations"
        }
        transformation = {
          idFields = [
            "&brand",
            "locale",
          ]
          fileNameFields = [
            "&brand",
            "locale",
          ]
          sourceTypeName = "article__translations"
          dataField = "translations"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "html_url"
              fieldType = "string"
            },
            {
              fieldName = "source_id"
              fieldType = "number"
            },
            {
              fieldName = "source_type"
              fieldType = "string"
            },
          ]
        }
      }
      sections = {
        request = {
          url = "/help_center/sections"
          recurseInto = [
            {
              type = "section_translation"
              toField = "translations"
              context = [
                {
                  name = "sectionId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          dataField = "sections"
        }
      }
      section = {
        transformation = {
          idFields = [
            "&brand",
            "name",
          ]
          fileNameFields = [
            "&brand",
            "name",
          ]
          standaloneFields = [
            {
              fieldName = "translations"
            },
          ]
          sourceTypeName = "sections__sections"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "html_url"
              fieldType = "string"
            },
          ]
          serviceUrl = "/knowledge/sections/{id}"
        }
      }
      section_translation = {
        request = {
          url = "/help_center/sections/{sectionId}/translations"
        }
        transformation = {
          idFields = [
            "&brand",
            "locale",
          ]
          fileNameFields = [
            "&brand",
            "locale",
          ]
          sourceTypeName = "section__translations"
          dataField = "translations"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "html_url"
              fieldType = "string"
            },
            {
              fieldName = "source_id"
              fieldType = "number"
            },
            {
              fieldName = "source_type"
              fieldType = "string"
            },
          ]
        }
      }
      labels = {
        request = {
          url = "/help_center/articles/labels"
        }
        transformation = {
          dataField = "labels"
        }
      }
      label = {
        transformation = {
          idFields = [
            "&brand",
            "name",
          ]
          fileNameFields = [
            "&brand",
            "name",
          ]
          sourceTypeName = "labels__labels"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      categories = {
        request = {
          url = "/help_center/categories"
          recurseInto = [
            {
              type = "category_translation"
              toField = "translations"
              context = [
                {
                  name = "categoryId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          dataField = "categories"
        }
      }
      category = {
        transformation = {
          idFields = [
            "&brand",
            "name",
          ]
          fileNameFields = [
            "&brand",
            "name",
          ]
          standaloneFields = [
            {
              fieldName = "translations"
            },
          ]
          sourceTypeName = "categories__categories"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "html_url"
              fieldType = "string"
            },
          ]
          serviceUrl = "/hc/admin/categories/{id}/edit"
        }
      }
      category_translation = {
        request = {
          url = "/help_center/categories/{categoryId}/translations"
        }
        transformation = {
          idFields = [
            "&brand",
            "locale",
          ]
          fileNameFields = [
            "&brand",
            "locale",
          ]
          sourceTypeName = "category__translations"
          dataField = "translations"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "url"
              fieldType = "string"
            },
            {
              fieldName = "count"
              fieldType = "number"
            },
            {
              fieldName = "html_url"
              fieldType = "string"
            },
            {
              fieldName = "source_id"
              fieldType = "number"
            },
            {
              fieldName = "source_type"
              fieldType = "string"
            },
          ]
        }
      }
      permission_groups = {
        request = {
          url = "/guide/permission_groups"
        }
        transformation = {
          dataField = "permission_groups"
        }
      }
      permission_group = {
        transformation = {
          sourceTypeName = "permission_groups__permission_groups"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          serviceUrl = "/knowledge/permissions/{id}"
        }
        deployRequests = {
          add = {
            url = "/guide/permission_groups"
            deployAsField = "permission_group"
            method = "post"
          }
          modify = {
            url = "/guide/permission_groups/{permissionGroupId}"
            method = "put"
            deployAsField = "permission_group"
            urlParamsToFields = {
              permissionGroupId = "id"
            }
          }
          remove = {
            url = "/guide/permission_groups/{permissionGroupId}"
            method = "delete"
            urlParamsToFields = {
              permissionGroupId = "id"
            }
          }
        }
      }
      user_segments = {
        request = {
          url = "/help_center/user_segments"
        }
        transformation = {
          dataField = "user_segments"
        }
      }
      user_segment = {
        transformation = {
          sourceTypeName = "user_segments__user_segments"
          fieldsToHide = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "number"
            },
            {
              fieldName = "added_user_ids"
              fieldType = "unknown"
            },
          ]
          serviceUrl = "/knowledge/user_segments/edit/{id}"
        }
        deployRequests = {
          add = {
            url = "/help_center/user_segments"
            deployAsField = "user_segment"
            method = "post"
          }
          modify = {
            url = "/help_center/user_segments/{userSegmentId}"
            method = "put"
            deployAsField = "user_segment"
            urlParamsToFields = {
              userSegmentId = "id"
            }
          }
          remove = {
            url = "/help_center/user_segments/{userSegmentId}"
            method = "delete"
            urlParamsToFields = {
              userSegmentId = "id"
            }
          }
        }
      }
    }
    supportedTypes = {
      account_setting = [
        "account_settings",
      ]
      app_installation = [
        "app_installations",
      ]
      app_owned = [
        "apps_owned",
      ]
      automation = [
        "automations",
      ]
      brand = [
        "brands",
      ]
      business_hours_schedule = [
        "business_hours_schedules",
      ]
      custom_role = [
        "custom_roles",
      ]
      dynamic_content_item = [
        "dynamic_content_item",
      ]
      group = [
        "groups",
      ]
      locale = [
        "locales",
      ]
      macro_categories = [
        "macro_categories",
      ]
      macro = [
        "macros",
      ]
      monitored_twitter_handle = [
        "monitored_twitter_handles",
      ]
      oauth_client = [
        "oauth_clients",
      ]
      oauth_global_client = [
        "oauth_global_clients",
      ]
      organization = [
        "organizations",
      ]
      organization_field = [
        "organization_fields",
      ]
      resource_collection = [
        "resource_collections",
      ]
      routing_attribute = [
        "routing_attributes",
      ]
      sharing_agreement = [
        "sharing_agreements",
      ]
      sla_policy = [
        "sla_policies",
      ]
      support_address = [
        "support_addresses",
      ]
      target = [
        "targets",
      ]
      ticket_field = [
        "ticket_fields",
      ]
      ticket_form = [
        "ticket_forms",
      ]
      trigger_category = [
        "trigger_categories",
      ]
      trigger_definition = [
        "trigger_definitions",
      ]
      trigger = [
        "triggers",
      ]
      user_field = [
        "user_fields",
      ]
      view = [
        "views",
      ]
      webhook = [
        "webhooks",
      ]
      workspace = [
        "workspaces",
      ]
    }
  }
}
```
