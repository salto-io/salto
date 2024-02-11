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
import { getConfigWithDefault } from '../../src/config'

describe('config_shared', () => {
  describe('getConfigWithDefault', () => {
    it('should return the config with defaults for adapter api when type-specific config is provided', () => {
      expect(getConfigWithDefault(
        { url: 'abc', queryParams: { a: 'specific' } },
        { paginationField: 'page', queryParams: { b: 'default' } }
      )).toEqual({ url: 'abc', queryParams: { a: 'specific' }, paginationField: 'page' })
      expect(getConfigWithDefault(
        { standaloneFields: [{ fieldName: 'specific' }] },
        { idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] },
      )).toEqual({ idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'specific' }] })
    })
    it('should return the config with defaults for adapter api  when type-specific config is missing', () => {
      expect(getConfigWithDefault(
        undefined,
        { paginationField: 'page', queryParams: { b: 'default' } }
      )).toEqual({ paginationField: 'page', queryParams: { b: 'default' } })
      expect(getConfigWithDefault(
        undefined,
        { idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] },
      )).toEqual({ idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] })
    })
  })
})
