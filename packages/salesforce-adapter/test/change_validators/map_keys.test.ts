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
import {
  ChangeError,
  ObjectType,
  toChange,
  InstanceElement,
} from '@salto-io/adapter-api'
import mapKeysValidator from '../../src/change_validators/map_keys'
import { generateProfileType, generatePermissionSetType } from '../utils'
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'

const generateProfileInstance = (profileObj: ObjectType): InstanceElement =>
  new InstanceElement('Admin', profileObj, {
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
      'Account_Account_Layout@bs': [{ layout: 'Account-Account Layout' }],
      'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs':
        [
          {
            layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
            recordType: 'something',
          },
        ],
    },
  })

const generatePermissionSetInstance = (
  permissionSetObj: ObjectType,
): InstanceElement =>
  new InstanceElement('Buyer', permissionSetObj, {
    [INSTANCE_FULL_NAME_FIELD]: 'Buyer',
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
  })

const breakProfileInstanceMaps = (profileInstance: InstanceElement): void => {
  profileInstance.value.applicationVisibilities.otherApp = {
    application: 'other app',
    default: true,
    visible: false,
  }
  profileInstance.value.fieldPermissions.Account.wrongName =
    profileInstance.value.fieldPermissions.Account.AccountNumber
  delete profileInstance.value.fieldPermissions.Account.AccountNumber
  profileInstance.value.fieldPermissions.Something = {
    wrong: {
      field: 'Correct.Path',
      editable: true,
      readable: true,
    },
  }
  profileInstance.value.layoutAssignments[
    'Account_Account_Layout@bs'
  ][0].layout = 'new account layout name'
}

const breakPermissionSetInstanceMaps = (
  permissionSetInstance: InstanceElement,
): void => {
  permissionSetInstance.value.applicationVisibilities.otherApp = {
    application: 'other app',
    default: true,
    visible: false,
  }
  permissionSetInstance.value.fieldPermissions.Account.wrongName =
    permissionSetInstance.value.fieldPermissions.Account.AccountNumber
  delete permissionSetInstance.value.fieldPermissions.Account.AccountNumber
  permissionSetInstance.value.fieldPermissions.Something = {
    wrong: {
      field: 'Correct.Path',
      editable: true,
      readable: true,
    },
  }
}

