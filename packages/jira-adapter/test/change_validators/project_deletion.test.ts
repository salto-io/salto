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
import { toChange, ObjectType, ElemID, InstanceElement, ChangeValidator } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { mockClient } from '../utils'
import { projectDeletionValidator } from '../../src/change_validators/project_deletion'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA } from '../../src/constants'

describe('projectDeletionValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let changeValidator: ChangeValidator

  beforeEach(() => {
    const { client, connection } = mockClient()
    mockConnection = connection

    mockConnection.get.mockResolvedValue({
      status: 200,
      data: {
        total: 1,
      },
    })

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    changeValidator = projectDeletionValidator(client, config)

    type = new ObjectType({ elemID: new ElemID(JIRA, 'Project') })
    instance = new InstanceElement(
      'instance',
      type,
      {
        key: 'KEY',
      }
    )
  })
  it('should return an error when removing a project with issue', async () => {
    expect(await changeValidator([
      toChange({
        before: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can’t delete Project with existing issues',
        detailedMessage: 'This project has issues assigned to it. Deleting the project will also delete all its issues and Salto will not be able to restore the issues. To delete this project anyway, and delete all its issues, add a "forceDelete=true" deploy option to your deploy configuration.',
      },
    ])

    expect(mockConnection.get).toHaveBeenCalledWith(
      '/rest/api/3/search',
      {
        params: {
          jql: 'project = "KEY"',
          maxResults: '0',
        },
      }
    )
  })

  it('should not return an error when project does not have issues', async () => {
    mockConnection.get.mockResolvedValue({
      status: 200,
      data: {
        total: 0,
      },
    })

    expect(await changeValidator([
      toChange({
        before: instance,
      }),
    ])).toEqual([])
  })

  it('should not return an error when forceDelete is on', async () => {
    config.deploy.forceDelete = true

    expect(await changeValidator([
      toChange({
        before: instance,
      }),
    ])).toEqual([])
  })

  it('should not return an error when not removal', async () => {
    expect(await changeValidator([
      toChange({
        before: instance,
        after: instance,
      }),
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })

  it('should return an error when request throws an error', async () => {
    mockConnection.get.mockRejectedValue(new Error('error'))

    expect(await changeValidator([
      toChange({
        before: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can’t delete Project with existing issues',
        detailedMessage: 'This project has issues assigned to it. Deleting the project will also delete all its issues and Salto will not be able to restore the issues. To delete this project anyway, and delete all its issues, add a "forceDelete=true" deploy option to your deploy configuration.',
      },
    ])
  })

  it('should return an error when response is invalid', async () => {
    mockConnection.get.mockResolvedValue({
      status: 200,
      data: {},
    })

    expect(await changeValidator([
      toChange({
        before: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can’t delete Project with existing issues',
        detailedMessage: 'This project has issues assigned to it. Deleting the project will also delete all its issues and Salto will not be able to restore the issues. To delete this project anyway, and delete all its issues, add a "forceDelete=true" deploy option to your deploy configuration.',
      },
    ])
  })
})
