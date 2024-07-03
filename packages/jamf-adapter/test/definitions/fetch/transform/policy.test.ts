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
import { adjustPolicy } from '../../../../src/definitions/fetch/transforms'

describe('adjust policy', () => {
  it('should throw an error if value is not a record', async () => {
    await expect(adjustPolicy({ value: 'not a record', context: {}, typeName: 'policy' })).rejects.toThrow()
  })
  describe('adjustCategoryObjectToCategoryId', () => {
    it('should convert category object to category id', async () => {
      const value = {
        a: 'a',
        general: { category: { id: 'category-id', anotherField: 'bla' } },
        b: 'b',
      }
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
        value: {
          a: 'a',
          general: { category: 'category-id' },
          b: 'b',
        },
      })
    })
  })
  describe('adjustSiteObjectToSiteId', () => {
    it('should convert site object to site id', async () => {
      const value = {
        a: 'a',
        general: { site: { id: 'site-id', anotherField: 'bla' } },
        b: 'b',
      }
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
        value: {
          a: 'a',
          general: { site: 'site-id' },
          b: 'b',
        },
      })
    })
  })
  describe('adjustScriptsObjectArrayToScriptsIds', () => {
    it('should convert scripts object array to scripts ids', async () => {
      const value = {
        a: 'a',
        general: {},
        scripts: [{ id: 'script-id' }, { id: 'script-id2' }],
        b: 'b',
      }
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
        value: {
          a: 'a',
          general: {},
          scripts: ['script-id', 'script-id2'],
          b: 'b',
        },
      })
    })
  })
  describe('adjustServiceIdToTopLevel', () => {
    it('should extract id field from being under "general" field to be top level', async () => {
      const value = {
        a: 'a',
        general: { id: 'service-id', anotherField: 'bla' },
        b: 'b',
      }
      await expect(adjustPolicy({ value, context: {}, typeName: 'policy' })).resolves.toEqual({
        value: {
          a: 'a',
          id: 'service-id',
          general: { anotherField: 'bla' },
          b: 'b',
        },
      })
    })
  })
})
