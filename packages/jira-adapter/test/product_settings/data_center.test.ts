/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { DATA_CENTER_SETTINGS } from '../../src/product_settings/data_center/data_center'

describe('dataCenter settings', () => {
  describe('wrapConnection', () => {
    let apiConnection: MockInterface<client.APIConnection>
    let wrappedApiConnection: client.APIConnection
    beforeEach(() => {
      apiConnection = {
        get: mockFunction<client.APIConnection['get']>(),
        head: mockFunction<client.APIConnection['head']>(),
        options: mockFunction<client.APIConnection['options']>(),
        post: mockFunction<client.APIConnection['post']>(),
        put: mockFunction<client.APIConnection['put']>(),
        delete: mockFunction<client.APIConnection['delete']>(),
        patch: mockFunction<client.APIConnection['patch']>(),
      }

      wrappedApiConnection = DATA_CENTER_SETTINGS.wrapConnection(apiConnection)
    })
    it('should replace rest version from 3 to 2', async () => {
      await wrappedApiConnection.get('/rest/api/3/test')
      await wrappedApiConnection.post('/rest/api/3/test', 'data')
      await wrappedApiConnection.put('/rest/api/3/test', 'data')
      await wrappedApiConnection.delete('/rest/api/3/test')
      await wrappedApiConnection.patch('/rest/api/3/test', 'data')
      expect(apiConnection.get).toHaveBeenCalledWith('/rest/api/2/test', undefined)
      expect(apiConnection.post).toHaveBeenCalledWith('/rest/api/2/test', 'data', undefined)
      expect(apiConnection.put).toHaveBeenCalledWith('/rest/api/2/test', 'data', undefined)
      expect(apiConnection.delete).toHaveBeenCalledWith('/rest/api/2/test', undefined)
      expect(apiConnection.patch).toHaveBeenCalledWith('/rest/api/2/test', 'data', undefined)
    })

    it('should replace plugin urls', async () => {
      await wrappedApiConnection.get('/rest/api/3/workflowscheme')
      await wrappedApiConnection.post('/rest/api/3/workflowscheme', 'data')
      expect(apiConnection.get).toHaveBeenCalledWith('/rest/salto/1.0/workflowscheme', undefined)
      expect(apiConnection.post).toHaveBeenCalledWith('/rest/api/2/workflowscheme', 'data', undefined)
    })

    it('should not replace other versions', async () => {
      await wrappedApiConnection.get('/rest/api/1/test')
      await wrappedApiConnection.post('/rest/api/1/test', 'data')
      await wrappedApiConnection.put('/rest/api/1/test', 'data')
      await wrappedApiConnection.delete('/rest/api/1/test')
      await wrappedApiConnection.patch('/rest/api/1/test', 'data')
      expect(apiConnection.get).toHaveBeenCalledWith('/rest/api/1/test', undefined)
      expect(apiConnection.post).toHaveBeenCalledWith('/rest/api/1/test', 'data', undefined)
      expect(apiConnection.put).toHaveBeenCalledWith('/rest/api/1/test', 'data', undefined)
      expect(apiConnection.delete).toHaveBeenCalledWith('/rest/api/1/test', undefined)
      expect(apiConnection.patch).toHaveBeenCalledWith('/rest/api/1/test', 'data', undefined)
    })
  })
})
