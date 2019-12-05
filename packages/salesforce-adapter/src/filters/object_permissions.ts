/* eslint-disable no-console */
import {
  ObjectType, Element, Values, isObjectType, isInstanceElement, InstanceElement,
  Change, getChangeElement, ElemID, findElement,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import {
  SALESFORCE, OBJECT_LEVEL_SECURITY_ANNOTATION, OBJECT_PERMISSIONS,
  OBJECT_LEVEL_SECURITY_FIELDS, API_NAME,
} from '../constants'
import {
  sfCase, bpCase, metadataType, isCustomObject, apiName, mapKeysRecursive,
} from '../transformer'
import { FilterCreator } from '../filter'
import { ProfileObjectPermissionsInfo, ObjectPermissions } from '../client/types'
import { /* generateObjectElemID2ApiName, */ getCustomObjects } from './utils'

const { makeArray } = collections.array

export const PROFILE_METADATA_TYPE = 'Profile'
export const ADMIN_PROFILE = 'admin'

const log = logger(module)

const { ALLOW_CREATE, ALLOW_DELETE, ALLOW_EDIT, ALLOW_READ,
  MODIFY_ALL_RECORDS, VIEW_ALL_RECORDS } = OBJECT_LEVEL_SECURITY_FIELDS

const ADMIN_ELEM_ID = new ElemID(SALESFORCE, bpCase(PROFILE_METADATA_TYPE),
  'instance', ADMIN_PROFILE)

// --- Utils functions
export const getObjectPermissions = (object: ObjectType): Values =>
  (object.annotations[OBJECT_LEVEL_SECURITY_ANNOTATION] || {})

const id = (elem: Element): string => elem.elemID.getFullName()

const setProfileObjectPermissions = (object: ObjectType, profile: string, allowCreate: boolean,
  allowDelete: boolean, allowEdit: boolean, allowRead: boolean, modifyAllRecords: boolean,
  viewAllRecords: boolean): void => {
  if (_.isEmpty(getObjectPermissions(object))) {
    object.annotations[OBJECT_LEVEL_SECURITY_ANNOTATION] = { [ALLOW_CREATE]: [] as string[],
      [ALLOW_DELETE]: [] as string[],
      [ALLOW_EDIT]: [] as string[],
      [ALLOW_READ]: [] as string[],
      [MODIFY_ALL_RECORDS]: [] as string[],
      [VIEW_ALL_RECORDS]: [] as string[] }
  }
  if (allowCreate) {
    getObjectPermissions(object)[ALLOW_CREATE].push(profile)
  }
  if (allowDelete) {
    getObjectPermissions(object)[ALLOW_DELETE].push(profile)
  }
  if (allowEdit) {
    getObjectPermissions(object)[ALLOW_EDIT].push(profile)
  }
  if (allowRead) {
    getObjectPermissions(object)[ALLOW_READ].push(profile)
  }
  if (modifyAllRecords) {
    getObjectPermissions(object)[MODIFY_ALL_RECORDS].push(profile)
  }
  if (viewAllRecords) {
    getObjectPermissions(object)[VIEW_ALL_RECORDS].push(profile)
  }
}

const setDefaultObjectPermissions = (object: ObjectType): void => {
  // TODO - We can't set permissions for master detail
  // if (field.type.isEqual(Types.primitiveDataTypes.masterdetail)) {
  //   return
  // }
  if (_.isEmpty(getObjectPermissions(object))) {
    setProfileObjectPermissions(object, ADMIN_ELEM_ID.getFullName(),
      true, true, true, true, true, true)
    log.debug('set %s object permissions for %s', ADMIN_PROFILE, apiName(object))
  }
}

const toProfiles = (object: ObjectType): ProfileObjectPermissionsInfo[] =>
  Object.values(Object.values([object])
    .reduce((profiles, obj) => {
      if (!getObjectPermissions(obj)) {
        return profiles
      }
      const objAllowCreate: string[] = getObjectPermissions(object)[ALLOW_CREATE] || []
      const objAllowDelete: string[] = getObjectPermissions(object)[ALLOW_DELETE] || []
      const objAllowEdit: string[] = getObjectPermissions(object)[ALLOW_EDIT] || []
      const objAllowRead: string[] = getObjectPermissions(object)[ALLOW_READ] || []
      const objModifyAllRecords: string[] = getObjectPermissions(object)[MODIFY_ALL_RECORDS] || []
      const objViewAllRecords: string[] = getObjectPermissions(object)[VIEW_ALL_RECORDS] || []

      _.union(objAllowCreate, objAllowDelete, objAllowEdit, objAllowRead,
        objModifyAllRecords, objViewAllRecords).forEach((profile: string) => {
        if (_.isUndefined(profiles[profile])) {
          profiles[profile] = new ProfileObjectPermissionsInfo(
            sfCase(ElemID.fromFullName(profile).name), []
          )
        }
        profiles[profile].objectPermissions.push({
          object: apiName(object),
          allowCreate: objAllowCreate.includes(profile) ? 'true' : 'false',
          allowDelete: objAllowDelete.includes(profile) ? 'true' : 'false',
          allowEdit: objAllowEdit.includes(profile) ? 'true' : 'false',
          allowRead: objAllowRead.includes(profile) ? 'true' : 'false',
          modifyAllRecords: objModifyAllRecords.includes(profile) ? 'true' : 'false',
          viewAllRecords: objViewAllRecords.includes(profile) ? 'true' : 'false',
        })
      })
      return profiles
    }, {} as Record<string, ProfileObjectPermissionsInfo>))

type ProfileToObjectPermissions = Record<string,
{ allowCreate: boolean
  allowDelete: boolean
  allowEdit: boolean
  allowRead: boolean
  modifyAllRecords: boolean
  viewAllRecords: boolean }>

/**
 * TODO
 * Create a record of { object_name: { profile_name: { allow_create: boolean, allow_delete: boolean,
 *                                                     allow_edit: boolean, allow_read: boolean,
 *                                                     modify_all_records: boolean,
 *                                                     view_all_records: boolean } } }
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
    const profileInstances = elements.filter(isInstanceElement)
      .filter(element => metadataType(element) === PROFILE_METADATA_TYPE)
    if (_.isEmpty(profileInstances)) {
      return
    }

    const objectPermissionsPerProfile = profileInstances.map(profile2ObjectPermissions)
    const permissions: Record<string, ProfileToObjectPermissions> = _.merge({},
      ...objectPermissionsPerProfile)
    // const objectElemID2ApiName = generateObjectElemID2ApiName(customObjectTypes)

    // Add object permissions to all fetched elements
    customObjectTypes.forEach(obj => {
      // const fullName = objectElemID2ApiName[id(obj)] || apiName(obj)
      const fullName = apiName(obj)
      const objectPermissions = permissions[fullName]
      if (objectPermissions) {
        Object.entries(objectPermissions).sort().forEach(p2f => {
          const profile = findElement(profileInstances, ElemID.fromFullName(p2f[0]))
          if (profile) {
            setProfileObjectPermissions(obj, id(profile), p2f[1].allowCreate, p2f[1].allowDelete,
              p2f[1].allowEdit, p2f[1].allowRead, p2f[1].modifyAllRecords, p2f[1].viewAllRecords)
          }
        })
      }
    })

    // Remove field permissions from Profile Instances & Type to avoid information duplication
    profileInstances.forEach(profileInstance => delete profileInstance.value[OBJECT_PERMISSIONS])
    elements.filter(isObjectType)
      .filter(element => metadataType(element) === PROFILE_METADATA_TYPE)
      .forEach(profileType => delete profileType.fields[OBJECT_PERMISSIONS])
  },

  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after) && isCustomObject(after)) {
      // Set default permissions for all fields of new object
      setDefaultObjectPermissions(after)

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
        if (isObjectType(changeElement) && c.action === 'add') {
          setDefaultObjectPermissions(after)
        }
      })

    const findProfile = (profiles: ProfileObjectPermissionsInfo[], profile: string):
     ProfileObjectPermissionsInfo | undefined =>
      profiles.find(p => p.fullName === profile)

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
    const profileNames = beforeProfiles
      .map((profile: ProfileObjectPermissionsInfo) => profile.fullName)
    console.log(profileNames)
    const profiles = afterProfiles
      .map(afterProfile => {
        let { objectPermissions } = afterProfile
        const beforeProfile = findProfile(beforeProfiles, afterProfile.fullName)
        if (beforeProfile) {
          objectPermissions = objectPermissions
            // Filter out permissions that were already updated
            .filter(o => !_.isEqual(findPermissions(beforeProfile.objectPermissions, o.object), o))
            // Add missing permissions with editable=false and readable=false
            .concat(beforeProfile.objectPermissions
              .filter(o => _.isUndefined(findPermissions(afterProfile.objectPermissions, o.object)))
              .map(emptyPermissions))
        }
        return { fullName: afterProfile.fullName, objectPermissions }
      })
      // Add missing permissions for profiles that dosen't exists in after with editable=false and
      // readable=false
      .concat(beforeProfiles
        .filter(p => _.isUndefined(findProfile(afterProfiles, p.fullName)))
        .map(p => ({ fullName: p.fullName,
          objectPermissions: p.objectPermissions.map(emptyPermissions) })))
      // Filter out empty field permissions
      .filter(p => p.objectPermissions.length > 0)

    return client.update(PROFILE_METADATA_TYPE, profiles)
  },
})

export default filterCreator
