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
import { toChange, InstanceElement, ElemID, ChangeError, ObjectType, Change, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { mockClient } from '../utils'
import { getDefaultConfig } from '../../src/config/config'
import { JIRA, PERMISSION_SCHEME_TYPE_NAME } from '../../src/constants'
import { wrongUserPermissionSchemeValidator } from '../../src/change_validators/wrong_user_permission_scheme'

describe('wrongUsersPermissionSchemeValidator', () => {
  const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  const { client, getIdMapFunc, connection } = mockClient()
  const validator = wrongUserPermissionSchemeValidator(client, config, getIdMapFunc)
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
  const createWarning = (element: InstanceElement, parentName: string): ChangeError => ({
    elemID: element.elemID,
    severity: 'Warning',
    message: 'An account ID in a permission scheme does not exist in target environment. The scheme will be deployed without that user’s permission.',
    detailedMessage: `The account id “id1”, specified in permission scheme ${parentName}, does not exist in target environment.
The Permission Scheme will be deployed without the read permission containing that account ID.
To fix this, make sure the account ID exists in target environment, or remove this permission from the permission scheme.
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
        type: 'type',
        parameter: {
          id: `id${i}`,
        },
      },
      permission: 'read',
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
      createWarning(instances[0], 'instance'),
      createWarning(instances[1], 'instance2'),
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
    configOff.fetch.convertUsersIds = false
    const validatorOff = wrongUserPermissionSchemeValidator(client, configOff, getIdMapFunc)
    expect(await validatorOff(
      changes
    )).toEqual([])
  })
})
