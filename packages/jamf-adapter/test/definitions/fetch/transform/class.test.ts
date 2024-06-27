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

import { adjustClass } from '../../../../src/definitions/fetch/transforms'

describe('adjust class', () => {
  it('should throw an error if value is not a record', () => {
    expect(() => adjustClass({ value: 'not a record', context: {}, typeName: 'class' })).toThrow()
  })
  it('should convert site object to site id', () => {
    const value = {
      a: 'a',
      site: { id: 'site-id', anotherField: 'bla' },
      b: 'b',
    }
    expect(adjustClass({ value, context: {}, typeName: 'class' })).toEqual({
      value: {
        a: 'a',
        site: 'site-id',
        b: 'b',
      },
    })
  })
})
