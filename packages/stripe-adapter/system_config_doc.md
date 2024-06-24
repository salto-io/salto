# Stripe system configuration

## Default Configuration

```hcl
stripe {
  apiDefinitions = {
    swagger = {
      url = "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml"
      typeNameOverrides = [
        {
          originalName = "v1__country_specs"
          newName = "country_specs"
        },
        {
          originalName = "v1__coupons"
          newName = "coupons"
        },
        {
          originalName = "v1__prices"
          newName = "prices"
        },
        {
          originalName = "v1__products"
          newName = "products"
        },
        {
          originalName = "v1__reporting__report_types"
          newName = "reporting__report_types"
        },
        {
          originalName = "v1__tax_rates"
          newName = "tax_rates"
        },
        {
          originalName = "v1__webhook_endpoints"
          newName = "webhook_endpoints"
        },
      ]
    }
    typeDefaults = {
      transformation = {
        idFields = [
          "id",
        ]
        fieldsToOmit = [
          {
            fieldName = "object"
            fieldType = "string"
          },
          {
            fieldName = "created"
            fieldType = "number"
          },
          {
            fieldName = "updated"
            fieldType = "number"
          },
        ]
      }
    }
    types = {
      coupon = {
        transformation = {
          idFields = [
            "name",
            "duration",
            "id",
          ]
        }
      }
      products = {
        request = {
          url = "/v1/products"
          recurseInto = [
            {
              type = "prices"
              toField = "product_prices"
              context = [
                {
                  name = "productId"
                  fromField = "id"
                },
              ]
            },
          ]
        }
        transformation = {
          dataField = "data"
        }
      }
      product = {
        transformation = {
          idFields = [
            "name",
            "id",
          ]
          fieldTypeOverrides = [
            {
              fieldName = "product_prices"
              fieldType = "list<price>"
            },
          ]
        }
      }
      prices = {
        request = {
          url = "/v1/prices?product={productId}"
        }
        transformation = {
          dataField = "data"
        }
      }
      reporting_report_type = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "data_available_end"
              fieldType = "number"
            },
            {
              fieldName = "data_available_start"
              fieldType = "number"
            },
          ]
        }
      }
      tax_rate = {
        transformation = {
          idFields = [
            "display_name",
            "id",
            "country",
            "percentage",
          ]
        }
      }
    }
    supportedTypes = {
      country_spec = [
        "country_specs",
      ]
      coupon = [
        "coupons",
      ]
      product = [
        "products",
      ]
      reporting__report_type = [
        "reporting__report_types",
      ]
      tax_rate = [
        "tax_rates",
      ]
      webhook_endpoint = [
        "webhook_endpoints",
      ]
    }
  }
}
```
