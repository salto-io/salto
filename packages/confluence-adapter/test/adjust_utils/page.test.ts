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

import { definitions } from '@salto-io/adapter-components'
import { increasePagesVersion } from '../../src/definitions/transformation_utils'

describe('page transformation utils', () => {
  describe('increasePagesVersion', () => {
    it('should increase the page version number', () => {
      const item = {
        typeName: 'mockType',
        context: {} as definitions.deploy.ChangeAndContext,
        value: { version: { number: 1 } },
      }
      expect(increasePagesVersion(item).value.version.number).toEqual(2)
    })

    it('should return the same value if the version number is not a number (should not happen)', () => {
      const item = {
        typeName: 'mockType',
        context: {} as definitions.deploy.ChangeAndContext,
        value: { version: { number: 'not a number' } },
      }
      expect(increasePagesVersion(item).value).toEqual(item.value)
    })
  })
})
