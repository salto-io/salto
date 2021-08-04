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
import { AdapterOperations, ElemID, ObjectType, ReferenceExpression, toChange, UnresolvedReference } from '@salto-io/adapter-api'
import getChangeValidators from '../../../../src/core/plan/change_validators'

describe('getChangeValidators', () => {
  it('should call both the adapter change validators and the core change validators', async () => {
    const adapterChangeValidator = jest.fn().mockResolvedValue([])
    const changesValidators = getChangeValidators({
      adapter: {
        deployModifiers: {
          changeValidator: adapterChangeValidator,
        },
      },
    } as unknown as Record<string, AdapterOperations>)

    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      annotations: {
        value: new ReferenceExpression(new ElemID('adapter', 'someId'), new UnresolvedReference(new ElemID('adapter', 'someId'))),
      },
    })
    const errors = await changesValidators.adapter([toChange({ after: type })])
    expect(errors.length).toBe(1)
    expect(errors[0].message).toBe('Element has unresolved references')
    expect(adapterChangeValidator).toHaveBeenCalled()
  })
})
