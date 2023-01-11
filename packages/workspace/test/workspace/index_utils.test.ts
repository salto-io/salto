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
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getAllElementsChanges } from '../../src/workspace/index_utils'

describe('getAllElementsChanges', () => {
  const firstObject = new ObjectType({ elemID: new ElemID('adapter', 'type1') })
  const secondObject = new ObjectType({ elemID: new ElemID('adapter', 'type2') })
  const thirdObject = new ObjectType({ elemID: new ElemID('adapter', 'type3') })
  const elements = [
    firstObject,
    secondObject,
  ]
  const elementsSource = buildElementsSourceFromElements(elements)
  it('should return all elements', async () => {
    const result = await getAllElementsChanges([], elementsSource)
    expect(result).toEqual([toChange({ after: firstObject }), toChange({ after: secondObject })])
  })
  it('should merge current changes with all other element changes', async () => {
    const result = await getAllElementsChanges([toChange({ after: thirdObject })], elementsSource)
    expect(result).toEqual([
      toChange({ after: firstObject }),
      toChange({ after: secondObject }),
      toChange({ after: thirdObject }),
    ])
  })
})
