import {
  ObjectType, Element, Values, isObjectType, InstanceElement,
  Change, ElemID, findElement,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import {
  SALESFORCE, OBJECT_LEVEL_SECURITY_ANNOTATION, OBJECT_PERMISSIONS,
  OBJECT_LEVEL_SECURITY_FIELDS, API_NAME, PROFILE_METADATA_TYPE, ADMIN_PROFILE,
} from '../constants'
import { sfCase, bpCase, isCustomObject, apiName, mapKeysRecursive } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, ObjectPermissions, ObjectPermissionsOptions } from '../client/types'
import { getCustomObjects, id, getAnnotationValue } from './utils'
import { setProfilePermissions, removePermissionsInfoFromProfile, findProfile, getProfileInstances, profileInPermissionList } from './permissions_utils'

const { makeArray } = collections.array

const log = logger(module)

const { ALLOW_CREATE, ALLOW_DELETE, ALLOW_EDIT, ALLOW_READ,
  MODIFY_ALL_RECORDS, VIEW_ALL_RECORDS } = OBJECT_LEVEL_SECURITY_FIELDS

const ADMIN_ELEM_ID = new ElemID(SALESFORCE, bpCase(PROFILE_METADATA_TYPE),
  'instance', ADMIN_PROFILE)

// --- Utils functions
export const getObjectPermissions = (object: ObjectType): Values =>
  (getAnnotationValue(object, OBJECT_LEVEL_SECURITY_ANNOTATION))

const setProfileObjectPermissions = (object: ObjectType, profile: string,
  permissions: ObjectPermissionsOptions): void => setProfilePermissions(
  object, profile, OBJECT_LEVEL_SECURITY_ANNOTATION, permissions, OBJECT_LEVEL_SECURITY_FIELDS
)

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

const toProfiles = (object: ObjectType): ProfileInfo[] =>
  Object.values(Object.values([object])
    .reduce((profiles, obj) => {
      if (!getObjectPermissions(obj)) {
        return profiles
      }

      const permissions = Object.values(OBJECT_LEVEL_SECURITY_FIELDS)
        .sort().reduce((permission, field) => {
          permission[_.camelCase(field)] = getObjectPermissions(object)[field] || []
          return permission
        }, {} as Record<string, string[]>)

      _.union(...Object.values(permissions)).forEach((profile: string) => {
        if (_.isUndefined(profiles[profile])) {
          profiles[profile] = new ProfileInfo(
            sfCase(ElemID.fromFullName(profile).name), []
          )
        }
        profiles[profile].objectPermissions.push({
          object: apiName(object),
          allowCreate: profileInPermissionList(permissions, profile, ALLOW_CREATE),
          allowDelete: profileInPermissionList(permissions, profile, ALLOW_DELETE),
          allowEdit: profileInPermissionList(permissions, profile, ALLOW_EDIT),
          allowRead: profileInPermissionList(permissions, profile, ALLOW_READ),
          modifyAllRecords: profileInPermissionList(permissions, profile, MODIFY_ALL_RECORDS),
          viewAllRecords: profileInPermissionList(permissions, profile, VIEW_ALL_RECORDS),
        })
      })
      return profiles
    }, {} as Record<string, ProfileInfo>))

type ProfileToObjectPermissions = Record<string, ObjectPermissionsOptions>

/**
 * Create a record of { object_name: { profile_name: { allowCreate: boolean, allowDelete: boolean,
 *                                                     allowEdit: boolean, allowRead: boolean,
 *                                                     modifyAllRecords: boolean,
 *                                                     viewAllRecords: boolean } } }
 * from the profile's object permissions
 */
