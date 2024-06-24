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
import { getChangeData, isAdditionChange, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { NetsuiteChangeValidator } from './types'
import { isCustomRecordType } from '../types'

const USE_PERMISSION_LIST = 'USEPERMISSIONLIST'
const REQUIRE_CUSTOM_RECORD_ENTRIES_PERMISSION = 'CUSTRECORDENTRYPERM'
const NO_PERMISSION_REQUIRED = 'NONENEEDED'

const hasPermissions = (customRecordType: ObjectType): boolean =>
  values.isPlainRecord(customRecordType.annotations.permissions?.permission) &&
  Object.keys(customRecordType.annotations.permissions.permission).length > 0

const usePermissionOnListWithEmptyList = (customRecordType: ObjectType): boolean =>
  customRecordType.annotations.accesstype === USE_PERMISSION_LIST && !hasPermissions(customRecordType)

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isObjectType)
    .filter(isCustomRecordType)
    .filter(usePermissionOnListWithEmptyList)
    .map(customRecordType => ({
      elemID: customRecordType.elemID,
      severity: 'Error',
      message: 'Access Type is "Permission List" with No Permissions Specified',
      detailedMessage:
        `Cannot create a Custom Record Type without specifying permissions when the access type is set to '${USE_PERMISSION_LIST}'.` +
        `To create this Custom Record Type, you must either add permissions or change the access type to '${REQUIRE_CUSTOM_RECORD_ENTRIES_PERMISSION}' or '${NO_PERMISSION_REQUIRED}'.`,
    }))

export default changeValidator
