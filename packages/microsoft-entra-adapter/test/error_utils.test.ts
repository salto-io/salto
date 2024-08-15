/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ElemID } from '@salto-io/adapter-api'
import { client } from '@salto-io/adapter-components'
import { customConvertError } from '../src/error_utils'

describe('customConvertError', () => {
  const elemID = new ElemID('testElemID')

  it('should return the error when it is SaltoElementError', () => {
    const error = {
      elemID: new ElemID('mock'),
      message: 'mock',
      name: 'mock',
      severity: 'Error',
      response: { data: { error: { message: 'response message' } } },
    } as Error

    const result = customConvertError(elemID, error)
    expect(result).toEqual(error)
  })

  describe('Http error', () => {
    it('should concat the message from the error response, when error is HTTPError', () => {
      const error = new client.HTTPError('mock', {
        data: { error: { message: 'response message' } },
        status: 403,
      })

      const result = customConvertError(elemID, error)
      expect(result).toEqual({
        message: 'mock: response message',
        severity: 'Error',
        elemID,
      })
    })

    it('should return error.message when error has no message in the response', () => {
      const error = new client.HTTPError('mock', {
        data: { error: { otherField: 'not a response message' } },
        status: 403,
      })

      const result = customConvertError(elemID, error)
      expect(result).toEqual({
        message: 'mock',
        severity: 'Error',
        elemID,
      })
    })
  })
})
