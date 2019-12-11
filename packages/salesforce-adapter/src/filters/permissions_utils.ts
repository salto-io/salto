import _ from 'lodash'
import { collections } from '@salto/lowerdash'
import { ObjectType, Field, Element, InstanceElement, isObjectType, ElemID, findElement,
  getAnnotationValue, Values } from 'adapter-api'
import { ProfileInfo, FieldPermissions,
  ObjectPermissions, ProfileToObjectPermissions, ProfileToFieldPermissions, PermissionsTypes, PermissionsOptionsTypes } from '../client/types'
import { bpCase, metadataType, sfCase } from '../transformers/transformer'
import { getInstancesOfMetadataType, id, boolValue } from './utils'
import { SALESFORCE, PROFILE_METADATA_TYPE, ADMIN_PROFILE, FIELD_LEVEL_SECURITY_ANNOTATION,
  OBJECT_LEVEL_SECURITY_ANNOTATION } from '../constants'

const { makeArray } = collections.array

export const ADMIN_ELEM_ID = new ElemID(SALESFORCE, bpCase(PROFILE_METADATA_TYPE),
  'instance', ADMIN_PROFILE)

export const getFieldPermissions = (field: Field): Values =>
  (getAnnotationValue(field, FIELD_LEVEL_SECURITY_ANNOTATION))

export const getObjectPermissions = (object: ObjectType): Values =>
  (getAnnotationValue(object, OBJECT_LEVEL_SECURITY_ANNOTATION))

export const setProfilePermissions = <T = PermissionsOptionsTypes>
  (element: ObjectType | Field, profile: string,
    annotationName: string, permissions: T): void => {
  if (_.isEmpty(getAnnotationValue(element, annotationName))) {
    element.annotations[annotationName] = _.merge(
      {}, ...Object.keys(permissions).map(f => ({ [bpCase(f)]: [] as string[] }))
    )
  }

  Object.entries(permissions).forEach(permissionOption => {
    if (boolValue(permissionOption[1])) {
      getAnnotationValue(element, annotationName)[bpCase(permissionOption[0])].push(profile)
    }
  })
}

export const getProfileInstances = (elements: Element[]): InstanceElement[] =>
  getInstancesOfMetadataType(elements, PROFILE_METADATA_TYPE)

export const removePermissionsInfoFromProfile = (elements: Element[],
  fieldNamesToDelete: string[]): void => {
  fieldNamesToDelete.forEach(fieldNameToDelete => {
    getProfileInstances(elements)
      .forEach(profileInstance => delete profileInstance.value[fieldNameToDelete])
    elements.filter(isObjectType)
      .filter(element => metadataType(element) === PROFILE_METADATA_TYPE)
      .forEach(profileType => delete profileType.fields[fieldNameToDelete])
  })
}

export const findProfile = (profiles: ProfileInfo[], profile: string):
     ProfileInfo | undefined =>
  profiles.find(p => p.fullName === profile)

export const setPermissions = <T = PermissionsOptionsTypes>(
  element: ObjectType | Field, permissionAnnotationName: string, fullName: string,
  permissions: Record<string, Record<string, T>>, profileInstances: InstanceElement[]): void => {
  const elementPermissions = permissions[fullName]
  if (elementPermissions) {
    Object.entries(elementPermissions).sort().forEach(p2f => {
      const profile = findElement(profileInstances, ElemID.fromFullName(p2f[0]))
      if (profile) {
        setProfilePermissions(element, id(profile), permissionAnnotationName, p2f[1])
      }
    })
  }
}

export const findPermissions = <T = PermissionsTypes>(
  permissions: T[], value: string): T | undefined =>
    permissions.find(op => (_.get(op, 'object')
      ? _.get(op, 'object') === value : _.get(op, 'field') === value))

const getElementName = <T = PermissionsTypes>(element: T): string =>
  (_.get(element, 'field') ? _.get(element, 'field') : _.get(element, 'object'))

export const filterPermissions = <T = PermissionsTypes>(
  permissions: T[], beforeProfilePermissions: T[], afterProfilePermissions: T[],
  emptyPermissions: (permissions: T) => T): T[] =>
    permissions
      // Filter out permissions that were already updated
      .filter(f => !_.isEqual(findPermissions(beforeProfilePermissions, getElementName(f)), f))
    // Add missing permissions with =false for all the permissions options
      .concat(beforeProfilePermissions
        .filter(f => _.isUndefined(findPermissions(afterProfilePermissions, getElementName(f))))
        .map(emptyPermissions))

export const initProfile = (profiles: Record<string, ProfileInfo>, profile: string): void => {
  if (_.isUndefined(profiles[profile])) {
    profiles[profile] = new ProfileInfo(
      sfCase(ElemID.fromFullName(profile).name)
    )
  }
}

export const getPermissionsValues = (element: Element, permissionFields: Values,
  annotationName: string): Record<string, string[]> =>
  Object.values(permissionFields)
    .sort().reduce((permission, field) => {
      permission[field] = getAnnotationValue(element, annotationName)[bpCase(field)]
       || []
      return permission
    }, {} as Record<string, string[]>)

export const profile2Permissions = <T = PermissionsTypes,
 K = ProfileToFieldPermissions | ProfileToObjectPermissions>(
    profileInstance: InstanceElement, instanceElementPermissions: T[]):
  Record<string, K> => {
  if (!instanceElementPermissions) {
    return {}
  }

  return _.merge({}, ...makeArray(instanceElementPermissions)
    .map(element => {
      const elementName = getElementName(element)
      const elementClone: T = { ...element }
      if (_.get(elementClone, 'field')) {
        delete (elementClone as unknown as FieldPermissions).field
      } else {
        delete (elementClone as unknown as ObjectPermissions).object
      }
      return { [elementName]: { [id(profileInstance)]: elementClone } }
    }))
}
