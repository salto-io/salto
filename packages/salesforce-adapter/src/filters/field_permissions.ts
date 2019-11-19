import {
  ObjectType, Element, Values, Field, isObjectType, isInstanceElement, InstanceElement, isField,
  Change, getChangeElement, ElemID, findElement,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { logger } from '@salto/logging'
import {
  FIELD_PERMISSIONS, API_NAME, SALESFORCE, FIELD_LEVEL_SECURITY_ANNOTATION,
  FIELD_LEVEL_SECURITY_FIELDS,
} from '../constants'
import {
  sfCase, fieldFullName, bpCase, metadataType, isCustomObject, Types,
} from '../transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, FieldPermissions } from '../client/types'

export const PROFILE_METADATA_TYPE = 'Profile'
export const ADMIN_PROFILE = 'admin'

const log = logger(module)

const { EDITABLE, READABLE } = FIELD_LEVEL_SECURITY_FIELDS

// --- Utils functions
export const getFieldPermissions = (field: Field): Values =>
  (field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION] || {})

const id = (elem: Element): string => elem.elemID.getFullName()

const setProfileFieldPermissions = (field: Field, profile: string, editable: boolean,
  readable: boolean): void => {
  if (_.isEmpty(getFieldPermissions(field))) {
    field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION] = { [EDITABLE]: [] as string[],
      [READABLE]: [] as string[] }
  }
  if (editable) {
    getFieldPermissions(field)[EDITABLE].push(profile)
  }
  if (readable) {
    getFieldPermissions(field)[READABLE].push(profile)
  }
}

const setDefaultFieldPermissions = (field: Field): void => {
  // We can't set permissions for master detail
  if (field.type.isEqual(Types.primitiveDataTypes.masterdetail)) {
    return
  }
  if (_.isEmpty(getFieldPermissions(field))) {
    const adminElemID = new ElemID(SALESFORCE, bpCase(PROFILE_METADATA_TYPE), 'instance', ADMIN_PROFILE)
    setProfileFieldPermissions(field, adminElemID.getFullName(), true, true)
    log.debug('set %s field permissions for %s.%s', ADMIN_PROFILE, field.parentID.name, field.name)
  }
}

const toProfiles = (object: ObjectType): ProfileInfo[] =>
  Object.values(Object.values(object.fields)
    .reduce((profiles, field) => {
      if (!getFieldPermissions(field)) {
        return profiles
      }
      const fieldEditable = getFieldPermissions(field)[EDITABLE] as string[]
      const fieldReadable = getFieldPermissions(field)[READABLE] as string[]
      _.union(fieldEditable, fieldReadable).forEach((profile: string) => {
        if (_.isUndefined(profiles[profile])) {
          profiles[profile] = new ProfileInfo(sfCase(ElemID.fromFullName(profile).name), [])
        }
        profiles[profile].fieldPermissions.push({
          field: fieldFullName(object, field),
          editable: fieldEditable ? fieldEditable.includes(profile) : false,
          readable: fieldReadable ? fieldReadable.includes(profile) : false,
        })
      })
      return profiles
    }, {} as Record<string, ProfileInfo>))

type FieldPermission = { field: string; editable: boolean; readable: boolean }
type ProfileToPermission = Record<string, { editable: boolean; readable: boolean }>

/**
 * Create a record of { field_name: { profile_name: { editable: boolean, readable: boolean } } }
 * from the profile's field permissions
 */
const profile2Permissions = (profileInstance: InstanceElement):
  Record<string, ProfileToPermission> => {
  const instanceFieldPermissions = (profileInstance.value[FIELD_PERMISSIONS] as FieldPermission[])
  if (!instanceFieldPermissions) {
    return {}
  }
  return _.merge({}, ...instanceFieldPermissions.map(({ field, readable, editable }) => (
    {
      [field]: {
        [id(profileInstance)]: { readable, editable },
      },
    })))
}
// ---