const profile2ObjectPermissions = (profileInstance: InstanceElement):
  Record<string, ProfileToObjectPermissions> => {
  const instanceObjectPermissions = (
    mapKeysRecursive(makeArray(profileInstance.value[OBJECT_PERMISSIONS]),
      _.camelCase) as ObjectPermissions[])
  if (!instanceObjectPermissions) {
    return {}
  }
  return _.merge({}, ...instanceObjectPermissions.map(({ object, allowCreate, allowDelete,
    allowEdit, allowRead, modifyAllRecords, viewAllRecords }) => (
    {
      [object]: {
        [id(profileInstance)]:
        { allowCreate: allowCreate === 'true',
          allowDelete: allowDelete === 'true',
          allowEdit: allowEdit === 'true',
          allowRead: allowRead === 'true',
          modifyAllRecords: modifyAllRecords === 'true',
          viewAllRecords: viewAllRecords === 'true' },
      },
    })))
}

/**
 * Object permissions filter. Handle the mapping from sobject field OBJECT_LEVEL_SECURITY_ANNOTATION
 * annotation and remove Profile.objectPermissions.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const customObjectTypes = getCustomObjects(elements).filter(obj => obj.annotations[API_NAME])
    if (_.isEmpty(customObjectTypes)) {
      return
    }
    const profileInstances = getProfileInstances(elements)
    if (_.isEmpty(profileInstances)) {
      return
    }

    const objectPermissionsPerProfile = profileInstances.map(profile2ObjectPermissions)
    const permissions: Record<string, ProfileToObjectPermissions> = _.merge({},
      ...objectPermissionsPerProfile)

    // Add object permissions to all fetched elements
    customObjectTypes.forEach(obj => {
      const fullName = apiName(obj)
      const objectPermissions = permissions[fullName]
      if (objectPermissions) {
        Object.entries(objectPermissions).sort().forEach(p2f => {
          const profile = findElement(profileInstances, ElemID.fromFullName(p2f[0]))
          if (profile) {
            setProfileObjectPermissions(obj, id(profile), p2f[1])
          }
        })
      }
    })

    // Remove object permissions from Profile Instances & Type to avoid information duplication
    removePermissionsInfoFromProfile(profileInstances, elements, OBJECT_PERMISSIONS)
  },

  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after) && isCustomObject(after)) {
      // Set default permissions for the new object
      setDefaultObjectPermissions(after)

      const profiles = toProfiles(after)
      return client.update(PROFILE_METADATA_TYPE, profiles)
    }
    return []
  },

  onUpdate: async (before: Element, after: Element, _changes: ReadonlyArray<Change>):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after) && isCustomObject(before))) {
      return []
    }

    const findPermissions = (permissions: ObjectPermissions[], object: string):
      ObjectPermissions | undefined => permissions.find(op => op.object === object)

    const emptyPermissions = (permissions: ObjectPermissions): ObjectPermissions =>
      ({ object: permissions.object,
        allowCreate: 'false',
        allowDelete: 'false',
        allowEdit: 'false',
        allowRead: 'false',
        modifyAllRecords: 'false',
        viewAllRecords: 'false' })

    const beforeProfiles = toProfiles(before)
    const afterProfiles = toProfiles(after)
    const profiles = afterProfiles
      .map(afterProfile => {
        let { objectPermissions } = afterProfile
        const beforeProfile = findProfile(beforeProfiles, afterProfile.fullName)
        if (beforeProfile) {
          objectPermissions = objectPermissions
            // Filter out permissions that were already updated
            .filter(o => !_.isEqual(findPermissions(beforeProfile.objectPermissions, o.object), o))
            // Add missing permissions with all options set to false
            .concat(beforeProfile.objectPermissions
              .filter(o => _.isUndefined(findPermissions(afterProfile.objectPermissions, o.object)))
              .map(emptyPermissions))
        }
        return { fullName: afterProfile.fullName, objectPermissions }
      })
      // Add missing permissions for profiles that dosen't exists in after with
      // all options set to false
      .concat(beforeProfiles
        .filter(p => _.isUndefined(findProfile(afterProfiles, p.fullName)))
        .map(p => ({ fullName: p.fullName,
          objectPermissions: p.objectPermissions.map(emptyPermissions) })))
      // Filter out empty object permissions
      .filter(p => p.objectPermissions.length > 0)

    return client.update(PROFILE_METADATA_TYPE, profiles)
  },
})

export default filterCreator
