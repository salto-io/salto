# SAP system configuration
## Default Configuration for single environment
```hcl
sap {
  apiDefinitions = {
    typeDefaults = {
      transformation = {
        idFields = [
          "name",
          "id",
        ]
      }
    }
    types = {
      view = {
        transformation = {
          idFields = [
            "title",
            "id",
          ]
        }
      }
      trigger = {
        transformation = {
          idFields = [
            "title",
            "id",
          ]
        }
      }
      automation = {
        transformation = {
          idFields = [
            "title",
            "id",
          ]
        }
      }
      sla_policy = {
        transformation = {
          idFields = [
            "title",
            "id",
          ]
        }
      }
      target = {
        transformation = {
          idFields = [
            "title",
            "type",
            "id",
          ]
        }
      }
      macro = {
        transformation = {
          idFields = [
            "title",
            "id",
          ]
        }
      }
      locale = {
        transformation = {
          idFields = [
            "locale",
            "id",
          ]
        }
      }
      ticket_field = {
        transformation = {
          idFields = [
            "title",
            "type",
            "id",
          ]
        }
      }
      workspace = {
        transformation = {
          idFields = [
            "title",
            "id",
          ]
        }
      }
      app_installation = {
        transformation = {
          idFields = [
            "settings.name",
            "app_id",
            "id",
          ]
        }
      }
    }
  }
}
```
