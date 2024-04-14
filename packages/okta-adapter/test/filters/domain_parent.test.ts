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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import domainParentFilter from '../../src/filters/domain_parent'
import { DOMAIN_TYPE_NAME, OKTA, BRAND_TYPE_NAME } from '../../src/constants'
import { getFilterParams } from '../utils'

describe('domainParentFilter', () => {
  it('should set the parent of the domain to be the brand', async () => {
    const brandType = new ObjectType({ elemID: new ElemID(OKTA, BRAND_TYPE_NAME) })
    const brand = new InstanceElement('brand', brandType, {})

    const domainType = new ObjectType({ elemID: new ElemID(OKTA, DOMAIN_TYPE_NAME) })
    const domain = new InstanceElement('domain', domainType, {
      brandId: new ReferenceExpression(brand.elemID, brand),
    })

    const filter = domainParentFilter(getFilterParams({}))
    filter.onFetch?.([domain])
    expect(domain.annotations).toHaveProperty('_parent', [new ReferenceExpression(brand.elemID, brand)])
  })
})
