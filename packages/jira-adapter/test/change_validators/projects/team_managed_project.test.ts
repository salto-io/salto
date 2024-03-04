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
import { toChange, ObjectType, InstanceElement, ChangeValidator } from '@salto-io/adapter-api'
import { createEmptyType, mockClient } from '../../utils'
import { teamManagedProjectValidator } from '../../../src/change_validators/projects/team_managed_project'
import { PROJECT_TYPE } from '../../../src/constants'

describe('teamManagedProjectValidator', () => {
  let projectType: ObjectType
  let projectInstance: InstanceElement
  let changeValidator: ChangeValidator

  beforeEach(() => {
    const { client } = mockClient(false)
    changeValidator = teamManagedProjectValidator(client)

    projectType = createEmptyType(PROJECT_TYPE)

    projectInstance = new InstanceElement('project', projectType, {
      style: 'next-gen',
    })
  })
  it('should return an error when adding a team-managed project', async () => {
    expect(
      await changeValidator([
        toChange({
          after: projectInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: projectInstance.elemID,
        severity: 'Error',
        message: "Can't deploy a team-managed project",
        detailedMessage: 'Currently team-managed projects are not supported. The project will not be deployed.',
      },
    ])
    expect(
      await changeValidator([
        toChange({
          before: projectInstance,
          after: projectInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: projectInstance.elemID,
        severity: 'Error',
        message: "Can't deploy a team-managed project",
        detailedMessage: 'Currently team-managed projects are not supported. The project will not be deployed.',
      },
    ])
  })
  it('should not issue an error for a company managed project', async () => {
    projectInstance.value.style = 'classic'
    expect(
      await changeValidator([
        toChange({
          after: projectInstance,
        }),
      ]),
    ).toEqual([])

    expect(
      await changeValidator([
        toChange({
          before: projectInstance,
          after: projectInstance,
        }),
      ]),
    ).toEqual([])
  })
  it('should do nothing for deletion changes', async () => {
    expect(
      await changeValidator([
        toChange({
          before: projectInstance,
        }),
      ]),
    ).toEqual([])
  })

  it('should not return an error when using dc', async () => {
    const { client } = mockClient(true)
    changeValidator = teamManagedProjectValidator(client)
    expect(
      await changeValidator([
        toChange({
          before: projectInstance,
          after: projectInstance,
        }),
      ]),
    ).toEqual([])
  })
})
