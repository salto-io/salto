/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { resolveReferences } from '../src/references'

describe('resolveReferences', () => {
  it('should replace references with their values', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('adapter', 'type') }),
      {
        ref: new ReferenceExpression(new ElemID('adapter', 'ref'), 1),
        notRef: 2,
        innerRef: {
          ref: new ReferenceExpression(new ElemID('adapter', 'innerRef'), 3),
        },
      }
    )

    expect(await resolveReferences(instance.value, await instance.getType())).toEqual({
      ref: 1,
      notRef: 2,
      innerRef: {
        ref: 3,
      },
    })
  })
})
