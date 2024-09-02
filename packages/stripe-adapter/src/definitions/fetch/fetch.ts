/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { Options } from '../types'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'id' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  object: {
    omit: true,
  },
  created: {
    omit: true,
  },
  updated: {
    omit: true,
  },
}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  coupon: {
    requests: [
      {
        endpoint: {
          path: '/v1/coupons',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'name' }, { fieldName: 'duration' }, { fieldName: 'id' }],
        },
      },
    },
  },
  product: {
    requests: [
      {
        endpoint: {
          path: '/v1/products',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        product_prices: {
          typeName: 'price',
          context: {
            args: {
              productId: {
                root: 'id',
              },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'name' }, { fieldName: 'id' }],
        },
      },
      fieldCustomizations: {
        product_prices: {
          fieldType: 'list<price>',
        },
      },
    },
  },
  price: {
    requests: [
      {
        endpoint: {
          path: '/v1/prices',
          queryArgs: {
            product: '{productId}',
          },
        },
        transformation: {
          root: 'data',
        },
      },
    ],
  },
  reporting_report_type: {
    requests: [
      {
        endpoint: {
          path: '/v1/reporting/report_types',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        data_available_end: {
          hide: true,
        },
        data_available_start: {
          hide: true,
        },
      },
    },
  },
  tax_rate: {
    requests: [
      {
        endpoint: {
          path: '/v1/tax_rates',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            { fieldName: 'display_name' },
            { fieldName: 'id' },
            { fieldName: 'country' },
            { fieldName: 'percentage' },
          ],
        },
      },
    },
  },
  country_spec: {
    requests: [
      {
        endpoint: {
          path: '/v1/country_specs',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
  webhook_endpoint: {
    requests: [
      {
        endpoint: {
          path: '/v1/webhook_endpoints',
        },
        transformation: {
          root: 'data',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
      },
    },
  },
})

export const createFetchDefinitions = (): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
