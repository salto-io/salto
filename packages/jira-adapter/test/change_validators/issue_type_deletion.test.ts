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
import { ObjectType, ElemID, InstanceElement, ChangeValidator, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockClient } from '../utils'
import { issueTypeDeletionValidator } from '../../src/change_validators/issue_type_deletion'
import { ISSUE_TYPE_NAME, JIRA } from '../../src/constants'

describe('issue type deletion validator', () => {
  let validator: ChangeValidator
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let numberOfIssues: number
  let instance: InstanceElement

  beforeEach(() => {
    jest.clearAllMocks()
    const { client, connection } = mockClient()
    mockConnection = connection
    numberOfIssues = 100
    instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) }),
      {
        name: 'instance',
      },
    )
    mockConnection.get.mockImplementation(async url => {
      if (url === '/rest/api/3/search') {
        return {
          status: 200,
          data: {
            total: numberOfIssues,
          },
        }
      }
      throw new Error(`Unexpected url ${url}`)
    })
    validator = issueTypeDeletionValidator(client)
  })

  it('should not return an error on modification/addition changes', async () => {
    expect(await validator([toChange({ before: instance, after: instance })])).toEqual([])
    expect(await validator([toChange({ after: instance })])).toEqual([])
  })
  it('should not return an error if there are no linked issues', async () => {
    numberOfIssues = 0
    expect(await validator([toChange({ before: instance })])).toEqual([])
  })
  it("should assume there aren't issues if error is returned from server", async () => {
    mockConnection.get.mockImplementation(async url => {
      if (url === '/rest/api/3/search') {
        throw new Error('error')
      }
      throw new Error(`Unexpected url ${url}`)
    })
    expect(await validator([toChange({ before: instance })])).toHaveLength(0)
  })
  it("should assume there aren't issues on bad response from server", async () => {
    mockConnection.get.mockResolvedValueOnce({
      status: 200,
      data: [],
    })
    expect(await validator([toChange({ before: instance })])).toHaveLength(0)
    mockConnection.get.mockResolvedValueOnce({
      status: 200,
      data: {
        something: 'else',
      },
    })
    expect(await validator([toChange({ before: instance })])).toHaveLength(0)
  })
  it('should return a error if there are linked issues', async () => {
    const errors = await validator([toChange({ before: instance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toEqual('Cannot remove issue type with existing issues.')
    expect(errors[0].detailedMessage).toEqual('There are existing issues of this issue type. You must delete them before you can delete the issue type itself.')
  })
})
