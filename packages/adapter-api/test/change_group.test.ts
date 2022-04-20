/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { ChangeGroupOptions, mergeChangeGroupOptions } from '../src/change_group'

describe('mergeChangeGroupOptions', () => {
  it('should do nothing for a single ChangeGroupOptions', () => {
    const options: ChangeGroupOptions = { disjointGroups: new Set('abc') }
    expect(mergeChangeGroupOptions(options)).toMatchObject({
      disjointGroups: new Set('abc'),
    })
  })
  it('should correcly merge disjoint ChangeGroupOptions', () => {
    const options1: ChangeGroupOptions = { disjointGroups: new Set('a') }
    const options2: ChangeGroupOptions = { disjointGroups: new Set('bcd') }
    const options3: ChangeGroupOptions = { disjointGroups: new Set('be') }
    const options4: ChangeGroupOptions = { }

    expect(mergeChangeGroupOptions(options1, options2, options3, options4)).toMatchObject({
      disjointGroups: new Set('abcde'),
    })
  })
})
