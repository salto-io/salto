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
import { createUserFetchConfigType } from '../../../src/definitions/user'

describe('config_shared', () => {
  describe('createUserFetchConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserFetchConfigType({ adapterName: 'myAdapter' })
      expect(Object.keys(type.fields)).toHaveLength(5)
      expect(type.fields.include).toBeDefined()
      expect(type.fields.exclude).toBeDefined()
      expect(type.fields.hideTypes).toBeDefined()
      expect(type.fields.asyncPagination).toBeDefined()
      expect(type.fields.elemID).toBeDefined()
    })
    it('should not add elem id when flag is set', () => {
      const type = createUserFetchConfigType({ adapterName: 'myAdapter', omitElemID: true })
      expect(Object.keys(type.fields)).toHaveLength(4)
      expect(type.fields.include).toBeDefined()
      expect(type.fields.exclude).toBeDefined()
      expect(type.fields.hideTypes).toBeDefined()
      expect(type.fields.asyncPagination).toBeDefined()
    })
  })
})
