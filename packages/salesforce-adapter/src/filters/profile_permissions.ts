import {
  ObjectType, Element, Field, isObjectType, InstanceElement, isField, Type,
  Change, getChangeElement, getAnnotationValue, ElemID, Values, findElement, ReferenceExpression,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { collections } from '@salto/lowerdash'
import { logger } from '@salto/logging'
import {
  FIELD_PERMISSIONS, FIELD_LEVEL_SECURITY_ANNOTATION,
  PROFILE_METADATA_TYPE, ADMIN_PROFILE,
  OBJECT_LEVEL_SECURITY_ANNOTATION, OBJECT_PERMISSIONS, SALESFORCE, INSTANCE_FULL_NAME_FIELD,
} from '../constants'
import {
  fieldFullName, isCustomObject, Types, apiName, bpCase, sfCase,
} from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, FieldPermissions, FieldPermissionsOptions, ObjectPermissionsOptions,
  ObjectPermissions, OBJECT_PERMISSIONS_OPTIONS, FIELD_PERMISSIONS_OPTIONS,
  PermissionsTypes, PermissionsOptionsFieldsTypes } from '../client/types'
import { generateObjectElemID2ApiName, getCustomObjects, id, boolValue,
  getInstancesOfMetadataType, removeFieldsFromInstanceAndType } from './utils'

const log = logger(module)

const { makeArray } = collections.array

type ProfileToFieldPermissions = Record<string, FieldPermissions>
type ProfileToObjectPermissions = Record<string, ObjectPermissions>

const ADMIN_ELEM_ID = new ElemID(SALESFORCE, bpCase(PROFILE_METADATA_TYPE),
  'instance', ADMIN_PROFILE)

const getFieldPermissions = (field: Field): Values =>
  (getAnnotationValue(field, FIELD_LEVEL_SECURITY_ANNOTATION))

const getObjectPermissions = (object: ObjectType): Values =>
  (getAnnotationValue(object, OBJECT_LEVEL_SECURITY_ANNOTATION))

const setProfilePermissions = <T = PermissionsTypes>
  (element: ObjectType | Field, profile: ElemID,
    annotationName: string, permissions: T, createReferences = false): void => {
  const isElementName = (name: string): boolean => !['object', 'field'].includes(name)

  let profileName = profile.name
  if (_.isEmpty(getAnnotationValue(element, annotationName))) {
    element.annotations[annotationName] = _.merge(
      {}, ...Object.keys(permissions).filter(isElementName)
        .map(f => ({ [bpCase(f)]: [] as string[] }))
    )
    profileName = sfCase(profileName)
  }

  Object.entries(permissions).filter(p => isElementName(p[0])).forEach(permissionOption => {
    if (boolValue(permissionOption[1])) {
      getAnnotationValue(element, annotationName)[bpCase(permissionOption[0])].push(
        createReferences ? new ReferenceExpression(
          profile.createNestedID(INSTANCE_FULL_NAME_FIELD)
        ) : profileName
      )
    }
  })
}

export const getProfileInstances = (elements: Element[]): InstanceElement[] =>
  getInstancesOfMetadataType(elements, PROFILE_METADATA_TYPE)

const findProfile = (profiles: ProfileInfo[], profile: string):
     ProfileInfo | undefined =>
  profiles.find(p => p.fullName === profile)

const setPermissions = <T = PermissionsTypes>(
  element: ObjectType | Field, permissionAnnotationName: string, fullName: string,
  permissions: Record<string, Record<string, T>>, profileInstances: InstanceElement[]): void => {
  const elementPermissions = permissions[fullName]
  if (elementPermissions) {
    Object.entries(elementPermissions).sort().forEach(p2f => {
      const profile = findElement(profileInstances, ElemID.fromFullName(p2f[0]))
      if (profile) {
        setProfilePermissions(element, profile.elemID, permissionAnnotationName, p2f[1], true)
      }
    })
  }
}

const findPermissions = <T = PermissionsTypes>(
  permissions: T[], value: string): T | undefined =>
    permissions.find(op => (_.get(op, 'object')
      ? _.get(op, 'object') === value : _.get(op, 'field') === value))

const getElementName = <T = PermissionsTypes>(element: T): string =>
  (_.get(element, 'field') ? _.get(element, 'field') : _.get(element, 'object'))

const filterPermissions = <T = PermissionsTypes>(
  permissions: T[], beforeProfilePermissions: T[], afterProfilePermissions: T[],
  emptyPermissions: (permissions: T) => T, notRemovedField?: (element: T) => boolean): T[] =>
    permissions
      // Filter out permissions that were already updated
      .filter(f => !_.isEqual(findPermissions(beforeProfilePermissions, getElementName(f)), f))
      // Add missing permissions with =false for all the permissions options
      .concat(beforeProfilePermissions
        .filter(_.isUndefined(notRemovedField) ? (() => true) : notRemovedField)
        .filter(f => _.isUndefined(findPermissions(afterProfilePermissions, getElementName(f))))
        .map(emptyPermissions))

const getPermissionsValues = (element: Element,
  permissionFields: readonly PermissionsOptionsFieldsTypes[],
  annotationName: string): Record<string, string[]> =>
  Object.values(permissionFields)
    .sort().reduce((permission, field) => {
      permission[field] = getAnnotationValue(element, annotationName)[bpCase(field)]
       || []
      return permission
    }, {} as Record<string, string[]>)

