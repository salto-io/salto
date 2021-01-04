/*
*                      Copyright 2021 Salto Labs Ltd.
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
  ChangeError, ObjectType, toChange, InstanceElement,
} from '@salto-io/adapter-api'
import profileMapKeysValidator from '../../src/change_validators/profile_map_keys'
import { generateProfileType } from '../utils'
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'

const generateInstance = (profileObj: ObjectType): InstanceElement => (
  new InstanceElement(
    'Admin',
    profileObj,
    {
      [INSTANCE_FULL_NAME_FIELD]: 'Admin',
      applicationVisibilities: {
        app1: { application: 'app1', default: true, visible: false },
        app2: { application: 'app2', default: true, visible: false },
      },
      fieldPermissions: {
        Account: {
          AccountNumber: {
            field: 'Account.AccountNumber',
            editable: true,
            readable: true,
          },
        },
        Contact: {
          HasOptedOutOfEmail: {
            field: 'Contact.HasOptedOutOfEmail',
            editable: true,
            readable: true,
          },
        },
      },
      layoutAssignments: {
        'Account_Account_Layout@bs': [
          { layout: 'Account-Account Layout' },
        ],
        'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs': [
          { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'something' },
        ],
      },
    },
  )
)

const breakInstanceMaps = (profileInstance: InstanceElement): void => {
  profileInstance.value.applicationVisibilities.otherApp = { application: 'other app', default: true, visible: false }
  profileInstance.value.fieldPermissions.Account.wrongName = (
    profileInstance.value.fieldPermissions.Account.AccountNumber
  )
  delete profileInstance.value.fieldPermissions.Account.AccountNumber
  profileInstance.value.fieldPermissions.Something = {
    wrong: {
      field: 'Correct.Path',
      editable: true,
      readable: true,
    },
  }
  profileInstance.value.layoutAssignments['Account_Account_Layout@bs'][0].layout = 'new account layout name'
}

describe('profile map keys change validator', () => {
  let profileObj: ObjectType
  let profileInstance: InstanceElement
  beforeEach(() => {
    profileObj = generateProfileType(true)
    profileInstance = generateInstance(profileObj)
  })

  const runChangeValidator = (before?: InstanceElement, after?: InstanceElement):
      Promise<ReadonlyArray<ChangeError>> =>
    profileMapKeysValidator([toChange({ before, after })])

  it('should have no errors if keys are valid', async () => {
    const afterProfileObj = generateProfileType(true)
    const afterProfileInstance = generateInstance(afterProfileObj)
    const changeErrors = await runChangeValidator(profileInstance, afterProfileInstance)
    expect(changeErrors).toHaveLength(0)
  })

  it('should have error for invalid keys on update', async () => {
    const afterProfileObj = generateProfileType(true)
    const afterProfileInstance = generateInstance(afterProfileObj)
    breakInstanceMaps(afterProfileInstance)

    const changeErrors = await runChangeValidator(profileInstance, afterProfileInstance)
    expect(changeErrors).toHaveLength(4)
    expect(changeErrors.map(c => c.severity)).toEqual(['Error', 'Error', 'Error', 'Error'])
    expect(changeErrors[0].elemID).toEqual(afterProfileInstance.elemID.createNestedID('applicationVisibilities', 'otherApp'))
    expect(changeErrors[0].detailedMessage).toEqual('Profile Admin field applicationVisibilities: Incorrect map key otherApp, should be other_app@s')
    expect(changeErrors[1].elemID).toEqual(afterProfileInstance.elemID.createNestedID('fieldPermissions', 'Account', 'wrongName'))
    expect(changeErrors[1].detailedMessage).toEqual('Profile Admin field fieldPermissions: Incorrect map key Account.wrongName, should be Account.AccountNumber')
    expect(changeErrors[2].elemID).toEqual(afterProfileInstance.elemID.createNestedID('fieldPermissions', 'Something'))
    expect(changeErrors[2].detailedMessage).toEqual('Profile Admin field fieldPermissions: Incorrect map key Something.wrong, should be Correct.Path')
    expect(changeErrors[3].elemID).toEqual(afterProfileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'))
    expect(changeErrors[3].detailedMessage).toEqual('Profile Admin field layoutAssignments: Incorrect map key Account_Account_Layout@bs, should be new_account_layout_name@s')
  })

  it('should have error for invalid keys on add', async () => {
    breakInstanceMaps(profileInstance)

    const changeErrors = await runChangeValidator(undefined, profileInstance)
    expect(changeErrors).toHaveLength(4)
    expect(changeErrors.map(c => c.severity)).toEqual(['Error', 'Error', 'Error', 'Error'])
    expect(changeErrors[0].elemID).toEqual(profileInstance.elemID.createNestedID('applicationVisibilities', 'otherApp'))
    expect(changeErrors[0].detailedMessage).toEqual('Profile Admin field applicationVisibilities: Incorrect map key otherApp, should be other_app@s')
    expect(changeErrors[1].elemID).toEqual(profileInstance.elemID.createNestedID('fieldPermissions', 'Account', 'wrongName'))
    expect(changeErrors[1].detailedMessage).toEqual('Profile Admin field fieldPermissions: Incorrect map key Account.wrongName, should be Account.AccountNumber')
    expect(changeErrors[2].elemID).toEqual(profileInstance.elemID.createNestedID('fieldPermissions', 'Something'))
    expect(changeErrors[2].detailedMessage).toEqual('Profile Admin field fieldPermissions: Incorrect map key Something.wrong, should be Correct.Path')
    expect(changeErrors[3].elemID).toEqual(profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'))
    expect(changeErrors[3].detailedMessage).toEqual('Profile Admin field layoutAssignments: Incorrect map key Account_Account_Layout@bs, should be new_account_layout_name@s')
  })

  it('should not validate map keys on delete', async () => {
    breakInstanceMaps(profileInstance)

    const changeErrors = await runChangeValidator(profileInstance, undefined)
    expect(changeErrors).toHaveLength(0)
  })
})
