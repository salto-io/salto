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
  ObjectType, Element, Field, isObjectType, isField, Change,
  getChangeElement, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { logger } from '@salto-io/logging'
import { PROFILE_METADATA_TYPE, ADMIN_PROFILE } from '../constants'
import { isCustomObject, apiName, Types } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, FieldPermissions, ObjectPermissions } from '../client/types'

const log = logger(module)

// We can't set permissions for master detail or required fields
const shouldSetDefaultPermissions = (field: Field): boolean => (
  field.annotations[CORE_ANNOTATIONS.REQUIRED] !== true
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
  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after) && isCustomObject(after)) {
      // Make sure Admin has permissions to the object and the new fields
      const adminProfile = new ProfileInfo(
        ADMIN_PROFILE,
        Object.values(after.fields).filter(shouldSetDefaultPermissions).map(getFieldPermissions),
        [getObjectPermissions(after)],
      )
      log.debug('Adding admin permissions to %s', after.elemID.getFullName())
      return client.update(PROFILE_METADATA_TYPE, adminProfile)
    }
    return []
  },

  onUpdate: async (before: Element, after: Element, changes: ReadonlyArray<Change>):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after) && isCustomObject(before))) {
      return []
    }

    // Make sure Admin has permissions to all new fields
    const newFields = wu(changes)
      .filter(change => change.action === 'add')
      .map(getChangeElement)
      .filter(isField)
      .filter(shouldSetDefaultPermissions)
      .map(fieldAddition => after.fields[fieldAddition.name])
      .toArray()

    if (newFields.length === 0) {
      return []
    }

    const adminProfile = new ProfileInfo(
      ADMIN_PROFILE,
      newFields.map(getFieldPermissions),
    )
    log.debug('Adding admin permissions to %d new fields in %s', newFields.length, after.elemID.getFullName())

    return client.update(PROFILE_METADATA_TYPE, adminProfile)
  },
})

export default filterCreator
