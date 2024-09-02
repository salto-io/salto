/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { emailDomainAdditionValidator } from '../../src/change_validators/email_domain_addition'
import { OKTA, EMAIL_DOMAIN_TYPE_NAME, BRAND_TYPE_NAME } from '../../src/constants'

describe('emailDomainAdditionValidator', () => {
  const emailDomainType = new ObjectType({ elemID: new ElemID(OKTA, EMAIL_DOMAIN_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })

  it('should return an error when adding an email domain without a brand', async () => {
    const emailDomain = new InstanceElement('mydomain', emailDomainType, { name: 'mail.example.com' })
    const elementSource = buildElementsSourceFromElements([emailDomain])
    expect(await emailDomainAdditionValidator([toChange({ after: emailDomain })], elementSource)).toEqual([
      {
        elemID: emailDomain.elemID,
        severity: 'Error',
        message: 'Cannot add email domain without at least one brand that uses it',
        detailedMessage: 'Cannot add email domain without at least one brand that uses it',
      },
    ])
  })

  it('should not return an error when adding an email domain with a brand', async () => {
    const emailDomain = new InstanceElement('mydomain', emailDomainType, {
      name: 'mail.example.com',
    })
    const brand = new InstanceElement('mybrand', brandType, {
      emailDomainId: new ReferenceExpression(emailDomain.elemID, emailDomain),
    })
    const elementSource = buildElementsSourceFromElements([emailDomain, brand])
    expect(await emailDomainAdditionValidator([toChange({ after: emailDomain })], elementSource)).toEqual([])
  })
})
