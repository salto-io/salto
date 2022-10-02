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
import { toChange, InstanceElement, ElemID, ChangeError, ObjectType, Change, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { mockClient } from '../utils'
import { getDefaultConfig } from '../../src/config/config'
import { JIRA, PERMISSION_SCHEME_TYPE_NAME } from '../../src/constants'
import { wrongUsersPermissionSchemeValidator } from '../../src/change_validators/wrong_users_permission_scheme'

describe('wrongUsersPermissionSchemeValidator', () => {
  const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  const { client, getIdMapFunc, connection } = mockClient()
  const validator = wrongUsersPermissionSchemeValidator(client, config, getIdMapFunc)
  const url = `${client.baseUrl}jira/people/search`
  let instances: InstanceElement[]
  let changes: Change[]
  connection.get.mockResolvedValue({
    status: 200,
    data: [{
      accountId: 'id0',
    }, {
      accountId: 'id2',
    }, {
      accountId: 'id3',
    }, {
      accountId: 'id4',
    }, {
      accountId: 'id5',
    }],
  })
  const createWarning = ({
    element,
    accountId,
  } : {
    element: InstanceElement
    accountId: string
  }): ChangeError => ({
    elemID: element.elemID,
    severity: 'Warning',
    message: 'The account id in a permission scheme does not exist. The element will be deployed without this permission scheme.',
    detailedMessage: `The account id “${accountId}” does not exist.
The Permission Scheme “${element.elemID.createTopLevelParentID().parent.name}” will be deployed without the permission containing it.
Check ${url} to see valid users and account IDs.`,
  })

  beforeEach(() => {
    const type = new ObjectType({
      elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME),
    })
    instances = []
    changes = []
    const value1: Value = { permissions: [] }
    const value2: Value = { permissions: [] }
    const createValue = (i: number): Value => ({
      holder: {
        parameter: {
          id: `id${i}`,
        },
      },
    })
    for (let i = 0; i < 6; i += 1) {
      value1.permissions.push(createValue(i))
      value2.permissions.push(createValue(5 - i))
    }
    // add irrelevant info
    value1.permissions[5].holder.parameter.wrong = 'wrong'
    // add wrong structure
    value1.permissions.push({ wrong: { anotherWrong: 'anotherWrong' } })
    instances[0] = new InstanceElement(
      'instance',
      type,
      value1
    )
    instances[1] = new InstanceElement(
      'instance2',
      type,
      value2
    )
    changes[0] = toChange({ after: instances[0] })
    changes[1] = toChange({ after: instances[1] })
  })

  it('should return a warning when there is a wrong account id', async () => {
    expect(await validator(
      changes
    )).toEqual([
      createWarning({ element: instances[0], accountId: 'id1' }),
      createWarning({ element: instances[1], accountId: 'id1' }),
    ])
  })
  it('should not return a warning when all ids are ok', async () => {
    delete instances[0].value.permissions[1]
    delete instances[1].value.permissions[4]
    expect(await validator(
      changes
    )).toEqual([])
  })
  it('should not return a warning when the flag is off', async () => {
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    configOff.fetch.showUserDisplayNames = false
    const validatorOff = wrongUsersPermissionSchemeValidator(client, configOff, getIdMapFunc)
    expect(await validatorOff(
      changes
    )).toEqual([])
  })
})
