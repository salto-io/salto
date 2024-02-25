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
import _ from 'lodash'
import {
  ObjectType,
  Field,
  getChangeData,
  CORE_ANNOTATIONS,
  isFieldChange,
  InstanceElement,
  ElemID,
  toChange,
  isAdditionChange,
  ModificationChange,
  AdditionChange,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { PROFILE_METADATA_TYPE, API_NAME, SALESFORCE } from '../constants'
import {
  isCustomObject,
  isCustom,
  createInstanceElement,
  metadataAnnotationTypes,
  MetadataTypeAnnotations,
} from '../transformers/transformer'
import { LocalFilterCreator } from '../filter'
import {
  ProfileInfo,
  FieldPermissions,
  ObjectPermissions,
} from '../client/types'
import {
  apiNameSync,
  isInstanceOfTypeChangeSync,
  isMasterDetailField,
} from './utils'

const { awu } = collections.asynciterable
const { isDefined } = values

const log = logger(module)

// We can't set permissions for master detail / required fields / system fields
const shouldSetDefaultPermissions = (field: Field): boolean =>
  isCustom(field.annotations[API_NAME]) &&
  field.annotations[CORE_ANNOTATIONS.REQUIRED] !== true &&
  !isMasterDetailField(field)

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

const createProfile = (profileName: string): InstanceElement =>
  createInstanceElement(
    {
      fullName: profileName,
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
    }),
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
      ? profileValues.objectPermissions.map((permission) => permission.object)
      : profileValues.fieldPermissions.map((permission) => permission.field),
  )

  const missingIds = newElements
    .map((elem) => apiNameSync(elem))
    .filter(isDefined)
    .filter((id) => !existingIds.has(id))

  if (missingIds.length === 0) {
    return
  }

  log.info(
    'adding %s read / write permissions to new %ss: %s',
    apiNameSync(profile),
    elemType,
    missingIds.join(', '),
  )

  if (elemType === 'object') {
    profileValues.objectPermissions.push(
      ...missingIds.map(getObjectPermissions),
    )
  } else {
    profileValues.fieldPermissions.push(...missingIds.map(getFieldPermissions))
  }
}

/**
 * If any object types were added, add them to the configured FLS Profiles' objectPermissions section.
 * Do the same with added fields and fieldPermissions.
 * No reason to handle deleted Profiles.
 */
const filterCreator: LocalFilterCreator = ({ config }) => {
  let originalProfileChangesByName: Record<
    string,
    AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
  > = {}
  return {
    name: 'profilePermissionsFilter',
    preDeploy: async (changes) => {
      const allAdditions = changes.filter(isAdditionChange)

      const newCustomObjects = (await awu(allAdditions)
        .map(getChangeData)
        .filter(isCustomObject)
        .toArray()) as ObjectType[]

      const newFields = [
        ...newCustomObjects.flatMap((objType) => Object.values(objType.fields)),
        ...allAdditions.filter(isFieldChange).map(getChangeData),
      ].filter(shouldSetDefaultPermissions)

      if (newCustomObjects.length === 0 && newFields.length === 0) {
        return
      }

      const { flsProfiles } = config

      log.debug(
        'adding FLS permissions to the following Profiles: %s',
        safeJsonStringify(flsProfiles),
      )

      // No reason to add FLS Permissions to a Profile that is being deleted
      const [flsProfileChanges, removedFLSProfileChanges] = _.partition(
        changes.filter(isInstanceOfTypeChangeSync(PROFILE_METADATA_TYPE)),
        isAdditionOrModificationChange,
      )

      originalProfileChangesByName = _.keyBy(
        flsProfileChanges,
        (change) => apiNameSync(getChangeData(change)) ?? '',
      )
      const removedFLSProfileNames = new Set(
        removedFLSProfileChanges.map(
          (change) => apiNameSync(getChangeData(change)) ?? '',
        ),
      )

      flsProfiles
        .filter((flsProfile) => !removedFLSProfileNames.has(flsProfile))
        .forEach((profileName) => {
          const profileChange = originalProfileChangesByName[profileName]
          if (profileChange !== undefined) {
            _.pull(changes, profileChange)
          }
          const before =
            profileChange === undefined || isAdditionChange(profileChange)
              ? undefined
              : profileChange.data.before
          const after = profileChange
            ? profileChange.data.after.clone()
            : createProfile(profileName)
          addMissingPermissions(after, 'object', newCustomObjects)
          addMissingPermissions(after, 'field', newFields)
          changes.push(toChange({ before, after }))
        })
    },
    onDeploy: async (changes) => {
      const appliedFLSProfileChanges = changes
        .filter(isInstanceOfTypeChangeSync(PROFILE_METADATA_TYPE))
        .filter(isAdditionOrModificationChange)
        .filter((profileChange) =>
          config.flsProfiles.includes(
            apiNameSync(getChangeData(profileChange)) ?? '',
          ),
        )
      const appliedFLSProfileNames = appliedFLSProfileChanges.map(
        (change) => apiNameSync(getChangeData(change)) ?? '',
      )

      // Revert to the original Profile Addition/Modification changes that were applied
      _.pullAll(changes, appliedFLSProfileChanges)
      Object.entries(originalProfileChangesByName)
        .filter(([profileName]) => appliedFLSProfileNames.includes(profileName))
        .forEach(([, originalChange]) => {
          changes.push(originalChange)
        })
    },
  }
}

export default filterCreator