/**
 * Field permissions filter. Handle the mapping from sobject field FIELD_LEVEL_SECURITY_ANNOTATION
 * annotation and remove Profile.fieldsPermissions.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const customObjectTypes = elements.filter(isObjectType)
      .filter(isCustomObject)
    if (_.isEmpty(customObjectTypes)) {
      return
    }
    const profileInstances = elements.filter(isInstanceElement)
      .filter(element => metadataType(element) === PROFILE_METADATA_TYPE)
    if (_.isEmpty(profileInstances)) {
      return
    }

    const permissionsPerProfile = profileInstances.map(profile2Permissions)
    const permissions = _.merge({}, ...permissionsPerProfile)
    // collect element ID to api name as we have elements that are splitted and
    // we need to know the api name to build full field name
    const elemID2ApiName = _(customObjectTypes)
      .filter(obj => obj.annotations[API_NAME] !== undefined)
      .map(obj => [id(obj), obj.annotations[API_NAME]])
      .fromPairs()
      .value()

    // Add field permissions to all fetched elements
    customObjectTypes.forEach(obj => {
      Object.values(obj.fields).forEach(field => {
        const fullName = fieldFullName(elemID2ApiName[id(obj)] || obj, field)
        const fieldPermission = permissions[fullName] as ProfileToPermission | undefined
        if (fieldPermission) {
          Object.entries(fieldPermission).forEach(p2f => {
            const profile = findElement(profileInstances, ElemID.fromFullName(p2f[0]))
            if (profile) {
              setProfileFieldPermissions(field, id(profile), p2f[1].editable, p2f[1].readable)
            }
          })
        }
      })
    })

    // Remove field permissions from Profile Instances & Type to avoid information duplication
    profileInstances.forEach(profileInstance => delete profileInstance.value[FIELD_PERMISSIONS])
    elements.filter(isObjectType)
      .filter(element => metadataType(element) === PROFILE_METADATA_TYPE)
      .forEach(profileType => delete profileType.fields[FIELD_PERMISSIONS])
  },

  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after) && isCustomObject(after)) {
      // Set default permissions for all fields of new object
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

    // Look for fields that used to have permissions and permission was deleted from BP
    // For those fields we will mark then as { editable: false, readable: false } explicit
    wu(changes)
      .forEach(c => {
        const changeElement = getChangeElement(c)
        if (isField(changeElement) && c.action === 'add') {
          setDefaultFieldPermissions(after.fields[changeElement.name])
        }
      })

    const findProfile = (profiles: ProfileInfo[], profile: string): ProfileInfo | undefined =>
      profiles.find(p => p.fullName === profile)

    const findPermissions = (permissions: FieldPermissions[], field: string):
      FieldPermission | undefined => permissions.find(fp => fp.field === field)

    const emptyPermissions = (permission: FieldPermission): FieldPermission =>
      ({ field: permission.field, readable: false, editable: false })

    const beforeProfiles = toProfiles(before)
    const afterProfiles = toProfiles(after)
    const profiles = afterProfiles
      .map(afterProfile => {
        let { fieldPermissions } = afterProfile
        const beforeProfile = findProfile(beforeProfiles, afterProfile.fullName)
        if (beforeProfile) {
          fieldPermissions = fieldPermissions
            // Filter out permissions that were already updated
            .filter(f => !_.isEqual(findPermissions(beforeProfile.fieldPermissions, f.field), f))
            // Add missing permissions with editable=false and readable=false
            .concat(beforeProfile.fieldPermissions
              .filter(f => _.isUndefined(findPermissions(afterProfile.fieldPermissions, f.field)))
              .map(emptyPermissions))
        }
        return { fullName: afterProfile.fullName, fieldPermissions }
      })
      // Add missing permissions for profiles that dosen't exists in after with editable=false and
      // readable=false
      .concat(beforeProfiles
        .filter(p => _.isUndefined(findProfile(afterProfiles, p.fullName)))
        .map(p => ({ fullName: p.fullName,
          fieldPermissions: p.fieldPermissions.map(emptyPermissions) })))
      // Filter out empty field permissions
      .filter(p => p.fieldPermissions.length > 0)

    return client.update(PROFILE_METADATA_TYPE, profiles)
  },
})

export default filterCreator
