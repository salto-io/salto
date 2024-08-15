/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { HTTPError } from '../../src/client'
import { getInsufficientPermissionsError } from '../../src/fetch/errors'

describe('getInsufficientPermissionsError', () => {
  beforeEach(() => {
    expect(getInsufficientPermissionsError).toBeDefined()
    expect(getInsufficientPermissionsError).toMatchObject({
      custom: expect.any(Function),
      action: 'failEntireFetch',
      value: false,
    })
  })

  describe('custom', () => {
    const customFn = getInsufficientPermissionsError?.custom?.({})

    it('should return customSaltoError when HTTPError with status 403', () => {
      const error = new HTTPError('error', { data: {}, status: 403 })
      const typeName = 'myType'
      const result = customFn?.({ error, typeName })
      expect(result).toEqual({
        action: 'customSaltoError',
        value: {
          message: `Salto could not access the ${typeName} resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource`,
          severity: 'Info',
        },
      })
    })

    it('should return failEntireFetch false when other error', () => {
      const error = new Error('An error occurred')
      const typeName = 'myType'
      const result = customFn?.({ error, typeName })
      expect(result).toEqual({ action: 'failEntireFetch', value: false })
    })
  })
})
