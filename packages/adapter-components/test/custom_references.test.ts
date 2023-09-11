/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID } from '@salto-io/adapter-api'
import { combineCustomReferenceGetters } from '../src/custom_references'

describe('combineCustomReferenceGetters', () => {
  it('should run all the custom reference getters', async () => {
    const getCustomReferencesFunc = combineCustomReferenceGetters([
      async () => ([
        {
          source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
          type: 'strong',
        },
        {
          source: new ElemID('adapter', 'type2', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type2', 'instance', 'inst2'),
          type: 'strong',
        },
      ]),
      async () => ([
        {
          source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
          type: 'weak',
        },
      ]),
    ])

    const refs = await getCustomReferencesFunc([])

    expect(refs).toEqual([
      {
        source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
        target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
        type: 'weak',
      },
      {
        source: new ElemID('adapter', 'type2', 'instance', 'inst1'),
        target: new ElemID('adapter', 'type2', 'instance', 'inst2'),
        type: 'strong',
      },
    ])
  })
})
