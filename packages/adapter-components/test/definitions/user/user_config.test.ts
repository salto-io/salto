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
import { BuiltinTypes } from '@salto-io/adapter-api'
import { createUserConfigType } from '../../../src/definitions/user'

describe('config_shared', () => {
  describe('createUserConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserConfigType({ adapterName: 'myAdapter' })
      expect(Object.keys(type.fields)).toHaveLength(3)
      expect(type.fields.client).toBeDefined()
      expect(type.fields.fetch).toBeDefined()
      expect(type.fields.deploy).toBeDefined()
    })
    it('should add custom fields', () => {
      const type = createUserConfigType({
        adapterName: 'myAdapter',
        additionalFields: { extra: { refType: BuiltinTypes.BOOLEAN } },
      })
      expect(Object.keys(type.fields)).toHaveLength(4)
      expect(type.fields.client).toBeDefined()
      expect(type.fields.fetch).toBeDefined()
      expect(type.fields.deploy).toBeDefined()
      expect(type.fields.extra).toBeDefined()
    })
  })
})
