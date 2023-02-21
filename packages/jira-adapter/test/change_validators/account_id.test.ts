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
import { toChange, InstanceElement, ElemID, ChangeError, ChangeValidator } from '@salto-io/adapter-api'
import { config as configUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import JiraClient from '../../src/client/client'
import { mockClient } from '../utils'
import { accountIdValidator } from '../../src/change_validators/account_id'
import * as common from '../filters/account_id/account_id_common'
import { getDefaultConfig } from '../../src/config/config'
import { GetUserMapFunc } from '../../src/users'

describe('accountIdValidator', () => {
  let connection: MockInterface<clientUtils.APIConnection>
  let validator: ChangeValidator
  let instances: InstanceElement[] = []
  let url: string
  let client: JiraClient
  let getUserMapFunc: GetUserMapFunc
  const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

  const createInfo = (elemId: ElemID):ChangeError => ({
    elemID: elemId,
    severity: 'Info',
    message: 'A display name was not attached to an element.',
    detailedMessage: `A display name was not attached to ${elemId.getFullName()}. It will be added in the first fetch after this deployment.`,
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
    jest.clearAllMocks()
    const { client: mockedClient, connection: mockedConnection, getUserMapFunc: mockedUserMapFunc } = mockClient()
    getUserMapFunc = mockedUserMapFunc
    client = mockedClient
    connection = mockedConnection
    validator = accountIdValidator(client, config, getUserMapFunc)
    url = `${client.baseUrl}jira/people/search`
    connection.get.mockResolvedValue({
      status: 200,
      data: [{
        accountId: '0',
        displayName: 'disp0',
        locale: 'en_US',
        emailAddress: 'email0',
      }, {
        accountId: '0n',
        displayName: 'disp0n',
        locale: 'en_US',
        emailAddress: 'email0n',
      }, {
        accountId: '00',
        displayName: 'disp00',
        locale: 'en_US',
        emailAddress: 'email00',
      }, {
        accountId: '00n',
        displayName: 'disp00n',
        locale: 'en_US',
        emailAddress: 'email00n',
      }, {
        accountId: '0l',
        displayName: 'disp0l',
        locale: 'en_US',
        emailAddress: 'email0l',
      }, {
        accountId: '0an',
        displayName: 'disp0an',
        locale: 'en_US',
        emailAddress: 'email0an',
      }, {
        accountId: '0h',
        displayName: 'disp0h',
        locale: 'en_US',
        emailAddress: 'email0h',
      }, {
        accountId: '0list1',
        displayName: 'disp0list1',
        locale: 'en_US',
        emailAddress: 'email0list1',
      }, {
        accountId: '0list2',
        displayName: 'disp0list2',
        locale: 'en_US',
        emailAddress: 'email0list2',
      }, {
        accountId: '1',
        displayName: 'disp1',
        locale: 'en_US',
        emailAddress: 'email1',
      }, {
        accountId: '1n',
        displayName: 'disp1n',
        locale: 'en_US',
        emailAddress: 'email1n',
      }, {
        accountId: '11',
        displayName: 'disp11',
        locale: 'en_US',
        emailAddress: 'email11',
      }, {
        accountId: '11n',
        displayName: 'disp11n',
        locale: 'en_US',
        emailAddress: 'email11n',
      }, {
        accountId: '1l',
        displayName: 'disp1l',
        locale: 'en_US',
        emailAddress: 'email1l',
      }, {
        accountId: '1an',
        displayName: 'disp1an',
        locale: 'en_US',
        emailAddress: 'email1an',
      }, {
        accountId: '1h',
        displayName: 'disp1h',
        locale: 'en_US',
        emailAddress: 'email1h',
      }, {
        accountId: '1list1',
        displayName: 'disp1list1',
        locale: 'en_US',
        emailAddress: 'email1list1',
      }, {
        accountId: '1list2',
        displayName: 'disp1list2',
        locale: 'en_US',
        emailAddress: 'email1list2',
      }, {
        accountId: '0owner',
        displayName: 'disp0owner',
        locale: 'en_US',
        emailAddress: 'email0owner',
      }, {
        accountId: '1list2',
        displayName: 'disp1list2',
        locale: 'en_US',
        emailAddress: 'email1list2',
      }, {
        accountId: '0Ids1',
        displayName: 'disp0Ids1',
        locale: 'en_US',
        emailAddress: 'email0Ids1',
      }, {
        accountId: '0Ids2',
        displayName: 'disp0Ids2',
        locale: 'en_US',
        emailAddress: 'email0Ids2',
      }, {
        accountId: '1Ids1',
        displayName: 'disp1Ids1',
        locale: 'en_US',
        emailAddress: 'email1Ids1',
      }, {
        accountId: '1Ids2',
        displayName: 'disp1Ids2',
        locale: 'en_US',
        emailAddress: 'email1Ids2',
      }],
    })
    const objectType = common.createObjectedType('NotificationScheme') // passes all conditions
    instances = common.createInstanceElementArrayWithDisplayNames(2, objectType)
  })

  it('should only call outside once', async () => {
    await validator([toChange({ after: instances[0] })])
    const validator2 = accountIdValidator(client, config, getUserMapFunc)
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
    instances[0].value.leadAccountId.id = '403'
    expect(await validator([
      toChange({
        after: instances[0],
      }),
    ])).toEqual([{
      elemID: instances[0].elemID,
      severity: 'Error',
      message: 'Element references users which don’t exist in target environment',
      detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: 403. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
    }])
  })

  it('should return a warning when the account id is wrong but there is a valid default user', async () => {
    config.deploy.defaultMissingUserFallback = 'email1list2'
    instances[0].value.leadAccountId.id = '403'
    expect(await validator([
      toChange({
        after: instances[0],
      }),
    ])).toEqual([{
      elemID: instances[0].elemID,
      severity: 'Warning',
      message: '1 usernames will be overridden to email1list2',
      detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: 403. If you continue, they will be set to email1list2 according to the environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
    }])
  })

  it('should return a warning when the account id is wrong but the default user is the current deployer', async () => {
    config.deploy.defaultMissingUserFallback = configUtils.DEPLOYER_FALLBACK_VALUE
    instances[0].value.leadAccountId.id = '403'
    expect(await validator([
      toChange({
        after: instances[0],
      }),
    ])).toEqual([{
      elemID: instances[0].elemID,
      severity: 'Warning',
      message: '1 usernames will be overridden to the deployer\'s user',
      detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: 403. If you continue, they will be set to the deployer\'s user according to the environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
    }])
  })

  it('should return an error when the account id is wrong and the default user is wrong', async () => {
    config.deploy.defaultMissingUserFallback = '404'
    instances[0].value.leadAccountId.id = '403'
    expect(await validator([
      toChange({
        after: instances[0],
      }),
    ])).toEqual([{
      elemID: instances[0].elemID,
      severity: 'Error',
      message: 'Element references users which don’t exist in target environment',
      detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: 403. In addition, the defined fallback user 404 was not found in the target environment. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
    }])
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
    expect(changeErrors[2]).toEqual({
      elemID: instances[1].elemID,
      severity: 'Error',
      message: 'Element references users which don’t exist in target environment',
      detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: 403. In addition, the defined fallback user 404 was not found in the target environment. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
    })
  })
  it('should not raise errors when the flag is off', async () => {
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    configOff.fetch.convertUsersIds = false
    const validatorOff = accountIdValidator(
      client,
      configOff,
      getUserMapFunc
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

  describe('Using Jira DC', () => {
    const { client: clientDC, connection: connectionDC, getUserMapFunc: getUserMapFuncDC } = mockClient(true)
    const configDC = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const validatorDC = accountIdValidator(clientDC, configDC, getUserMapFuncDC)
    let validUserInstance: InstanceElement
    let invalidUserInstance: InstanceElement
    const objectType = common.createObjectedType('NotificationScheme') // passes all conditions

    beforeEach(() => {
      connectionDC.get.mockResolvedValue({
        status: 200,
        data: [{
          key: 'JIRAUSER10000',
          name: 'firstAccount',
          displayName: 'firstAccountDisplayName',
        }],
      })
      validUserInstance = new InstanceElement(
        'instance',
        objectType,
        {
          notificationSchemeEvents: [
            {
              event: {
                id: '1',
              },
              notifications: [{
                id: '2',
                notificationType: 'type',
                parameter: { id: 'firstAccount' },
                type: 'User',
              }],
            },
          ],
        },
      )
      invalidUserInstance = new InstanceElement(
        'instance',
        objectType,
        {
          notificationSchemeEvents: [
            {
              event: {
                id: '1',
              },
              notifications: [{
                id: '2',
                notificationType: 'type',
                parameter: { id: 'notExistsAccount' },
                type: 'User',
              }],
            },
          ],
        },
      )
    })
    // it('should not raise an error on missing user permission', async () => {
    //   connectionDC.get.mockResolvedValue({
    //     status: 403,
    //     data: [{
    //       key: 'JIRAUSER10000',
    //       name: 'firstAccount',
    //       displayName: 'firstAccountDisplayName',
    //     }],
    //   })
    //   const changeErrors = await validatorDC([
    //     toChange({
    //       after: validUserInstance,
    //     }),
    //   ])
    //   expect(changeErrors).toEqual([])
    // })
    it('should not raise an error when instance does not have DisplayName', async () => {
      const changeErrors = await validatorDC([
        toChange({
          after: validUserInstance,
        }),
      ])
      expect(changeErrors).toEqual([])
    })
    it('should raise an error when accountId does not exist in the target environment', async () => {
      const changeErrors = await validatorDC([
        toChange({
          after: invalidUserInstance,
        }),
      ])
      expect(changeErrors).toEqual([{
        elemID: invalidUserInstance.elemID,
        severity: 'Error',
        message: 'Element references users which don’t exist in target environment',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: notExistsAccount. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
      }])
    })

    it('should return a warning when the account id is wrong but there is a valid default user', async () => {
      configDC.deploy.defaultMissingUserFallback = 'firstAccount'
      expect(await validatorDC([
        toChange({
          after: invalidUserInstance,
        }),
      ])).toEqual([{
        elemID: invalidUserInstance.elemID,
        severity: 'Warning',
        message: '1 usernames will be overridden to firstAccount',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: notExistsAccount. If you continue, they will be set to firstAccount according to the environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
      }])
    })

    it('should return a warning when the account id is wrong but the default user is the current deployer', async () => {
      configDC.deploy.defaultMissingUserFallback = configUtils.DEPLOYER_FALLBACK_VALUE
      expect(await validatorDC([
        toChange({
          after: invalidUserInstance,
        }),
      ])).toEqual([{
        elemID: invalidUserInstance.elemID,
        severity: 'Warning',
        message: '1 usernames will be overridden to the deployer\'s user',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: notExistsAccount. If you continue, they will be set to the deployer\'s user according to the environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
      }])
    })

    it('should return an error when the account id is wrong and the default user is wrong', async () => {
      configDC.deploy.defaultMissingUserFallback = '404'
      expect(await validatorDC([
        toChange({
          after: invalidUserInstance,
        }),
      ])).toEqual([{
        elemID: invalidUserInstance.elemID,
        severity: 'Error',
        message: 'Element references users which don’t exist in target environment',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: notExistsAccount. In addition, the defined fallback user 404 was not found in the target environment. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment’s user fallback options. Learn more: https://help.salto.io/en/articles/6955311-element-references-users-which-don-t-exist-in-target-environment-jira',
      }])
    })
  })
})
