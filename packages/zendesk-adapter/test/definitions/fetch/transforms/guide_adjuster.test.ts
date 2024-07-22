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
import { transformGuideItem } from '../../../../src/definitions/fetch/transforms'

describe('guide_adjuster', () => {
  const value = {
    a: 1,
  }
  it('should add brand correctly with brandId', async () => {
    const context = {
      brandId: 123,
    }
    const finalValue = await transformGuideItem({ value, context, typeName: 'test' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
        brand: 123,
      },
    })
  })
  it('should add brand correctly with parent brand id', async () => {
    const context = {
      parent: {
        brand: 123,
      },
    }
    const finalValue = await transformGuideItem({ value, context, typeName: 'test' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
        brand: 123,
      },
    })
  })
  it('should do nothing if brand is not defined', async () => {
    const context = {}
    const finalValue = await transformGuideItem({ value, context, typeName: 'test' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
      },
    })
  })
})
