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
import { AdapterOperations, ChangeValidator, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import getChangeValidators from '../../../../src/core/plan/change_validators'

describe('getChangeValidators', () => {
  let adapters: Record<string, AdapterOperations>
  let deployChangeValidator: jest.MockedFunction<ChangeValidator>
  let validateChangeValidator: jest.MockedFunction<ChangeValidator>

  const type = new ObjectType({
    elemID: new ElemID('adapter', 'type'),
    annotations: {
      [CORE_ANNOTATIONS.CREATABLE]: false,
    },
  })

  const instance = new InstanceElement(
    'instance',
    type,
  )

  const changes = [toChange({ after: instance })]

  beforeEach(() => {
    deployChangeValidator = mockFunction<ChangeValidator>().mockResolvedValue([
      {
        elemID: new ElemID('adapter'),
        message: 'message',
        detailedMessage: 'from deployment',
        severity: 'Warning',
      },
    ])
    validateChangeValidator = mockFunction<ChangeValidator>().mockResolvedValue([
      {
        elemID: new ElemID('adapter'),
        message: 'message',
        detailedMessage: 'from validation',
        severity: 'Warning',
      },
    ])
    adapters = {
      adapter: {
        deployModifiers: {
          changeValidator: deployChangeValidator,
        },
        validationModifiers: {
          changeValidator: validateChangeValidator,
        },
        fetch: mockFunction<AdapterOperations['fetch']>(),
        deploy: mockFunction<AdapterOperations['deploy']>(),
      },
    } as Record<string, AdapterOperations>
  })
  describe('when checkOnly is false', () => {
    it('should call both the adapter change validators and the core change validators and use the deployModifiers', async () => {
      const changesValidators = getChangeValidators(adapters, false)
      const errors = await changesValidators.adapter(changes)
      expect(errors).toHaveLength(2)
      expect(errors[0].message).toBe('Operation not supported')
      expect(deployChangeValidator).toHaveBeenCalledWith(changes, undefined)
      expect(validateChangeValidator).not.toHaveBeenCalled()
      expect(errors[1].message).toBe('message')
    })
  })

  describe('when checkOnly is true', () => {
    it('should call both the adapter change validators and the core change validators and use the validationModifiers', async () => {
      const changesValidators = getChangeValidators(adapters, true)
      const errors = await changesValidators.adapter(changes)
      expect(errors).toHaveLength(2)
      expect(errors[0].message).toBe('Operation not supported')
      expect(validateChangeValidator).toHaveBeenCalledWith(changes, undefined)
      expect(deployChangeValidator).not.toHaveBeenCalled()
      expect(errors[1].message).toBe('message')
    })
  })
})
