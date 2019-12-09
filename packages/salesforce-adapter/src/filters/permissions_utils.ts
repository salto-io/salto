import _ from 'lodash'
import { Values, ObjectType, Field, Element, isInstanceElement, InstanceElement, isObjectType } from 'adapter-api'
import { ObjectPermissionsOptions, FieldPermissionsOptions, ProfileInfo } from '../client/types'
import { bpCase, metadataType } from '../transformer'
import { getAnnotationValue } from './utils'
import { PROFILE_METADATA_TYPE } from '../constants'


export const setProfilePermissions = (element: ObjectType | Field, profile: string,
  annotation: string, permissions: ObjectPermissionsOptions | FieldPermissionsOptions,
  permissionsFields: Values): void => {
  if (_.isEmpty(getAnnotationValue(element, annotation))) {
    element.annotations[annotation] = Object.values(permissionsFields).reduce(
      (permission, field) => {
        (permission[field] = [] as string[])
        return permission
      }, {}
    )
  }

  Object.entries(permissions).forEach(p => {
    if (p[1]) {
      getAnnotationValue(element, annotation)[bpCase(p[0])].push(profile)
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
  elements.filter(isInstanceElement)
    .filter(element => metadataType(element) === PROFILE_METADATA_TYPE)

export const profileInPermissionList = (permissions: Record<string, string[]>,
  profile: string, permissionFieldName: string):
  'true' | 'false' => (permissions[_.camelCase(permissionFieldName)].includes(profile) ? 'true' : 'false')
