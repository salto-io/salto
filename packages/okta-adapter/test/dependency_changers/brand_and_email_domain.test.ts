/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ChangeDataType, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { addedEmailDomainAfterAddedBrand } from '../../src/dependency_changers/brand_and_email_domain'
import { BRAND_TYPE_NAME, EMAIL_DOMAIN_TYPE_NAME, OKTA } from '../../src/constants'

describe('addedEmailDomainAfterAddedBrand', () => {
  const emailDomainType = new ObjectType({ elemID: new ElemID(OKTA, EMAIL_DOMAIN_TYPE_NAME) })
  const emailDomain = new InstanceElement('emailDomain', emailDomainType)
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })
  const brand = new InstanceElement('brand', brandType, {
    emailDomainId: new ReferenceExpression(emailDomain.elemID),
  })
  const unrelatedBrand = new InstanceElement('unrelatedBrand', brandType)

  it('should reverse the dependency order for email domain and brand additions', async () => {
    const changes = new Map<string, Change<ChangeDataType>>([
      ['brand', { action: 'add', data: { after: brand } }],
      ['unrelatedBrand', { action: 'add', data: { after: unrelatedBrand } }],
      ['emailDomain', { action: 'add', data: { after: emailDomain } }],
    ])
    const dependencyChanges = await addedEmailDomainAfterAddedBrand(changes, new Map())
    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges).toContainEqual({
      action: 'remove',
      dependency: { source: 'brand', target: 'emailDomain' },
    })
    expect(dependencyChanges).toContainEqual({ action: 'add', dependency: { source: 'emailDomain', target: 'brand' } })
  })

  it('should not reverse the dependency order for email domain and brand for non-additions', async () => {
    const changes = new Map<string, Change<ChangeDataType>>([
      ['brand', { action: 'modify', data: { before: brand, after: brand } }],
      ['unrelatedBrand', { action: 'add', data: { after: unrelatedBrand } }],
      ['emailDomain', { action: 'add', data: { after: emailDomain } }],
    ])
    const dependencyChanges = await addedEmailDomainAfterAddedBrand(changes, new Map())
    expect(dependencyChanges).toHaveLength(0)
  })
})
