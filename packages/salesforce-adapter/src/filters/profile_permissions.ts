import {
  ObjectType, Element, Field, isObjectType, InstanceElement, isField,
  Change, getChangeElement,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { logger } from '@salto/logging'
import {
  FIELD_PERMISSIONS, FIELD_LEVEL_SECURITY_ANNOTATION, FIELD_LEVEL_SECURITY_FIELDS,
  PROFILE_METADATA_TYPE, ADMIN_PROFILE, OBJECT_LEVEL_SECURITY_FIELDS,
  OBJECT_LEVEL_SECURITY_ANNOTATION, OBJECT_PERMISSIONS,
} from '../constants'
import {
  fieldFullName, isCustomObject, Types, apiName,
} from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, FieldPermissions, FieldPermissionsOptions, ObjectPermissionsOptions, ObjectPermissions, ProfileToFieldPermissions, ProfileToObjectPermissions } from '../client/types'
import { generateObjectElemID2ApiName, getCustomObjects, id } from './utils'
import { setProfilePermissions, removePermissionsInfoFromProfile, getProfileInstances,
  findProfile, ADMIN_ELEM_ID, setPermissions, filterPermissions, getPermissionsValues, initProfile, profile2Permissions, getFieldPermissions, getObjectPermissions } from './permissions_utils'

const log = logger(module)

const setProfileFieldPermissions = (field: Field, profile: string,
  permissions: FieldPermissionsOptions):
   void => setProfilePermissions(field, profile, FIELD_LEVEL_SECURITY_ANNOTATION, permissions)

const setProfileObjectPermissions = (object: ObjectType, profile: string,
  permissions: ObjectPermissionsOptions): void => setProfilePermissions(
  object, profile, OBJECT_LEVEL_SECURITY_ANNOTATION, permissions
)

const setDefaultFieldPermissions = (field: Field): void => {
  // We can't set permissions for master detail
  if (field.type.isEqual(Types.primitiveDataTypes.masterdetail)) {
    return
  }
  if (_.isEmpty(getFieldPermissions(field))) {
    setProfileFieldPermissions(field, ADMIN_ELEM_ID.getFullName(),
      { readable: true, editable: true })
    log.debug('set %s field permissions for %s.%s', ADMIN_PROFILE, field.parentID.name, field.name)
  }
}

const setDefaultObjectPermissions = (object: ObjectType): void => {
  if (_.isEmpty(getObjectPermissions(object))) {
    setProfileObjectPermissions(object, ADMIN_ELEM_ID.getFullName(),
      { allowCreate: true,
        allowDelete: true,
        allowEdit: true,
        allowRead: true,
        modifyAllRecords: true,
        viewAllRecords: true })
    log.debug('set %s object permissions for %s', ADMIN_PROFILE, apiName(object))
  }
}

const profile2FieldPermissions = (profileInstance: InstanceElement):
  Record<string, ProfileToFieldPermissions> =>
  profile2Permissions(profileInstance, profileInstance.value[FIELD_PERMISSIONS])

const profile2ObjectPermissions = (profileInstance: InstanceElement):
  Record<string, ProfileToObjectPermissions> =>
  profile2Permissions(profileInstance, profileInstance.value[OBJECT_PERMISSIONS])

const toProfilesFromObject = (object: ObjectType,
  profiles: Record<string, ProfileInfo> = {}): Record<string, ProfileInfo> => {
  if (!getObjectPermissions(object)) {
    return {}
  }
  // Gets the permissions values of the object
  const objectPermissions = getPermissionsValues(object, OBJECT_LEVEL_SECURITY_FIELDS,
    OBJECT_LEVEL_SECURITY_ANNOTATION)

  _.union(...Object.values(objectPermissions)).forEach((profile: string) => {
    initProfile(profiles, profile)
    profiles[profile].objectPermissions.push({
      object: apiName(object),
      allowCreate: objectPermissions.allowCreate.includes(profile),
      allowDelete: objectPermissions.allowDelete.includes(profile),
      allowEdit: objectPermissions.allowEdit.includes(profile),
      allowRead: objectPermissions.allowRead.includes(profile),
      modifyAllRecords: objectPermissions.modifyAllRecords.includes(profile),
      viewAllRecords: objectPermissions.viewAllRecords.includes(profile),
    })
  })
  return profiles
}

const toProfilesFromFields = (object: ObjectType,
  currentProfiles: Record<string, ProfileInfo> = {}): Record<string, ProfileInfo> =>
  Object.values(object.fields).reduce((profiles, field) => {
    if (!getFieldPermissions(field)) {
      return {}
    }
    // Gets the permissions values of the object
    const fieldPermissions = getPermissionsValues(field, FIELD_LEVEL_SECURITY_FIELDS,
      FIELD_LEVEL_SECURITY_ANNOTATION)

    _.union(...Object.values(fieldPermissions)).forEach((profile: string) => {
      initProfile(profiles, profile)
      profiles[profile].fieldPermissions.push({
        field: fieldFullName(object, field),
        readable: fieldPermissions.readable.includes(profile),
        editable: fieldPermissions.editable.includes(profile),
      })
    })
    return profiles
  }, currentProfiles as Record<string, ProfileInfo>)

