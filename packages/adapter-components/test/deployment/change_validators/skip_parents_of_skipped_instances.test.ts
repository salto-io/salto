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
import {
  ChangeValidator,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { createSkipParentsOfSkippedInstancesValidator } from '../../../src/deployment/change_validators/skip_parents_of_skipped_instances'

describe('createSkipParentsOfSkippedInstancesValidator', () => {
  const skippedInstType = new ObjectType({ elemID: new ElemID('salto', 'obj') })
  const parentInstance = new InstanceElement('parent', skippedInstType)
  const skippedInst = new InstanceElement('inner', skippedInstType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentInstance.elemID, parentInstance)],
  })
  const mockNameToChangeValidator: Record<string, ChangeValidator> = {
    mockValidator: async () => [
      {
        elemID: skippedInst.elemID,
        severity: 'Error',
        message: 'Error',
        detailedMessage: 'detailed error',
      },
    ],
  }

  it('should skip the parent instance as well', async () => {
    const errors = await createSkipParentsOfSkippedInstancesValidator({ validators: mockNameToChangeValidator })([
      toChange({ after: parentInstance }),
      toChange({ after: skippedInst }),
    ])
    expect(errors).toHaveLength(2)
    expect(errors.map(e => e.elemID.getFullName())).toEqual([
      skippedInst.elemID.getFullName(),
      parentInstance.elemID.getFullName(),
    ])
  })
  it('should not skip the parent instance if it did not change', async () => {
    const errors = await createSkipParentsOfSkippedInstancesValidator({ validators: mockNameToChangeValidator })([
      toChange({ after: skippedInst }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors.map(e => e.elemID.getFullName())).toEqual([skippedInst.elemID.getFullName()])
  })
  it('should not skip the parent instance if its child did not change', async () => {
    const errors = await createSkipParentsOfSkippedInstancesValidator({ validators: mockNameToChangeValidator })([
      toChange({ after: parentInstance }),
    ])
    expect(errors).toHaveLength(1)
  })
  it('should add only one error to parent even if child has multiple', async () => {
    const otherMockChangeValidator: Record<string, ChangeValidator> = {
      otherMockValidator: async () => [
        {
          elemID: skippedInst.elemID,
          severity: 'Error',
          message: 'Error',
          detailedMessage: 'detailed error',
        },
        {
          elemID: skippedInst.elemID,
          severity: 'Error',
          message: 'Error',
          detailedMessage: 'another detailed error',
        },
        {
          elemID: skippedInst.elemID,
          severity: 'Error',
          message: 'Error',
          detailedMessage: 'and another detailed error',
        },
      ],
    }
    const errors = await createSkipParentsOfSkippedInstancesValidator({ validators: otherMockChangeValidator })([
      toChange({ after: parentInstance }),
      toChange({ after: skippedInst }),
    ])
    expect(errors).toHaveLength(4)
  })
})
