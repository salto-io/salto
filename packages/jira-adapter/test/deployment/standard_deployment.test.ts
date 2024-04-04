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
import { ElemID, InstanceElement, ObjectType, SaltoError, toChange } from '@salto-io/adapter-api'
import { deployChanges } from '../../src/deployment/standard_deployment'
import { JIRA } from '../../src/constants'

describe('deployChanges', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID(JIRA, 'type'),
    })
    instance = new InstanceElement('instance', type)
  })
  it('should return salto element errors when failed', async () => {
    const res = await deployChanges([toChange({ after: instance })], () => {
      throw new Error('failed')
    })
    expect(res.appliedChanges).toHaveLength(0)
    expect(res.errors).toEqual([
      {
        message: 'Error: failed',
        severity: 'Error',
        elemID: instance.elemID,
      },
    ])
  })

  it('should return the applied change and an error when the error severity is not Error', async () => {
    const warningError: SaltoError = {
      message: 'warning message',
      severity: 'Warning',
    }
    const res = await deployChanges([toChange({ after: instance })], () => {
      throw warningError
    })
    expect(res.appliedChanges).toHaveLength(1)
    expect(res.appliedChanges[0]).toEqual(toChange({ after: instance }))
    expect(res.errors).toEqual([
      {
        message: 'warning message',
        severity: 'Warning',
        elemID: instance.elemID,
      },
    ])
  })
})
