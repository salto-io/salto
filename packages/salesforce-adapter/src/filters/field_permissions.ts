import {
  ObjectType, Element, Values, Field, isObjectType, InstanceElement, isField,
  Change, getChangeElement, ElemID, getAnnotationValue,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { logger } from '@salto/logging'
import {
  FIELD_PERMISSIONS, FIELD_LEVEL_SECURITY_ANNOTATION,
  FIELD_LEVEL_SECURITY_FIELDS, PROFILE_METADATA_TYPE, ADMIN_PROFILE,
} from '../constants'
import {
  sfCase, fieldFullName, isCustomObject, Types,
} from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo, FieldPermissions, FieldPermissionsOptions } from '../client/types'
import { generateObjectElemID2ApiName, getCustomObjects, id, boolValue } from './utils'
import { setProfilePermissions, removePermissionsInfoFromProfile, getProfileInstances,
  findProfile, ADMIN_ELEM_ID, setPermissions, filterPermissions } from './permissions_utils'

const log = logger(module)

const { EDITABLE, READABLE } = FIELD_LEVEL_SECURITY_FIELDS

// --- Utils functions
export const getFieldPermissions = (field: Field): Values =>
  (getAnnotationValue(field, FIELD_LEVEL_SECURITY_ANNOTATION))

const setProfileFieldPermissions = (field: Field, profile: string,
  permissions: FieldPermissionsOptions):
   void => setProfilePermissions(field, profile, FIELD_LEVEL_SECURITY_ANNOTATION, permissions)

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

const toProfiles = (object: ObjectType): ProfileInfo[] =>
  Object.values(Object.values(object.fields)
    .reduce((profiles, field) => {
      if (!getFieldPermissions(field)) {
        return profiles
      }
      const fieldEditable: string[] = getFieldPermissions(field)[EDITABLE] || []
      const fieldReadable: string[] = getFieldPermissions(field)[READABLE] || []
      _.union(fieldEditable, fieldReadable).forEach((profile: string) => {
        if (_.isUndefined(profiles[profile])) {
          profiles[profile] = new ProfileInfo(
            sfCase(ElemID.fromFullName(profile).name), []
          )
        }
        profiles[profile].fieldPermissions.push({
          field: fieldFullName(object, field),
          editable: fieldEditable.includes(profile),
          readable: fieldReadable.includes(profile),
        })
      })
      return profiles
    }, {} as Record<string, ProfileInfo>))

type ProfileToPermissions = Record<string, FieldPermissionsOptions>

/**
 * Create a record of { field_name: { profile_name: { editable: boolean, readable: boolean } } }
 * from the profile's field permissions
 */
const profile2Permissions = (profileInstance: InstanceElement):
  Record<string, ProfileToPermissions> => {
  const instanceFieldPermissions: FieldPermissions[] = profileInstance.value[FIELD_PERMISSIONS]
  if (!instanceFieldPermissions) {
    return {}
  }
  return _.merge({}, ...instanceFieldPermissions
    .map(({ field, readable, editable }) => (
      {
        [field]: {
          [id(profileInstance)]: { readable: boolValue(readable), editable: boolValue(editable) },
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
    const customObjectTypes = getCustomObjects(elements)
    if (_.isEmpty(customObjectTypes)) {
      return
    }
    const profileInstances = getProfileInstances(elements)
    if (_.isEmpty(profileInstances)) {
      return
    }

    const permissionsPerProfile = profileInstances.map(profile2Permissions)
    const permissions: Record<string, ProfileToPermissions> = _.merge({}, ...permissionsPerProfile)
    const objectElemID2ApiName = generateObjectElemID2ApiName(customObjectTypes)

    // Add field permissions to all fetched elements
    customObjectTypes.forEach(obj => {
      Object.values(obj.fields).forEach(field => {
        const fullName = fieldFullName(objectElemID2ApiName[id(obj)] || obj, field)
        setPermissions(field, FIELD_LEVEL_SECURITY_ANNOTATION, fullName,
          permissions, profileInstances)
      })
    })

    // Remove field permissions from Profile Instances & Type to avoid information duplication
    removePermissionsInfoFromProfile(profileInstances, elements, FIELD_PERMISSIONS)
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

    wu(changes)
      .forEach(c => {
        const changeElement = getChangeElement(c)
        if (isField(changeElement) && c.action === 'add') {
          setDefaultFieldPermissions(after.fields[changeElement.name])
        }
      })

    const emptyPermissions = (permissions: FieldPermissions): FieldPermissions =>
      ({ field: permissions.field, readable: false, editable: false })

    const beforeProfiles = toProfiles(before)
    const afterProfiles = toProfiles(after)
    const profiles = afterProfiles
      .map(afterProfile => {
        let { fieldPermissions } = afterProfile
        const beforeProfile = findProfile(beforeProfiles, afterProfile.fullName)
        if (beforeProfile) {
          fieldPermissions = filterPermissions(fieldPermissions,
            beforeProfile.fieldPermissions, afterProfile.fieldPermissions, emptyPermissions)
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
