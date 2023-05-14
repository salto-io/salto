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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { errors as wsErrors } from '@salto-io/workspace'
import { incomingUnresolvedReferencesValidator } from '../../../../src/core/plan/change_validators/incoming_unresolved_references'

describe('checkUnresolvedReferencesValidator', () => {
  const type = new ObjectType({
    elemID: new ElemID('adapter', 'type'),
    annotations: {
      [CORE_ANNOTATIONS.CREATABLE]: false,
    },
  })
  const firstInstance = new InstanceElement('instance1', type)

  const firstInstanceError = new wsErrors.UnresolvedReferenceValidationError({
    elemID: firstInstance.elemID, target: firstInstance.elemID,
  })

  const secondInstance = new InstanceElement('instance2', type)

  it('should not return an error when the unresolved elemID is not in the plan', async () => {
    const errors = await incomingUnresolvedReferencesValidator([firstInstanceError])([
      toChange({ before: secondInstance }),
    ])
    expect(errors).toEqual([])
  })

  it('should return an error when the unresolved elemID is in the plan', async () => {
    const errors = await incomingUnresolvedReferencesValidator([firstInstanceError])([
      toChange({ before: firstInstance }),
    ])
    expect(errors.length).toEqual(1)
    expect(errors[0].elemID).toEqual(firstInstance.elemID)
    expect(errors[0].severity).toEqual('Warning')
  })
})
