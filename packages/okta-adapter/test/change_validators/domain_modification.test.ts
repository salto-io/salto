/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { domainModificationValidator } from '../../src/change_validators/domain_modification'
import { OKTA, DOMAIN_TYPE_NAME, BRAND_TYPE_NAME } from '../../src/constants'

describe('domainModificationValidator', () => {
  const domainType = new ObjectType({ elemID: new ElemID(OKTA, DOMAIN_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })

  it('should return an error when modifying any domain field except brandId', async () => {
    const subdomain1 = new InstanceElement('mydomain', domainType, { domain: 'subdomain1.example.com' })
    const subdomain2 = new InstanceElement('mydomain', domainType, { domain: 'subdomain2.example.com' })

    expect(await domainModificationValidator([toChange({ before: subdomain1, after: subdomain2 })])).toEqual([
      {
        elemID: subdomain1.elemID,
        severity: 'Error',
        message: 'Cannot modify any domain fields except its brand',
        detailedMessage: 'Domain subdomain1.example.com can only modify its brand.',
      },
    ])
  })

  it("should not return an error when only modifying a domain's brand", async () => {
    const brand1 = new InstanceElement('brand1', brandType, {})
    const brand2 = new InstanceElement('brand2', brandType, {})
    const domainWithBrand1 = new InstanceElement('mydomain', domainType, {
      domain: 'subdomain.example.com',
      brandId: new ReferenceExpression(brand1.elemID, brand1),
    })
    const domainWithBrand2 = new InstanceElement('mydomain', domainType, {
      domain: 'subdomain.example.com',
      brandId: new ReferenceExpression(brand2.elemID, brand2),
    })

    expect(
      await domainModificationValidator([
        toChange({
          before: domainWithBrand1,
          after: domainWithBrand2,
        }),
      ]),
    ).toEqual([])
  })

  it("should return an error when modifying a domain's brand and another field", async () => {
    const brand1 = new InstanceElement('brand1', brandType, {})
    const brand2 = new InstanceElement('brand2', brandType, {})
    const domainWithBrand1 = new InstanceElement('mydomain', domainType, {
      domain: 'subdomain.example.com',
      brandId: new ReferenceExpression(brand1.elemID, brand1),
      certificateSourceType: 'MANUAL',
    })
    const domainWithBrand2 = new InstanceElement('mydomain', domainType, {
      domain: 'subdomain.example.com',
      brandId: new ReferenceExpression(brand2.elemID, brand2),
    })

    expect(
      await domainModificationValidator([
        toChange({
          before: domainWithBrand1,
          after: domainWithBrand2,
          certificateSourceType: 'OKTA_MANAGED',
        }),
      ]),
    ).toEqual([
      {
        elemID: domainWithBrand1.elemID,
        severity: 'Error',
        message: 'Cannot modify any domain fields except its brand',
        detailedMessage: 'Domain subdomain.example.com can only modify its brand.',
      },
    ])
  })
})
