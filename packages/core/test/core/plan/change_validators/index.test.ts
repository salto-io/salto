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
import { AdapterOperations, ChangeValidator, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { expressions } from '@salto-io/workspace'
import { getChangeValidators } from '../../../../src/core/plan/change_validators'

describe('getChangeValidators', () => {
  it('should call both the adapter change validators and the core change validators', async () => {
    const adapterChangeValidator = mockFunction<ChangeValidator>().mockResolvedValue([
      {
        elemID: new ElemID('adapter'),
        message: 'message',
        detailedMessage: '',
        severity: 'Warning',
      },
    ])
    const changesValidators = getChangeValidators({
      adapter: {
        deployModifiers: {
          changeValidator: adapterChangeValidator,
        },
        fetch: mockFunction<AdapterOperations['fetch']>(),
        deploy: mockFunction<AdapterOperations['deploy']>(),
      },
    } as Record<string, AdapterOperations>)

    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      annotations: {
        value: new ReferenceExpression(new ElemID('adapter', 'someId'), new expressions.UnresolvedReference(new ElemID('adapter', 'someId'))),
      },
    })
    const changes = [toChange({ after: type })]
    const configType = new ObjectType({
      elemID: new ElemID('adapter', '_config'),
    })
    const adapterConfig = new InstanceElement('_config', configType)
    const errors = await changesValidators.adapter(changes, adapterConfig)
    expect(errors).toHaveLength(2)
    expect(errors[0].message).toBe('Element has unresolved references')
    expect(adapterChangeValidator).toHaveBeenCalledWith(changes, adapterConfig)
    expect(errors[1].message).toBe('message')
  })
})