const toProfiles = (object: ObjectType): ProfileInfo[] =>
  Object.values(toProfilesFromFields(object, toProfilesFromObject(object)))

// ---

/**
 * Profile permissions filter. Handle the mapping from sobject fields
 *  FIELD_LEVEL_SECURITY_ANNOTATION and OBJECT_LEVEL_SECURITY_ANNOTATION
 * annotation and remove Profile.fieldsPermissions and Profile.objectsPermissions.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const customObjectTypes = getCustomObjects(elements)
    if (_.isEmpty(customObjectTypes)) {
      return
    }
    const profileInstances = getProfileInstances(elements)
    if (_.isEmpty(profileInstances)) {
      return
    }

    const fieldPermissionsPerProfile = profileInstances.map(profile2FieldPermissions)
    const fieldPermissions: Record<string, ProfileToFieldPermissions> = _.merge({},
      ...fieldPermissionsPerProfile)

    const objectPermissionsPerProfile = profileInstances.map(profile2ObjectPermissions)
    const objectPermissions: Record<string, ProfileToObjectPermissions> = _.merge({},
      ...objectPermissionsPerProfile)
    const objectElemID2ApiName = generateObjectElemID2ApiName(customObjectTypes)

    // Add field permissions to all fetched elements
    customObjectTypes.forEach(obj => {
      Object.values(obj.fields).forEach(field => {
        const fullName = fieldFullName(objectElemID2ApiName[id(obj)] || obj, field)
        setPermissions(field, FIELD_LEVEL_SECURITY_ANNOTATION, fullName,
          fieldPermissions, profileInstances)
      })
      setPermissions(obj, OBJECT_LEVEL_SECURITY_ANNOTATION, apiName(obj),
        objectPermissions, profileInstances)
    })

    // Remove field permissions from Profile Instances & Type to avoid information duplication
    removePermissionsInfoFromProfile(profileInstances, elements,
      [FIELD_PERMISSIONS, OBJECT_PERMISSIONS])
  },

  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after) && isCustomObject(after)) {
      // Set default permissions for all fields of new object
      setDefaultObjectPermissions(after)
      Object.values(after.fields).forEach(field => {
        setDefaultFieldPermissions(field)
      })

      const profiles = toProfiles(after)
      return client.update(PROFILE_METADATA_TYPE, profiles)
    }
    return []
  },

  onUpdate: async (before: Element, after: Element, changes: ReadonlyArray<Change>):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after) && isCustomObject(before))) {
      return []
    }

    wu(changes)
      .forEach(c => {
        const changeElement = getChangeElement(c)
        if (isField(changeElement) && c.action === 'add') {
          setDefaultFieldPermissions(after.fields[changeElement.name])
        }
      })

    const emptyFieldPermissions = (permissions: FieldPermissions): FieldPermissions =>
      ({ field: permissions.field, readable: false, editable: false })

    const emptyObjectPermissions = (permissions: ObjectPermissions): ObjectPermissions =>
      ({ object: permissions.object,
        allowCreate: false,
        allowDelete: false,
        allowEdit: false,
        allowRead: false,
        modifyAllRecords: false,
        viewAllRecords: false })

    const beforeProfiles = toProfiles(before)
    const afterProfiles = toProfiles(after)
    const profiles = afterProfiles
      .map(afterProfile => {
        let { fieldPermissions, objectPermissions } = afterProfile
        const beforeProfile = findProfile(beforeProfiles, afterProfile.fullName)
        if (beforeProfile) {
          fieldPermissions = filterPermissions(fieldPermissions,
            beforeProfile.fieldPermissions, afterProfile.fieldPermissions, emptyFieldPermissions)
          objectPermissions = filterPermissions(objectPermissions,
            beforeProfile.objectPermissions, afterProfile.objectPermissions, emptyObjectPermissions)
        }
        return { fullName: afterProfile.fullName, fieldPermissions, objectPermissions }
      })
      // Add missing permissions for profiles that dosen't exists in after
      //   with =false values for all the permissions options
      .concat(beforeProfiles
        .filter(p => _.isUndefined(findProfile(afterProfiles, p.fullName)))
        .map(p => ({ fullName: p.fullName,
          fieldPermissions: p.fieldPermissions.map(emptyFieldPermissions),
          objectPermissions: p.objectPermissions.map(emptyObjectPermissions) })))
      // Filter out empty permissions
      .filter(p => (p.fieldPermissions.length > 0) || (p.objectPermissions.length > 0))

    return client.update(PROFILE_METADATA_TYPE, profiles)
  },
})

export default filterCreator
