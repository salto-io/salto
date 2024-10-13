/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { BRAND_TYPE_NAME, EMAIL_DOMAIN_TYPE_NAME, OKTA } from '../../../../src/constants'
import { addBrandIdToRequest, findReferencingBrands } from '../../../../src/definitions/deploy/types/email_domain'

describe('email domain', () => {
  const emailDomainType = new ObjectType({
    elemID: new ElemID(OKTA, EMAIL_DOMAIN_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.SERVICE_ID },
    },
  })

  const brandType = new ObjectType({
    elemID: new ElemID(OKTA, BRAND_TYPE_NAME),
    fields: {
      emailDomainId: { refType: BuiltinTypes.SERVICE_ID },
    },
  })

  describe('findReferencingBrands', () => {
    it('should find all referencing brands', async () => {
      const emailDomain1 = new InstanceElement('emailDomain1', emailDomainType, { id: '1' })
      const emailDomain2 = new InstanceElement('emailDomain2', emailDomainType, { id: '2' })
      const emailDomain3 = new InstanceElement('emailDomain3', emailDomainType, { id: '3' })

      const domain1Brand1 = new InstanceElement('brand1', brandType, {
        id: '1',
        emailDomainId: new ReferenceExpression(emailDomain1.elemID, emailDomain1),
      })
      const domain1Brand2 = new InstanceElement('brand2', brandType, {
        id: '2',
        emailDomainId: new ReferenceExpression(emailDomain1.elemID, emailDomain1),
      })
      const domain2Brand1 = new InstanceElement('brand3', brandType, {
        id: '3',
        emailDomainId: new ReferenceExpression(emailDomain2.elemID, emailDomain2),
      })
      const elementSource = buildElementsSourceFromElements([
        emailDomain1,
        emailDomain2,
        domain1Brand1,
        domain1Brand2,
        domain2Brand1,
      ])
      await expect(findReferencingBrands(emailDomain1.elemID, elementSource)).resolves.toEqual([
        domain1Brand1,
        domain1Brand2,
      ])
      await expect(findReferencingBrands(emailDomain2.elemID, elementSource)).resolves.toEqual([domain2Brand1])
      await expect(findReferencingBrands(emailDomain3.elemID, elementSource)).resolves.toEqual([])
    })
  })

  describe('addBrandIdToRequest', () => {
    it('should add brand id to request', async () => {
      const emailDomain = new InstanceElement('emailDomain', emailDomainType, { id: '1' })
      const brand = new InstanceElement('brand', brandType, {
        id: 'brand-fakeid1',
        emailDomainId: new ReferenceExpression(emailDomain.elemID, emailDomain),
      })
      const context = {
        change: toChange({ before: emailDomain, after: emailDomain }) as ModificationChange<InstanceElement>,
        elementSource: buildElementsSourceFromElements([emailDomain, brand]),
        changeGroup: { groupID: '1', changes: [] },
        sharedContext: {},
        errors: {},
      }

      const value = {}
      await expect(addBrandIdToRequest({ value, context, typeName: EMAIL_DOMAIN_TYPE_NAME })).resolves.toHaveProperty(
        ['value', 'brandId'],
        'brand-fakeid1',
      )
    })
  })
})
