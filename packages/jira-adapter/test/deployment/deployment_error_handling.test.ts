/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client } from '@salto-io/adapter-components'
import { handleDeploymentError } from '../../src/deployment/deployment_error_handling'

describe('handleDeploymentError', () => {
  let error: Error | undefined
  it('should change message', async () => {
    error = new client.HTTPError('error', {
      status: 400,
      data: { errorMessages: ['error1', 'error2'], errors: { some_key: 'some value' } },
    })
    const result = handleDeploymentError(error).message
    expect(result).toEqual('error. error1, error2, {"some_key":"some value"}')
  })
  it('should keep the same message', async () => {
    error = new Error('error')
    const result = handleDeploymentError(error).message
    expect(result).toEqual('error')
  })
})
