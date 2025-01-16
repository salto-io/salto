/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { isSaltoError } from '../src/error'
import { ElemID } from '../src/element_id'
import { toChange } from '../src/change'
import { InstanceElement, ObjectType } from '../src/elements'

describe('isSaltoError', () => {
  const elemID = new ElemID('adapter', 'test')
  const instance = new InstanceElement('inst', new ObjectType({ elemID }), {})
  const change = toChange({ after: instance })
  it('should return false for non saltoErrors', () => {
    expect(isSaltoError(elemID)).toBeFalsy()
    expect(isSaltoError(instance)).toBeFalsy()
    expect(isSaltoError(change)).toBeFalsy()
  })
  it('should return true for saltoErrors', () => {
    expect(isSaltoError({ message: 'test', detailedMessage: 'test', severity: 'Error', elemID })).toBeTruthy()
  })
  it('should return false for Errors', () => {
    expect(isSaltoError(new Error('test'))).toBeFalsy()
  })
})
