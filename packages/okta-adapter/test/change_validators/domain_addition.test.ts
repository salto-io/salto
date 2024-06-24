/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { domainAdditionValidator } from '../../src/change_validators/domain_addition'
import { OKTA, DOMAIN_TYPE_NAME, BRAND_TYPE_NAME } from '../../src/constants'

describe('domainAdditionValidator', () => {
  const domainType = new ObjectType({ elemID: new ElemID(OKTA, DOMAIN_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })

  it('should return an error when adding a domain without a brand', async () => {
    const domain = new InstanceElement('mydomain', domainType, { domain: 'subdomain.example.com' })
    expect(await domainAdditionValidator([toChange({ after: domain })])).toEqual([
      {
        elemID: domain.elemID,
        severity: 'Error',
        message: 'Cannot add domain without a brand',
        detailedMessage: 'Cannot add domain without a brand',
      },
    ])
  })
  it('should not return an error when adding a domain with a brand', async () => {
    const brand = new InstanceElement('mybrand', brandType, {})
    const domain = new InstanceElement('mydomain', domainType, {
      domain: 'subdomain.example.com',
      brandId: new ReferenceExpression(brand.elemID, brand),
    })
    expect(await domainAdditionValidator([toChange({ after: domain })])).toEqual([])
  })
})
