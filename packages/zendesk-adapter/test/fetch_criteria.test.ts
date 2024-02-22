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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import fetchCriteria from '../src/fetch_criteria'

describe('fetch_criteria', () => {
  describe('name', () => {
    it('should match element name', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
      })

      expect(fetchCriteria.name({ instance, value: '.ame' })).toBeTruthy()
      expect(fetchCriteria.name({ instance, value: 'ame' })).toBeFalsy()
    })
  })
})
