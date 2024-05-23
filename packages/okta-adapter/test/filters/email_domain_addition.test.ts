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

import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { OKTA, EMAIL_DOMAIN_TYPE_NAME, BRAND_TYPE_NAME } from '../../src/constants'
import emailDomainAdditionFilter from '../../src/filters/email_domain_addition'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'

describe('emailDomainAddition', () => {
  const emailDomainType = new ObjectType({ elemID: new ElemID(OKTA, EMAIL_DOMAIN_TYPE_NAME) })
  const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })
  const emailDomain = new InstanceElement('mydomain', emailDomainType, { name: 'mail.example.com' })
  const emailDomainRef = new ReferenceExpression(emailDomain.elemID, emailDomain)

  describe('deploy', () => {
    it('should successfully deploy addition email domain with a modified brand that uses it', async () => {
      const brandBefore = new InstanceElement('mybrand', brandType, { id: 'myBrandId123' })
      const brandAfter = brandBefore.clone()
      brandAfter.value.emailDomainId = emailDomainRef

      const changes = [
        toChange({ after: emailDomain }),
        toChange({ before: brandBefore, after: brandAfter })
      ]
      const elementsSource = buildElementsSourceFromElements([emailDomain, brandAfter])
      await emailDomainAdditionFilter({ elementsSource })?.preDeploy(changes)

      expect(emailDomain.value.brandId).toEqual('myBrandId123')
    })

    it('should successfully deploy addition email domain with multiple brands that use it', async () => {
      const brand1 = new InstanceElement('mybrand1', brandType, { id: 'myBrandId1', emailDomainId: emailDomainRef })
      const brand2 = new InstanceElement('mybrand2', brandType, { id: 'myBrandId2', emailDomainId: emailDomainRef })

      const changes = [
        toChange({ after: emailDomain }),
        toChange({ after: brand1 }),
        toChange({ after: brand2 }),
      ]

      const elementsSource = buildElementsSourceFromElements([emailDomain, brand1, brand2])
      await emailDomainAdditionFilter({ elementsSource })?.preDeploy(changes)

      expect(emailDomain.value.brandId).toEqual('myBrandId1')
    })

    it('should throw if no rand uses the new email domain', async () => {
      const changes = [
        toChange({ after: emailDomain }),
      ]
      const elementsSource = buildElementsSourceFromElements([emailDomain])
      await expect(async () => {await emailDomainAdditionFilter({ elementsSource })?.preDeploy(changes)}).rejects.toThrow()
    })
  })
})
