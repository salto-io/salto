/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { customTypes } from '../src/types'
import { IS_NAME, SCRIPT_ID, SCRIPT_ID_PREFIX } from '../src/constants'

describe('Types', () => {
  describe('CustomTypes', () => {
    it('should have single name field for all custom types', () => {
      Object.values(customTypes)
        .forEach(typeDef =>
          expect(Object.values(typeDef.fields)
            .filter(field => field.annotations[IS_NAME])).toHaveLength(1))
    })

    it('should have SCRIPT_ID_PREFIX defined correctly for all custom types', () => {
      Object.values(customTypes)
        .forEach(typeDef => {
          expect(typeDef.annotations[SCRIPT_ID_PREFIX]).toBeDefined()
          expect(typeDef.annotations[SCRIPT_ID_PREFIX]).toMatch(/_$/)
        })
    })

    it('should have a not required SCRIPT_ID field for all custom types', () => {
      Object.values(customTypes)
        .forEach(typeDef => {
          expect(typeDef.fields[SCRIPT_ID]).toBeDefined()
          expect(typeDef.fields[SCRIPT_ID].annotations[CORE_ANNOTATIONS.REQUIRED]).toBeUndefined()
        })
    })
  })
})
