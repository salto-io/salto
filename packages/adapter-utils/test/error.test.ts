/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID } from '@salto-io/adapter-api'
import { createSaltoElementError, createSaltoElementErrorFromError } from '../src/error'

describe('create saltoElementError', () => {
  const elemId = new ElemID('adapter', 'test')
  it('should create correctly from error', () => {
    expect(
      createSaltoElementErrorFromError({
        error: new Error('test'),
        severity: 'Error',
        elemID: elemId,
      }),
    ).toEqual({
      message: 'test',
      detailedMessage: 'test',
      severity: 'Error',
      elemID: elemId,
    })
  })
  it('should create correctly from message', () => {
    expect(
      createSaltoElementError({
        message: 'test',
        detailedMessage: 'test',
        severity: 'Error',
        elemID: elemId,
      }),
    ).toEqual({
      message: 'test',
      detailedMessage: 'test',
      severity: 'Error',
      elemID: elemId,
    })
  })
})
