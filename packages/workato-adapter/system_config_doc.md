# Workato system configuration
## Default Configuration
```hcl
workato {
  fetch = {
    includeTypes = [
      "api_access_profile",
      "api_client",
      "api_collection",
      "api_endpoint",
      "connection",
      "folder",
      "property",
      "recipe",
      "role",
    ]
  }
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
      }
    }
    types = {
      connection = {
        request = {
          url = "/connections"
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
            "id",
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
          ]
          standaloneFields = [
            {
              fieldName = "code"
              parseJSON = true
            },
          ]
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
            "parent_id",
          ]
        }
      }
      api_collection = {
        request = {
          url = "/api_collections"
          paginationField = "page"
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
        }
      }
      api_client = {
        request = {
          url = "/api_clients"
          paginationField = "page"
        }
      }
      api_access_profile = {
        request = {
          url = "/api_access_profiles"
          paginationField = "page"
        }
      }
      role = {
        request = {
          url = "/roles"
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
        }
      }
    }
  }
}
```
