import {
  ObjectType, Element, Values, Field, isObjectType, isInstanceElement, InstanceElement, isField,
  Change,
  getChangeElement,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { logger } from '@salto/logging'
import { FIELD_PERMISSIONS, API_NAME } from '../constants'
import {
  sfCase, fieldFullName, bpCase, apiName, metadataType, isCustomObject, Types,
} from '../transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo } from '../client/types'

export const FIELD_LEVEL_SECURITY_ANNOTATION = 'field_level_security'
export const PROFILE_METADATA_TYPE = 'Profile'
export const ADMIN_PROFILE = 'admin'

const log = logger(module)

// --- Utils functions
export const fieldPermissions = (field: Field): Values =>
  (field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
    ? field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
    : {})

const setEmptyFieldPermissions = (field: Field): void => {
  field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION] = {}
}

const setProfileFieldPermissions = (field: Field, profile: string, editable: boolean,
  readable: boolean): void => {
  if (_.isEmpty(fieldPermissions(field))) {
    setEmptyFieldPermissions(field)
  }
  field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION][profile] = { editable, readable }
}

const setFieldPermissions = (field: Field, fieldPermission: ProfileToPermission): void => {
  field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION] = fieldPermission
}

const setDefaultFieldPermissions = (field: Field): void => {
  // We can't set permissions for master detail
  if (field.type.isEqual(Types.primitiveDataTypes.masterdetail)) {
    return
  }
  if (_.isEmpty(fieldPermissions(field))) {
    setProfileFieldPermissions(field, ADMIN_PROFILE, true, true)
    log.debug(`set ${ADMIN_PROFILE} field permissions for ${field.type}.${field.name}`)
  }
}

const toProfiles = (object: ObjectType): ProfileInfo[] => {
  const profiles = new Map<string, ProfileInfo>()
  Object.values(object.fields).forEach(field => {
    if (!fieldPermissions(field)) {
      return
    }
    Object.entries(fieldPermissions(field)).forEach(fieldLevelSecurity => {
      const profile = sfCase(fieldLevelSecurity[0])
      const permissions = fieldLevelSecurity[1] as { editable: boolean; readable: boolean }
      if (!profiles.has(profile)) {
        profiles.set(profile, new ProfileInfo(sfCase(profile)))
      }
      (profiles.get(profile) as ProfileInfo).fieldPermissions.push({
        field: fieldFullName(object, field),
        editable: permissions.editable,
        readable: permissions.readable,
      })
    })
  })
  return Array.from(profiles.values())
}

type FieldPermission = { field: string; editable: boolean; readable: boolean }
type ProfileToPermission = Record<string, { editable: boolean; readable: boolean }>

/**
 * Create a record of { field_name: { profile_name: { editable: boolean, readable: boolean } } }
 * from the profile's field permissions
 */
const profile2Permissions = (profileInstance: InstanceElement):
  Record<string, ProfileToPermission> => {
  const profileInstanceName = bpCase(apiName(profileInstance))
  const instanceFieldPermissions = (profileInstance.value[FIELD_PERMISSIONS] as FieldPermission[])
  if (!instanceFieldPermissions) {
    return {}
  }
  return _.merge({}, ...instanceFieldPermissions.map(({ field, readable, editable }) => (
    {
      [field]: {
        [profileInstanceName]: { readable, editable },
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
      .map(obj => [obj.elemID.getFullName(), obj.annotations[API_NAME]])
      .fromPairs()
      .value()

    // Add field permissions to all fetched elements
    customObjectTypes.forEach(obj => {
      Object.values(obj.fields).forEach(field => {
        const fieldPermission = permissions[
          fieldFullName(elemID2ApiName[obj.elemID.getFullName()] || obj, field)]
        if (fieldPermission) {
          setFieldPermissions(field, fieldPermission)
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

  onUpdate: async (before: Element, after: Element, changes: Iterable<Change>):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after) && isCustomObject(before))) {
      return []
    }

    // Look for fields that used to have permissions and permission was deleted from BP
    // For those fields we will mark then as { editable: false, readable: false } explcit
    wu(changes)
      .forEach(c => {
        if (!isField(getChangeElement(c))) {
          return
        }
        const fieldName = (getChangeElement(c) as Field).name
        // Set default permissions for new fields
        if (c.action === 'add') {
          setDefaultFieldPermissions(after.fields[fieldName])
        }
        if (c.action === 'modify') {
          const beforeField = c.data.before as Field
          const afterField = after.fields[fieldName]
          // If the delta is only new field permissions, then skip
          if (_.isEmpty(fieldPermissions(beforeField))) {
            return
          }
          if (_.isEmpty(fieldPermissions(afterField))) {
            setEmptyFieldPermissions(afterField)
          }
          const afterFieldPermissions = fieldPermissions(afterField)
          // If some permissions were removed, we will need to remove the permissions from the
          // field explicitly (update them to be not editable and not readable)
          Object.keys(fieldPermissions(beforeField)).forEach((p: string) => {
            if (afterFieldPermissions[p] === undefined) {
              setProfileFieldPermissions(afterField, p, false, false)
            }
          })
        }
      })

    const preProfiles = toProfiles(before)
    // Filter out permissions that were already updated
    const profiles = toProfiles(after)
      .map(p => {
        const preProfile = preProfiles.find(pre => pre.fullName === p.fullName)
        if (preProfile) {
          const prePermissions = (fieldName: string): FieldPermission | undefined =>
            preProfile.fieldPermissions.find(fp => fp.field === fieldName)
          return { fullName: p.fullName,
            fieldPermissions: p.fieldPermissions
              .filter(f => !_.isEqual(prePermissions(f.field), f)) }
        }
        return { fullName: p.fullName, fieldPermissions: p.fieldPermissions }
      })
      .filter(p => p.fieldPermissions.length > 0)

    return client.update(PROFILE_METADATA_TYPE, profiles)
  },
})

export default filterCreator
