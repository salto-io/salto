/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isNotDeletedEmailDomain } from '../../../../src/definitions/fetch/types/email_domain'

describe('isNotDeletedEmailDomain', () => {
  const activeEmailDomain = {
    id: '111',
    validationStatus: 'ACTIVE',
  }
  const notStartedEmailDomain = {
    id: '111',
    validationStatus: 'ACTIVE',
  }
  const deletedEmailDomain = {
    id: '222',
    validationStatus: 'DELETED',
  }
  const noValidationStatusEmailDomain = {
    id: '333',
  }

  it('should return true when value is an EmailDomain with status ACTIVE', () => {
    expect(isNotDeletedEmailDomain(activeEmailDomain)).toBeTruthy()
    expect(isNotDeletedEmailDomain(notStartedEmailDomain)).toBeTruthy()
  })

  it('should return false when value is an EmailDomain with status DELETED', () => {
    expect(isNotDeletedEmailDomain(deletedEmailDomain)).toBeFalsy()
  })

  it('should return false when value is not an EmailDomain', () => {
    expect(isNotDeletedEmailDomain(noValidationStatusEmailDomain)).toBeFalsy()
  })
})
