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
import { SetId } from '../../src/collections/set'
import { groupBy } from '../../src/collections/iterable'

describe('groupBy', () => {
  let grouped: Map<SetId, number[]>
  beforeEach(() => {
    grouped = groupBy([1, 2, 3], num => num % 2)
  })
  it('should group elements according to the key function', () => {
    expect(grouped.get(0)).toEqual([2])
    expect(grouped.get(1)).toEqual([1, 3])
  })
})
