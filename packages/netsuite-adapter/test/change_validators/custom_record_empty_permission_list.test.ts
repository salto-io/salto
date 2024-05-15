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
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { NETSUITE, SCRIPT_ID } from '../../src/constants'
import customRecordEmptyPermissionList from '../../src/change_validators/custom_record_empty_permission_list'

describe('custom record empty permission list validator', () => {
  let customRecord: ObjectType
  const custRecordObject = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord_test'),
    annotations: {
      metadataType: 'customrecordtype',
      [SCRIPT_ID]: 'customrecord_test',
      accesstype: 'USEPERMISSIONLIST',
    },
  })

  beforeEach(() => {
    customRecord = custRecordObject.clone()
  })
  it('should return an error when there is a custom record without permissions and with accesstype USEPERMISSIONLIST', async () => {
    const errors = await customRecordEmptyPermissionList([toChange({ after: customRecord })])
    expect(errors.length).toBe(1)
    expect(errors[0]).toEqual({
      elemID: customRecord.elemID,
      severity: 'Error',
      message: 'Access Type is "Permission List" with No Permissions Specified',
      detailedMessage:
        "Cannot create a Custom Record Type without specifying permissions when the access type is set to 'USEPERMISSIONLIST'." +
        "To create this Custom Record Type, you must either add permissions or change the access type to 'CUSTRECORDENTRYPERM' or 'NONENEEDED'.",
    })
  })
  it('should not return an error when there are permissions', async () => {
    customRecord.annotations.permissions = {
      permission: {
        SYSTEM_ADMINISTRATOR: {
          permittedlevel: 'CREATE',
          permittedrole: 'SYSTEM_ADMINISTRATOR',
          restriction: 'EDIT',
        },
      },
    }
    const errors = await customRecordEmptyPermissionList([toChange({ after: customRecord })])
    expect(errors.length).toBe(0)
  })
  it('should not return an error when the accesstype is different than USEPERMISSIONLIST', async () => {
    customRecord.annotations.accesstype = 'CUSTRECORDENTRYPERM'
    const errors = await customRecordEmptyPermissionList([toChange({ after: customRecord })])
    expect(errors.length).toBe(0)
  })
})