describe('profile permission set map keys change validator', () => {
  const runChangeValidator = (
    before?: InstanceElement,
    after?: InstanceElement,
  ): Promise<ReadonlyArray<ChangeError>> =>
    mapKeysValidator([toChange({ before, after })])

  describe('Profile', () => {
    let profileObj: ObjectType
    let profileInstance: InstanceElement
    beforeEach(() => {
      profileObj = generateProfileType(true)
      profileInstance = generateProfileInstance(profileObj)
    })

    it('should have no errors if keys are valid', async () => {
      const afterProfileObj = generateProfileType(true)
      const afterProfileInstance = generateProfileInstance(afterProfileObj)
      const changeErrors = await runChangeValidator(
        profileInstance,
        afterProfileInstance,
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should have error for invalid keys on update', async () => {
      const afterProfileObj = generateProfileType(true)
      const afterProfileInstance = generateProfileInstance(afterProfileObj)
      breakProfileInstanceMaps(afterProfileInstance)

      const changeErrors = await runChangeValidator(
        profileInstance,
        afterProfileInstance,
      )
      expect(changeErrors).toHaveLength(4)
      expect(changeErrors.map((c) => c.severity)).toEqual([
        'Error',
        'Error',
        'Error',
        'Error',
      ])
      expect(changeErrors[0].elemID).toEqual(
        afterProfileInstance.elemID.createNestedID(
          'applicationVisibilities',
          'otherApp',
        ),
      )
      expect(changeErrors[0].detailedMessage).toEqual(
        'Profile Admin field applicationVisibilities: Incorrect map key otherApp, should be other_app@s',
      )
      expect(changeErrors[1].elemID).toEqual(
        afterProfileInstance.elemID.createNestedID(
          'fieldPermissions',
          'Account',
          'wrongName',
        ),
      )
      expect(changeErrors[1].detailedMessage).toEqual(
        'Profile Admin field fieldPermissions: Incorrect map key Account.wrongName, should be Account.AccountNumber',
      )
      expect(changeErrors[2].elemID).toEqual(
        afterProfileInstance.elemID.createNestedID(
          'fieldPermissions',
          'Something',
        ),
      )
      expect(changeErrors[2].detailedMessage).toEqual(
        'Profile Admin field fieldPermissions: Incorrect map key Something.wrong, should be Correct.Path',
      )
      expect(changeErrors[3].elemID).toEqual(
        afterProfileInstance.elemID.createNestedID(
          'layoutAssignments',
          'Account_Account_Layout@bs',
        ),
      )
      expect(changeErrors[3].detailedMessage).toEqual(
        'Profile Admin field layoutAssignments: Incorrect map key Account_Account_Layout@bs, should be new_account_layout_name@s',
      )
    })

    it('should have error for invalid keys on add', async () => {
      breakProfileInstanceMaps(profileInstance)

      const changeErrors = await runChangeValidator(undefined, profileInstance)
      expect(changeErrors).toHaveLength(4)
      expect(changeErrors.map((c) => c.severity)).toEqual([
        'Error',
        'Error',
        'Error',
        'Error',
      ])
      expect(changeErrors[0].elemID).toEqual(
        profileInstance.elemID.createNestedID(
          'applicationVisibilities',
          'otherApp',
        ),
      )
      expect(changeErrors[0].detailedMessage).toEqual(
        'Profile Admin field applicationVisibilities: Incorrect map key otherApp, should be other_app@s',
      )
      expect(changeErrors[1].elemID).toEqual(
        profileInstance.elemID.createNestedID(
          'fieldPermissions',
          'Account',
          'wrongName',
        ),
      )
      expect(changeErrors[1].detailedMessage).toEqual(
        'Profile Admin field fieldPermissions: Incorrect map key Account.wrongName, should be Account.AccountNumber',
      )
      expect(changeErrors[2].elemID).toEqual(
        profileInstance.elemID.createNestedID('fieldPermissions', 'Something'),
      )
      expect(changeErrors[2].detailedMessage).toEqual(
        'Profile Admin field fieldPermissions: Incorrect map key Something.wrong, should be Correct.Path',
      )
      expect(changeErrors[3].elemID).toEqual(
        profileInstance.elemID.createNestedID(
          'layoutAssignments',
          'Account_Account_Layout@bs',
        ),
      )
      expect(changeErrors[3].detailedMessage).toEqual(
        'Profile Admin field layoutAssignments: Incorrect map key Account_Account_Layout@bs, should be new_account_layout_name@s',
      )
    })

    it('should have error on invalid nacl structure', async () => {
      const afterProfileObj = generateProfileType(true)
      const afterProfileInstance = new InstanceElement(
        'Admin',
        afterProfileObj,
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
              Contact: {
                // invalid
                HasOptedOutOfEmail: {
                  field: 'Contact.HasOptedOutOfEmail',
                  editable: true,
                  readable: true,
                },
              },
            },
          },
        },
      )

      const changeErrors = await runChangeValidator(
        profileInstance,
        afterProfileInstance,
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(
        afterProfileInstance.elemID.createNestedID(
          'fieldPermissions',
          'Account',
          'Contact',
        ),
      )
      expect(changeErrors[0].detailedMessage).toEqual(
        "Profile Admin field fieldPermissions: Nested value 'field' not found",
      )
    })

    it('should not validate map keys on delete', async () => {
      breakProfileInstanceMaps(profileInstance)

      const changeErrors = await runChangeValidator(profileInstance, undefined)
      expect(changeErrors).toHaveLength(0)
    })
  })
  describe('Permission set', () => {
    let permissionSetObj: ObjectType
    let permissionSetInstance: InstanceElement
    beforeEach(() => {
      permissionSetObj = generatePermissionSetType(true)
      permissionSetInstance = generatePermissionSetInstance(permissionSetObj)
    })

    it('should have no errors if keys are valid', async () => {
      const afterPermissionSetObj = generatePermissionSetType(true)
      const afterPermissionSetInstance = generatePermissionSetInstance(
        afterPermissionSetObj,
      )
      const changeErrors = await runChangeValidator(
        permissionSetInstance,
        afterPermissionSetInstance,
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should have error for invalid keys on update', async () => {
      const afterPermissionSetObj = generatePermissionSetType(true)
      const afterPermissionSetInstance = generatePermissionSetInstance(
        afterPermissionSetObj,
      )
      breakPermissionSetInstanceMaps(afterPermissionSetInstance)

      const changeErrors = await runChangeValidator(
        permissionSetInstance,
        afterPermissionSetInstance,
      )
      expect(changeErrors).toHaveLength(3)
      expect(changeErrors.map((c) => c.severity)).toEqual([
        'Error',
        'Error',
        'Error',
      ])
      expect(changeErrors[0].elemID).toEqual(
        afterPermissionSetInstance.elemID.createNestedID(
          'applicationVisibilities',
          'otherApp',
        ),
      )
      expect(changeErrors[0].detailedMessage).toEqual(
        'PermissionSet Buyer field applicationVisibilities: Incorrect map key otherApp, should be other_app@s',
      )
      expect(changeErrors[1].elemID).toEqual(
        afterPermissionSetInstance.elemID.createNestedID(
          'fieldPermissions',
          'Account',
          'wrongName',
        ),
      )
      expect(changeErrors[1].detailedMessage).toEqual(
        'PermissionSet Buyer field fieldPermissions: Incorrect map key Account.wrongName, should be Account.AccountNumber',
      )
      expect(changeErrors[2].elemID).toEqual(
        afterPermissionSetInstance.elemID.createNestedID(
          'fieldPermissions',
          'Something',
        ),
      )
      expect(changeErrors[2].detailedMessage).toEqual(
        'PermissionSet Buyer field fieldPermissions: Incorrect map key Something.wrong, should be Correct.Path',
      )
    })

    it('should have error for invalid keys on add', async () => {
      breakPermissionSetInstanceMaps(permissionSetInstance)

      const changeErrors = await runChangeValidator(
        undefined,
        permissionSetInstance,
      )
      expect(changeErrors).toHaveLength(3)
      expect(changeErrors.map((c) => c.severity)).toEqual([
        'Error',
        'Error',
        'Error',
      ])
      expect(changeErrors[0].elemID).toEqual(
        permissionSetInstance.elemID.createNestedID(
          'applicationVisibilities',
          'otherApp',
        ),
      )
      expect(changeErrors[0].detailedMessage).toEqual(
        'PermissionSet Buyer field applicationVisibilities: Incorrect map key otherApp, should be other_app@s',
      )
      expect(changeErrors[1].elemID).toEqual(
        permissionSetInstance.elemID.createNestedID(
          'fieldPermissions',
          'Account',
          'wrongName',
        ),
      )
      expect(changeErrors[1].detailedMessage).toEqual(
        'PermissionSet Buyer field fieldPermissions: Incorrect map key Account.wrongName, should be Account.AccountNumber',
      )
      expect(changeErrors[2].elemID).toEqual(
        permissionSetInstance.elemID.createNestedID(
          'fieldPermissions',
          'Something',
        ),
      )
      expect(changeErrors[2].detailedMessage).toEqual(
        'PermissionSet Buyer field fieldPermissions: Incorrect map key Something.wrong, should be Correct.Path',
      )
    })

    it('should have error on invalid nacl structure', async () => {
      const afterPermissionSetObj = generatePermissionSetType(true)
      const afterPermissionSetInstance = new InstanceElement(
        'Buyer',
        afterPermissionSetObj,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'Buyer',
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
              Contact: {
                // invalid
                HasOptedOutOfEmail: {
                  field: 'Contact.HasOptedOutOfEmail',
                  editable: true,
                  readable: true,
                },
              },
            },
          },
        },
      )

      const changeErrors = await runChangeValidator(
        permissionSetInstance,
        afterPermissionSetInstance,
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(
        afterPermissionSetInstance.elemID.createNestedID(
          'fieldPermissions',
          'Account',
          'Contact',
        ),
      )
      expect(changeErrors[0].detailedMessage).toEqual(
        "PermissionSet Buyer field fieldPermissions: Nested value 'field' not found",
      )
    })

    it('should not validate map keys on delete', async () => {
      breakPermissionSetInstanceMaps(permissionSetInstance)

      const changeErrors = await runChangeValidator(
        permissionSetInstance,
        undefined,
      )
      expect(changeErrors).toHaveLength(0)
    })
  })
})
