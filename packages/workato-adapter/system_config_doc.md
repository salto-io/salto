# Workato system configuration

## Default Configuration

```hcl
workato {
  apiDefinitions = {
    typeDefaults = {
      transformation = {
        idFields = [
          "name",
        ]
        fieldsToOmit = [
          {
            fieldName = "created_at"
            fieldType = "string"
          },
          {
            fieldName = "updated_at"
            fieldType = "string"
          },
          {
            fieldName = "extended_input_schema"
          },
          {
            fieldName = "extended_output_schema"
          },
        ]
        serviceIdField = "id"
      }
    }
    types = {
      connection = {
        request = {
          url = "/connections"
        }
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "authorized_at"
              fieldType = "string"
            },
            {
              fieldName = "authorization_status"
              fieldType = "string"
            },
          ]
        }
      }
      recipe = {
        request = {
          url = "/recipes"
          paginationField = "since_id"
        }
        transformation = {
          idFields = [
            "name",
            "&folder_id",
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
            {
              fieldName = "user_id"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "created_at"
              fieldType = "string"
            },
            {
              fieldName = "updated_at"
              fieldType = "string"
            },
            {
              fieldName = "extended_input_schema"
            },
            {
              fieldName = "extended_output_schema"
            },
            {
              fieldName = "last_run_at"
            },
            {
              fieldName = "job_succeeded_count"
            },
            {
              fieldName = "job_failed_count"
            },
            {
              fieldName = "copy_count"
            },
            {
              fieldName = "lifetime_task_count"
            },
          ]
          standaloneFields = [
            {
              fieldName = "code"
              parseJSON = true
            },
          ]
        }
      }
      recipe__code = {
        transformation = {
          idFields = [
          ]
          extendsParentId = true
        }
      }
      folder = {
        request = {
          url = "/folders"
          recursiveQueryByResponseField = {
            parent_id = "id"
          }
          paginationField = "page"
        }
        transformation = {
          idFields = [
            "name",
            "&parent_id",
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      api_collection = {
        request = {
          url = "/api_collections"
          paginationField = "page"
        }
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      api_endpoint = {
        request = {
          url = "/api_endpoints"
          paginationField = "page"
        }
        transformation = {
          idFields = [
            "name",
            "base_path",
          ]
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      api_client = {
        request = {
          url = "/api_clients"
          paginationField = "page"
        }
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      api_access_profile = {
        request = {
          url = "/api_access_profiles"
          paginationField = "page"
        }
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      role = {
        request = {
          url = "/roles"
        }
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
            },
          ]
        }
      }
      property = {
        request = {
          url = "/properties"
          queryParams = {
            prefix = ""
          }
        }
        transformation = {
          hasDynamicFields = true
          isSingleton = true
        }
      }
    }
    supportedTypes = {
      api_access_profile = [
        "api_access_profile",
      ]
      api_client = [
        "api_client",
      ]
      api_endpoint = [
        "api_endpoint",
      ]
      api_collection = [
        "api_collection",
      ]
      connection = [
        "connection",
      ]
      folder = [
        "folder",
      ]
      property = [
        "property",
      ]
      recipe = [
        "recipe",
      ]
      role = [
        "role",
      ]
    }
  }
}
```
