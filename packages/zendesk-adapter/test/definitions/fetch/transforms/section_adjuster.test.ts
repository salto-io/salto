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
import { transformSectionItem } from '../../../../src/definitions/fetch/transforms'

describe('section_adjuster', () => {
  it('should add brand and section values correctly when parent_section_id is undefined', async () => {
    const context = {
      brandId: 123,
    }
    const value = {
      a: 1,
      category_id: 11,
    }
    const finalValue = await transformSectionItem({ value, context, typeName: 'section' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
        brand: 123,
        category_id: 11,
        direct_parent_id: 11,
        direct_parent_type: 'category',
      },
    })
  })
  it('should add brand and section values correctly when parent_section_id is defined', async () => {
    const context = {
      brandId: 123,
    }
    const value = {
      a: 1,
      category_id: 11,
      parent_section_id: 112,
    }
    const finalValue = await transformSectionItem({ value, context, typeName: 'section' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
        brand: 123,
        category_id: 11,
        direct_parent_id: 112,
        parent_section_id: 112,
        direct_parent_type: 'section',
      },
    })
  })
  it('should do nothing if typeName is not a section', async () => {
    const context = {
      brandId: 123,
    }
    const value = {
      a: 1,
      category_id: 11,
    }
    const finalValue = await transformSectionItem({ value, context, typeName: 'test' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
        brand: 123,
        category_id: 11,
      },
    })
  })
})
