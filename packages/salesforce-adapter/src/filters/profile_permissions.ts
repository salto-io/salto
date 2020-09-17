/*
*                      Copyright 2020 Salto Labs Ltd.
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
  ObjectType, Field, getChangeElement, CORE_ANNOTATIONS, isAdditionChange, isObjectTypeChange,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { PROFILE_METADATA_TYPE, ADMIN_PROFILE, API_NAME } from '../constants'
import { isCustomObject, apiName, Types, isCustom } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, FieldPermissions, ObjectPermissions } from '../client/types'

const log = logger(module)

// We can't set permissions for master detail / required fields / system fields
const shouldSetDefaultPermissions = (field: Field): boolean => (
  isCustom(field.annotations[API_NAME])
  && field.annotations[CORE_ANNOTATIONS.REQUIRED] !== true
  && !field.type.elemID.isEqual(Types.primitiveDataTypes.MasterDetail.elemID)
)

const getFieldPermissions = (field: Field): FieldPermissions => ({
  field: apiName(field),
  editable: true,
  readable: true,
})

const getObjectPermissions = (object: ObjectType): ObjectPermissions => ({
  object: apiName(object),
  allowCreate: true,
  allowDelete: true,
  allowEdit: true,
  allowRead: true,
  modifyAllRecords: true,
  viewAllRecords: true,
})

/**
 * Profile permissions filter.
 * creates default Admin Profile.fieldsPermissions and Profile.objectsPermissions.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onDeploy: async changes => {
    const customObjectChanges = changes
      .filter(isObjectTypeChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => isCustomObject(getChangeElement(change)))

    const newCustomObjects = customObjectChanges
      .filter(isAdditionChange)
      .map(getChangeElement)

    const newFieldsForPermissions = customObjectChanges
      .flatMap(change => (
        isAdditionChange(change)
          ? Object.values(change.data.after.fields)
          : Object.entries(change.data.after.fields)
            .filter(([name]) => change.data.before.fields[name] === undefined)
            .map(([_name, field]) => field)
      ))
      .filter(shouldSetDefaultPermissions)

    if (newFieldsForPermissions.length === 0 && newCustomObjects.length === 0) {
      return []
    }

    // Make sure Admin has permissions to new custom objects and the new custom fields
    const adminProfile = new ProfileInfo(
      ADMIN_PROFILE,
      newFieldsForPermissions.map(getFieldPermissions),
      newCustomObjects.map(getObjectPermissions)
    )
    log.debug(
      'adding admin permissions to new custom objects %s and new custom fields %s',
      newCustomObjects.map(obj => obj.elemID.getFullName()).join(', '),
      newFieldsForPermissions.map(field => field.elemID.getFullName()).join(', ')
    )
    return client.update(PROFILE_METADATA_TYPE, adminProfile)
  },
})

export default filterCreator
