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
import _ from 'lodash'
import {
  ObjectType, Field, getChangeElement, CORE_ANNOTATIONS, isAdditionChange,
  isFieldChange, InstanceElement, ElemID, Change,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { PROFILE_METADATA_TYPE, ADMIN_PROFILE, API_NAME, SALESFORCE } from '../constants'
import { isCustomObject, apiName, isCustom, createInstanceElement, metadataAnnotationTypes, MetadataTypeAnnotations } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, FieldPermissions, ObjectPermissions } from '../client/types'
import { isInstanceOfType, isMasterDetailField } from './utils'

const log = logger(module)

// We can't set permissions for master detail / required fields / system fields
const shouldSetDefaultPermissions = (field: Field): boolean => (
  isCustom(field.annotations[API_NAME])
  && field.annotations[CORE_ANNOTATIONS.REQUIRED] !== true
  && !isMasterDetailField(field)
)

const getFieldPermissions = (field: string): FieldPermissions => ({
  field,
  editable: true,
  readable: true,
})

const getObjectPermissions = (object: string): ObjectPermissions => ({
  object,
  allowCreate: true,
  allowDelete: true,
  allowEdit: true,
  allowRead: true,
  modifyAllRecords: true,
  viewAllRecords: true,
})

const createAdminProfile = (): InstanceElement => createInstanceElement(
  {
    fullName: ADMIN_PROFILE,
    fieldPermissions: [],
    objectPermissions: [],
  } as ProfileInfo,
  new ObjectType({
    elemID: new ElemID(SALESFORCE, PROFILE_METADATA_TYPE),
    annotationRefsOrTypes: _.clone(metadataAnnotationTypes),
    annotations: {
      metadataType: PROFILE_METADATA_TYPE,
      dirName: 'profiles',
      suffix: 'profile',
    } as MetadataTypeAnnotations,
  })
)

const addMissingPermissions = (
  profile: InstanceElement,
  elemType: 'object' | 'field',
  newElements: ReadonlyArray<ObjectType | Field>,
): void => {
  if (newElements.length === 0) {
    return
  }
  const profileValues = profile.value as ProfileInfo
  const existingIds = new Set(
    elemType === 'object'
      ? profileValues.objectPermissions.map(permission => permission.object)
      : profileValues.fieldPermissions.map(permission => permission.field)
  )

  const missingIds = newElements
    .map(elem => apiName(elem))
    .filter(id => !existingIds.has(id))

  if (missingIds.length === 0) {
    return
  }

  log.info(
    'adding admin read / write permissions to new %ss: %s',
    elemType, missingIds.join(', ')
  )

  if (elemType === 'object') {
    profileValues.objectPermissions.push(...missingIds.map(getObjectPermissions))
  } else {
    profileValues.fieldPermissions.push(...missingIds.map(getFieldPermissions))
  }
}

const isAdminProfileChange = (change: Change): change is Change<InstanceElement> => {
  const changeElem = getChangeElement(change)
  return isInstanceOfType(PROFILE_METADATA_TYPE)(changeElem)
    && apiName(changeElem) === ADMIN_PROFILE
}

/**
 * Profile permissions filter.
 * creates default Admin Profile.fieldsPermissions and Profile.objectsPermissions.
 */
const filterCreator: FilterCreator = () => {
  let isPartialAdminProfile = false
  return {
    preDeploy: async changes => {
      const allAdditions = changes.filter(isAdditionChange)

      const newCustomObjects = allAdditions
        .map(getChangeElement)
        .filter(isCustomObject)

      const newFields = [
        ...newCustomObjects.flatMap(objType => Object.values(objType.fields)),
        ...allAdditions.filter(isFieldChange).map(getChangeElement),
      ]
        .filter(shouldSetDefaultPermissions)

      if (newCustomObjects.length === 0 && newFields.length === 0) {
        return
      }

      const adminProfileChange = changes.find(isAdminProfileChange)

      const adminProfile = adminProfileChange !== undefined
        ? getChangeElement(adminProfileChange)
        : createAdminProfile()

      addMissingPermissions(adminProfile, 'object', newCustomObjects)
      addMissingPermissions(adminProfile, 'field', newFields)

      if (adminProfileChange === undefined) {
        // If we did not originally have a change to the admin profile, we need to create a new one
        isPartialAdminProfile = true
        changes.push(
          { action: 'modify', data: { before: createAdminProfile(), after: adminProfile } }
        )
      }
    },
    onDeploy: async changes => {
      if (isPartialAdminProfile) {
        // we created a partial admin profile change, we have to remove it here otherwise it will
        // override the real admin profile
        _.remove(changes, isAdminProfileChange)
      }
      return []
    },
  }
}

export default filterCreator
