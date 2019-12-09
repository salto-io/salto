import _ from 'lodash'
import { ObjectType, Field, Element, InstanceElement, isObjectType, ElemID, findElement, getAnnotationValue } from 'adapter-api'
import { ObjectPermissionsOptions, FieldPermissionsOptions, ProfileInfo, FieldPermissions, ObjectPermissions } from '../client/types'
import { bpCase, metadataType, sfCase } from '../transformers/transformer'
import { getInstancesOfMetadataType, id } from './utils'
import { SALESFORCE, PROFILE_METADATA_TYPE, ADMIN_PROFILE } from '../constants'


export const setProfilePermissions = <T = ObjectPermissionsOptions | FieldPermissionsOptions>
  (element: ObjectType | Field, profile: string,
    annotationName: string, permissions: T): void => {
  if (_.isEmpty(getAnnotationValue(element, annotationName))) {
    element.annotations[annotationName] = _.merge(
      {}, ...Object.keys(permissions).map(f => ({ [f]: [] as string[] }))
    )
  }

  Object.entries(permissions).forEach(p => {
    if (p[1]) {
      getAnnotationValue(element, annotationName)[bpCase(p[0])].push(profile)
    }
  })
}

export const removePermissionsInfoFromProfile = (profileInstances: InstanceElement[],
  elements: Element[], fieldName: string): void => {
  profileInstances.forEach(profileInstance => delete profileInstance.value[fieldName])
  elements.filter(isObjectType)
    .filter(element => metadataType(element) === PROFILE_METADATA_TYPE)
    .forEach(profileType => delete profileType.fields[fieldName])
}

export const findProfile = (profiles: ProfileInfo[], profile: string):
     ProfileInfo | undefined =>
  profiles.find(p => p.fullName === profile)

export const getProfileInstances = (elements: Element[]): InstanceElement[] =>
  getInstancesOfMetadataType(elements, PROFILE_METADATA_TYPE)

export const profileInPermissionsList = (permissions: Record<string, string[]>,
  profile: string, permissionFieldName: string):
  boolean => permissions[sfCase(permissionFieldName, false, false)].includes(profile)

export const ADMIN_ELEM_ID = new ElemID(SALESFORCE, bpCase(PROFILE_METADATA_TYPE),
  'instance', ADMIN_PROFILE)

export const setPermissions = <T>(
  object: ObjectType | Field, permissionAnnotationName: string, fullName: string,
  permissions: Record<string, T>, profileInstances: InstanceElement[]): void => {
  const fieldPermissions = permissions[fullName]
  if (fieldPermissions) {
    Object.entries(fieldPermissions).sort().forEach(p2f => {
      const profile = findElement(profileInstances, ElemID.fromFullName(p2f[0]))
      if (profile) {
        setProfilePermissions(object, id(profile), permissionAnnotationName, p2f[1])
      }
    })
  }
}

export const findPermissions = <T = ObjectPermissions | FieldPermissions>(
  permissions: T[], value: string): T | undefined =>
    permissions.find(op => {
      if ((op as unknown as ObjectPermissions).object) {
        return (op as unknown as ObjectPermissions).object === value
      }
      if ((op as unknown as FieldPermissions).field) {
        return (op as unknown as FieldPermissions).field === value
      }
      return undefined
    })

// export const updateProfile = <T>()
//   const beforeProfiles: ProfileInfo[] = toProfiles(before)
//   const afterProfiles: ProfileInfo[] = toProfiles(after)
//   const profiles = afterProfiles
//     .map(afterProfile => {
//       let { fieldPermissions } = afterProfile
//       const beforeProfile = findProfile(beforeProfiles, afterProfile.fullName)
//       if (beforeProfile) {
//         fieldPermissions = fieldPermissions
//           // Filter out permissions that were already updated
//           .filter(f => !_.isEqual(findPermissions(beforeProfile.fieldPermissions, f.field), f))
//           // Add missing permissions with editable=false and readable=false
//           .concat(beforeProfile.fieldPermissions
//             .filter(f => _.isUndefined(findPermissions(afterProfile.fieldPermissions, f.field)))
//             .map(emptyPermissions))
//       }
//       return { fullName: afterProfile.fullName, fieldPermissions }
//     })
//     // Add missing permissions for profiles that dosen't exists in after with editable=false and
//     // readable=false
//     .concat(beforeProfiles
//       .filter(p => _.isUndefined(findProfile(afterProfiles, p.fullName)))
//       .map(p => ({ fullName: p.fullName,
//         fieldPermissions: p.fieldPermissions.map(emptyPermissions) })))
//     // Filter out empty field permissions
//     .filter(p => p.fieldPermissions.length > 0)

//   return client.update(PROFILE_METADATA_TYPE, profiles)
// )

export const filterPermissions = <T = ObjectPermissions | FieldPermissions>(
  permissions: T[], beforeProfilePermissions: T[], afterProfilePermissions: T[],
  emptyPermissions: (permissions: T) => T): T[] => {
  const fieldOrObject = (element: T): string =>
    (_.isUndefined((element as unknown as FieldPermissions).field)
      ? (element as unknown as ObjectPermissions).object
      : (element as unknown as FieldPermissions).field)

  return permissions
    // Filter out permissions that were already updated
    .filter(f => !_.isEqual(findPermissions(beforeProfilePermissions, fieldOrObject(f)), f))
  // Add missing permissions with editable=false and readable=false
    .concat(beforeProfilePermissions
      .filter(f => _.isUndefined(findPermissions(afterProfilePermissions, fieldOrObject(f))))
      .map(emptyPermissions))
}
