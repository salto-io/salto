/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { INCLUDE_ALL_CONFIG } from '../../src/fetch/query'
import { createCommonFilters } from '../../src/filters/common_filters'
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../src/client'
import { noPagination } from '../../src/fetch/request/pagination'

describe('common filters', () => {
  let client: MockInterface<HTTPReadClientInterface & HTTPWriteClientInterface>

  beforeEach(async () => {
    jest.clearAllMocks()
    client = {
      get: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['get']>(),
      put: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['put']>(),
      patch: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['patch']>(),
      post: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['post']>(),
      delete: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['delete']>(),
      head: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['head']>(),
      options: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['options']>(),
      getPageSize: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['getPageSize']>(),
    }
  })

  describe('createCommonFilters', () => {
    it('should create the common filters', () => {
      const filters = createCommonFilters({
        adapterName: 'myAdapter',
        referenceRules: [],
        config: {
          fetch: {
            ...INCLUDE_ALL_CONFIG,
          },
        },
        definitions: {
          clients: {
            default: 'main',
            options: {
              main: {
                httpClient: client,
                endpoints: {
                  default: {
                    get: {
                      readonly: true,
                    },
                  },
                  customizations: {},
                },
              },
            },
          },
          pagination: {
            none: {
              funcCreator: noPagination,
            },
          },
          deploy: {
            instances: {
              customizations: {
                myType: {
                  requestsByAction: {
                    customizations: {
                      add: [],
                    },
                  },
                },
              },
            },
          },
        },
      })
      expect(Object.keys(filters).sort()).toEqual([
        'addAlias',
        'defaultDeploy',
        'fieldReferencesFilter',
        'hideTypes',
        'omitCollisions',
        'query',
        'referencedInstanceNames',
        'serviceUrl',
        'sortListsFilter',
      ])
    })
  })
})