const profile2Permissions = <T = PermissionsTypes>(
  profile: string, elementPermissions: T[]): Record<string, Record<string, T>> =>
    _.merge({}, ...makeArray(elementPermissions)
      .map(element => ({ [getElementName(element)]: { [profile]: element } })))


const setProfileFieldPermissions = (field: Field, profile: ElemID,
  permissions: FieldPermissionsOptions):
   void => setProfilePermissions(field, profile, FIELD_LEVEL_SECURITY_ANNOTATION, permissions)

const setProfileObjectPermissions = (object: ObjectType, profile: ElemID,
  permissions: ObjectPermissionsOptions): void => setProfilePermissions(
  object, profile, OBJECT_LEVEL_SECURITY_ANNOTATION, permissions
)

const setDefaultFieldPermissions = (field: Field): void => {
  // We can't set permissions for master detail or required fields
  if (field.type.isEqual(Types.primitiveDataTypes.masterdetail)
    || field.annotations[Type.REQUIRED]) {
    return
  }
  if (_.isEmpty(getFieldPermissions(field))) {
    setProfileFieldPermissions(field, ADMIN_ELEM_ID,
      { readable: true, editable: true })
    log.debug('set %s field permissions for %s.%s', ADMIN_PROFILE, field.parentID.name, field.name)
  }
}

const setDefaultObjectPermissions = (object: ObjectType): void => {
  if (_.isEmpty(getObjectPermissions(object))) {
    setProfileObjectPermissions(object, ADMIN_ELEM_ID,
      Object.assign({}, ...OBJECT_PERMISSIONS_OPTIONS.map(option => ({ [option]: true }))))
    log.debug('set %s object permissions for %s', ADMIN_PROFILE, apiName(object))
  }
}

const profile2FieldPermissions = (profileInstance: InstanceElement):
  Record<string, ProfileToFieldPermissions> =>
  profile2Permissions(id(profileInstance), profileInstance.value[FIELD_PERMISSIONS])

const profile2ObjectPermissions = (profileInstance: InstanceElement):
  Record<string, ProfileToObjectPermissions> =>
  profile2Permissions(id(profileInstance), profileInstance.value[OBJECT_PERMISSIONS])

const toProfilePermissions = <T = PermissionsTypes>(element: Element, annotationName: string,
  permissionsOptionsFields: readonly PermissionsOptionsFieldsTypes[],
  fullNameObject: Record<string, string>, permissions: Record<string, T[]> = {}):
   Record<string, T[]> => {
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
  return profiles.map(profile => new ProfileInfo(profile,
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
    removeFieldsFromInstanceAndType(elements, [FIELD_PERMISSIONS, OBJECT_PERMISSIONS],
      PROFILE_METADATA_TYPE)
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

    const removedElements: string[] = []
    wu(changes)
      .forEach(c => {
        const changeElement = getChangeElement(c)
        if (isField(changeElement)) {
          switch (c.action) {
            case 'add':
              setDefaultFieldPermissions(after.fields[changeElement.name])
              break
            case 'remove':
              removedElements.push(fieldFullName(before, changeElement))
              break
            default:
              break
          }
        }
      })

    const emptyFieldPermissions = (permissions: FieldPermissions): FieldPermissions =>
      ({ field: permissions.field, readable: false, editable: false })

    const emptyObjectPermissions = (permissions: ObjectPermissions): ObjectPermissions =>
      Object.assign({ object: permissions.object },
        ...OBJECT_PERMISSIONS_OPTIONS.map(option => ({ [option]: false })))

    const notRemovedField = (permission: FieldPermissions): boolean =>
      !removedElements.includes(getElementName(permission))

    const beforeProfiles = toProfiles(before)
    const afterProfiles = toProfiles(after)
    const profiles = afterProfiles
      .map(afterProfile => {
        let { fieldPermissions, objectPermissions } = afterProfile
        const beforeProfile = findProfile(beforeProfiles, afterProfile.fullName)
        if (beforeProfile) {
          fieldPermissions = filterPermissions(fieldPermissions, beforeProfile.fieldPermissions,
            afterProfile.fieldPermissions, emptyFieldPermissions, notRemovedField)
          objectPermissions = filterPermissions(objectPermissions, beforeProfile.objectPermissions,
            afterProfile.objectPermissions, emptyObjectPermissions)
        }
        return { fullName: afterProfile.fullName, fieldPermissions, objectPermissions }
      })
      // Add missing permissions for profiles that dosen't exists in after
      //   with =false values for all the permissions options
      .concat(beforeProfiles
        .filter(p => _.isUndefined(findProfile(afterProfiles, p.fullName)))
        .map(p => ({ fullName: p.fullName,
          fieldPermissions: p.fieldPermissions.filter(notRemovedField)
            .map(emptyFieldPermissions),
          objectPermissions: p.objectPermissions.map(emptyObjectPermissions) })))
      // Filter out empty permissions
      .filter(p => (p.fieldPermissions.length > 0) || (p.objectPermissions.length > 0))

    if (_.isEmpty(profiles)) {
      return []
    }

    return client.update(PROFILE_METADATA_TYPE, profiles)
  },
})

export default filterCreator
