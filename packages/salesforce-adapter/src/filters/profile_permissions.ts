import {
  ObjectType, Element, Field, isObjectType, InstanceElement, isField,
  Change, getChangeElement, getAnnotationValue, ElemID,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { logger } from '@salto/logging'
import {
  FIELD_PERMISSIONS, FIELD_LEVEL_SECURITY_ANNOTATION,
  PROFILE_METADATA_TYPE, ADMIN_PROFILE,
  OBJECT_LEVEL_SECURITY_ANNOTATION, OBJECT_PERMISSIONS,
} from '../constants'
import {
  fieldFullName, isCustomObject, Types, apiName, sfCase,
} from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, FieldPermissions, FieldPermissionsOptions, ObjectPermissionsOptions,
  ObjectPermissions, ProfileToFieldPermissions, ProfileToObjectPermissions, OBJECT_PERMISSIONS_OPTIONS, FIELD_PERMISSIONS_OPTIONS, PermissionsTypes } from '../client/types'
import { generateObjectElemID2ApiName, getCustomObjects, id } from './utils'
import { setProfilePermissions, removePermissionsInfoFromProfile, getProfileInstances,
  findProfile, ADMIN_ELEM_ID, setPermissions, filterPermissions, getPermissionsValues,
  profile2Permissions, getFieldPermissions, getObjectPermissions } from './permissions_utils'

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
      Object.assign({}, ...OBJECT_PERMISSIONS_OPTIONS.map(option => ({ [option]: true }))))
    log.debug('set %s object permissions for %s', ADMIN_PROFILE, apiName(object))
  }
}

const profile2FieldPermissions = (profileInstance: InstanceElement):
  Record<string, ProfileToFieldPermissions> =>
  profile2Permissions(profileInstance, profileInstance.value[FIELD_PERMISSIONS])

const profile2ObjectPermissions = (profileInstance: InstanceElement):
  Record<string, ProfileToObjectPermissions> =>
  profile2Permissions(profileInstance, profileInstance.value[OBJECT_PERMISSIONS])

const toProfilePermissions = <T = PermissionsTypes>(element: Element, annotationName: string,
  permissionsOptionsFields: readonly string[], fullNameObject: Record<string, string>,
  permissions: Record<string, T[]> = {}): Record<string, T[]> => {
  if (!getAnnotationValue(element, annotationName)) {
    return {}
  }
  const elementPermissions = getPermissionsValues(element, permissionsOptionsFields, annotationName)
  _.union(...Object.values(elementPermissions)).forEach((profile: string) => {
    if (_.isUndefined(permissions[profile])) {
      permissions[profile] = [] as T[]
    }
    permissions[profile].push(Object.assign({}, fullNameObject,
      ...permissionsOptionsFields.map(option =>
        ({ [option]: elementPermissions[option].includes(profile) }))))
  })
  return permissions
}

const toProfilesObjectPermissions = (object: ObjectType): Record<string, ObjectPermissions[]> =>
  toProfilePermissions(object, OBJECT_LEVEL_SECURITY_ANNOTATION,
    OBJECT_PERMISSIONS_OPTIONS, { object: apiName(object) })

const toProfilesFieldPermissions = (object: ObjectType): Record<string, FieldPermissions[]> =>
  Object.values(object.fields).reduce((permissions, field) =>
    (toProfilePermissions(field, FIELD_LEVEL_SECURITY_ANNOTATION,
      FIELD_PERMISSIONS_OPTIONS, { field: fieldFullName(object, field) },
      permissions)), {} as Record<string, FieldPermissions[]>)

const toProfiles = (object: ObjectType): ProfileInfo[] => {
  const profileToObjectPermissions = toProfilesObjectPermissions(object)
  const profileToFieldPermissions = toProfilesFieldPermissions(object)
  const profiles = Object.keys(profileToObjectPermissions)
    .concat(Object.keys(profileToFieldPermissions))
  return profiles.map(profile => new ProfileInfo(sfCase(ElemID.fromFullName(profile).name),
    profileToFieldPermissions[profile] || [], profileToObjectPermissions[profile] || []))
}

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
    removePermissionsInfoFromProfile(elements, [FIELD_PERMISSIONS, OBJECT_PERMISSIONS])
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
      Object.assign({ object: permissions.object },
        ...OBJECT_PERMISSIONS_OPTIONS.map(option => ({ [option]: false })))

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
