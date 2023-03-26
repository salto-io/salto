/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { filterUtils } from '@salto-io/adapter-components'
import urlReferenceExpressionFilter from '../../src/filters/url_reference_expression'
import { BRAND_TYPE_NAME, TARGET_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { createMissingInstance } from '../../src/filters/references/missing_references'

const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
const targetType = new ObjectType({ elemID: new ElemID(ZENDESK, TARGET_TYPE_NAME) })

describe('urlReferenceExpression', () => {
  const brand = new InstanceElement('brand', brandType, { brand_url: 'https://testBrand.zendesk.com' })
  const filter = urlReferenceExpressionFilter(createFilterCreatorParams({})) as filterUtils.FilterWith<'onFetch'>

  it('should convert the url to the correct template expression', async () => {
    const target = new InstanceElement('target', targetType,
      {
        url: 'https://testBrand.zendesk.com/api/v2/targets/123.json',
      })

    const elements = [brand, target]
    await filter.onFetch(elements)

    expect(target.value.url).toMatchObject({ parts: [
      new ReferenceExpression(brand.elemID, brand),
      '/api/v2/targets/',
      new ReferenceExpression(target.elemID, target),
      '.json',
    ] })
  })
  it('should do nothing if url doesn\'t match the expected format', async () => {
    const target = new InstanceElement('target', targetType,
      {
        url: 'badFormatUrl',
      })

    const elements = [brand, target]
    await filter.onFetch(elements)

    expect(target.value.url).toBe('badFormatUrl')
  })
  it('should create a missing reference if the brand is not found', async () => {
    const target = new InstanceElement('target', targetType,
      {
        url: 'https://badBrand.zendesk.com/api/v2/targets/123.json',
      })

    const elements = [brand, target]
    await filter.onFetch(elements)

    const missingBrand = createMissingInstance(ZENDESK, BRAND_TYPE_NAME, 'https://badBrand.zendesk.com')
    expect(target.value.url).toMatchObject({ parts: [
      new ReferenceExpression(missingBrand.elemID, missingBrand),
      '/api/v2/targets/',
      new ReferenceExpression(target.elemID, target),
      '.json',
    ] })
  })
  it('should not create a missing reference if the brand is not found and enableMissingReferences is disabled', async () => {
    const config = { ...DEFAULT_CONFIG }
    config[FETCH_CONFIG].enableMissingReferences = false
    const filterWithoutMissingReference = urlReferenceExpressionFilter(createFilterCreatorParams({ config })) as filterUtils.FilterWith<'onFetch'>
    const target = new InstanceElement('target', targetType,
      {
        url: 'https://badBrand.zendesk.com/api/v2/targets/123.json',
      })

    const elements = [brand, target]
    await filterWithoutMissingReference.onFetch(elements)

    expect(target.value.url).toMatchObject({ parts: [
      'https://badBrand.zendesk.com',
      '/api/v2/targets/',
      new ReferenceExpression(target.elemID, target),
      '.json',
    ] })
  })
})
