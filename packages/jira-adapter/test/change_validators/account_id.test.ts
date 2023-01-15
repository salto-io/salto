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
import { toChange, InstanceElement, ElemID, ChangeError } from '@salto-io/adapter-api'
import _ from 'lodash'
import { mockClient } from '../utils'
import { accountIdValidator } from '../../src/change_validators/account_id'
import * as common from '../filters/account_id/account_id_common'
import { getDefaultConfig } from '../../src/config/config'

describe('accountIdValidator', () => {
  const { client, connection, getIdMapFunc } = mockClient()
  const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  const validator = accountIdValidator(client, config, getIdMapFunc)
  const url = `${client.baseUrl}jira/people/search`
  let instances: InstanceElement[] = []
  connection.get.mockResolvedValue({
    status: 200,
    data: [{
      accountId: '0',
      displayName: 'disp0',
    }, {
      accountId: '0n',
      displayName: 'disp0n',
    }, {
      accountId: '00',
      displayName: 'disp00',
    }, {
      accountId: '00n',
      displayName: 'disp00n',
    }, {
      accountId: '0l',
      displayName: 'disp0l',
    }, {
      accountId: '0an',
      displayName: 'disp0an',
    }, {
      accountId: '0h',
      displayName: 'disp0h',
    }, {
      accountId: '0list1',
      displayName: 'disp0list1',
    }, {
      accountId: '0list2',
      displayName: 'disp0list2',
    }, {
      accountId: '1',
      displayName: 'disp1',
    }, {
      accountId: '1n',
      displayName: 'disp1n',
    }, {
      accountId: '11',
      displayName: 'disp11',
    }, {
      accountId: '11n',
      displayName: 'disp11n',
    }, {
      accountId: '1l',
      displayName: 'disp1l',
    }, {
      accountId: '1an',
      displayName: 'disp1an',
    }, {
      accountId: '1h',
      displayName: 'disp1h',
    }, {
      accountId: '1list1',
      displayName: 'disp1list1',
    }, {
      accountId: '1list2',
      displayName: 'disp1list2',
    }, {
      accountId: '0owner',
      displayName: 'disp0owner',
    }, {
      accountId: '1list2',
      displayName: 'disp1list2',
    }],
  })

  const createInfo = (elemId: ElemID):ChangeError => ({
    elemID: elemId,
    severity: 'Info',
    message: 'A display name was not attached to an element.',
    detailedMessage: `A display name was not attached to ${elemId.getFullName()}. It will be added in the first fetch after this deployment.`,
  })

  const createError = (
    elemId: ElemID,
    parent: ElemID,
    field: string,
    accountId: string
  ): ChangeError => ({
    elemID: elemId,
    severity: 'Error',
    message: 'Specified account ID does not exist on the target environment. Element will not be deployed.',
    detailedMessage: `Cannot deploy the ${parent.typeName} “${parent.name}” as the account id ${accountId} in the property “${field}” does not exist on the target environment.    
Go to ${url} to see valid users and account IDs`,
  })

  const createWarning = ({
    elemId,
    parent,
    accountId,
    realDisplayName,
    currentDisplayName,
  } : {
    elemId: ElemID
    parent: ElemID
    accountId: string
    realDisplayName: string
    currentDisplayName: string
  }): ChangeError => ({
    elemID: elemId,
    severity: 'Warning',
    message: 'The display name does not match the specified account ID. The element will be deployed with the appropriate display name instead.',
    detailedMessage: `The display name “${currentDisplayName}" in ${elemId.name} does not match the specified account ID ${accountId}.
The ${parent.typeName} “${parent.name}” will be deployed with the appropriate display name instead: “${realDisplayName}”.
Go to ${url} to see valid users and account IDs.`,
  })

  beforeEach(() => {
    const objectType = common.createObjectedType('NotificationScheme') // passes all conditions
    instances = common.createInstanceElementArrayWithDisplayNames(2, objectType)
  })

  it('should only call outside once', async () => {
    await validator([toChange({ after: instances[0] })])
    const validator2 = accountIdValidator(client, config, getIdMapFunc)
    await validator2([toChange({ after: instances[1] })])
    expect(connection.get).toHaveBeenCalledOnce()
  })

  it('should return an info when there is no display name', async () => {
    const field = 'accountId'
    delete instances[0].value[field].displayName
    const elemId = instances[0].elemID.createNestedID(field)
    expect(await validator([
      toChange({
        after: instances[0],
      }),
    ])).toEqual([
      createInfo(elemId),
    ])
  })

  it('should return an error when the account id is wrong', async () => {
    const field = 'leadAccountId'
    instances[0].value[field].id = '403'
    const elemId = instances[0].elemID.createNestedID(field)
    const { parent } = elemId.createTopLevelParentID()
    expect(await validator([
      toChange({
        after: instances[0],
      }),
    ])).toEqual([
      createError(elemId, parent, field, '403'),
    ])
  })

  it('should return a warning when the display name is wrong', async () => {
    const field = 'value'
    const realDisplayName = instances[0].value.nested.actor2[field].displayName
    const accountId = instances[0].value.nested.actor2[field].id
    instances[0].value.nested.actor2[field].displayName = 'wrong'
    const elemId = instances[0].elemID.createNestedID('nested', 'actor2', field)
    const { parent } = elemId.createTopLevelParentID()
    expect(await validator([
      toChange({
        after: instances[0],
      }),
    ])).toEqual([
      createWarning({ elemId, parent, accountId, realDisplayName, currentDisplayName: 'wrong' }),
    ])
  })
  it('should not issue an error in permission scheme type with no account id', async () => {
    const objectType = common.createObjectedType('PermissionScheme')
    const permissionSchemeInstances = common.createInstanceElementArrayWithDisplayNames(
      1,
      objectType
    )
    permissionSchemeInstances[0].value.holder.parameter.id = -1
    expect(await validator([
      toChange({
        after: permissionSchemeInstances[0],
      }),
    ])).toEqual([])
  })
  it('should not return errors when data is ok', async () => {
    expect(await validator([
      toChange({
        after: instances[0],
      }),
      toChange({
        after: instances[1],
      }),
    ])).toEqual([])
  })
  it('should issue multiple errors correctly', async () => {
    // two same errors on a single element
    const field1 = 'parameter'
    delete instances[0].value.holder[field1].displayName
    const elemId1 = instances[0].elemID.createNestedID('holder', field1)
    const field2 = 'accountId'
    delete instances[0].value.list[0][field2].displayName
    const elemId2 = instances[0].elemID.createNestedID('list', '0', field2)
    // two different errors on a single element
    delete instances[1].value.holder[field1].displayName
    const elemId3 = instances[1].elemID.createNestedID('holder', field1)
    const field4 = 'value'
    instances[1].value.actor[field4].id = '403'
    const elemId4 = instances[1].elemID.createNestedID('actor', field4)
    const parent4 = instances[1].elemID.createTopLevelParentID().parent
    const changeErrors = await validator([
      toChange({
        after: instances[0],
      }),
      toChange({
        after: instances[1],
      }),
    ])
    expect(changeErrors.length).toEqual(4)
    // this could be done not order specific using:
    // expect(changeErrors).toEqual(expect.arrayContaining([createInfo(elemId1)]))
    // it is done this way to make it easier if a test fails
    expect(changeErrors[0]).toEqual(createInfo(elemId1))
    expect(changeErrors[1]).toEqual(createInfo(elemId2))
    expect(changeErrors[3]).toEqual(createInfo(elemId3))
    expect(changeErrors[2]).toEqual(createError(elemId4, parent4, field4, '403'))
  })
  it('should not raise errors when the flag is off', async () => {
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    configOff.fetch.convertUsersIds = false
    const validatorOff = accountIdValidator(
      client,
      configOff,
      getIdMapFunc
    )
    const field1 = 'parameter'
    delete instances[0].value.holder[field1].displayName
    const field2 = 'accountId'
    instances[0].value.list[0][field2].displayName = 'monster'
    delete instances[1].value.holder[field1].displayName
    const field4 = 'value'
    instances[1].value.actor[field4].id = '403'
    expect(await validatorOff([
      toChange({
        after: instances[0],
      }),
      toChange({
        after: instances[1],
      }),
    ])).toEqual([])
  })
  it('should not raise errors when the type is not deployable', async () => {
    const objectType = common.createObjectedType('Board')
    instances = common.createInstanceElementArrayWithDisplayNames(2, objectType)
    const changeErrors = await validator([
      toChange({
        after: instances[0],
      }),
      toChange({
        after: instances[1],
      }),
    ])
    expect(changeErrors).toEqual([])
  })
})
