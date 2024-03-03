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
import { getChangeData, isAdditionOrModificationChange, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { NetsuiteChangeValidator } from './types'
import { isCustomRecordType } from '../types'

const hasPermissions = (customRecord: ObjectType): boolean =>
  values.isPlainRecord(customRecord.annotations.permissions.permission) &&
  Object.keys(customRecord.annotations.permissions.permission).length > 0

const usesPermissionListWithEmptyList = (customRecord: ObjectType): boolean =>
  customRecord.annotations.accesstype === 'USEPERMISSIONLIST' && !hasPermissions(customRecord)

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isObjectType)
    .filter(isCustomRecordType)
    .filter(usesPermissionListWithEmptyList)
    .map(customRecord => ({
      elemID: customRecord.elemID,
      severity: 'Error',
      message: 'Access type is permission list with no permissions specified',
      detailedMessage:
        "Cannot deploy a Custom Record Type without permissions when the access type is set to 'USEPERMISSIONLIST'." +
        "To deploy this Custom Record Type, either add permissions or change the access type to 'CUSTRECORDENTRYPERM' or 'NONENEEDED'.",
    }))

export default changeValidator
