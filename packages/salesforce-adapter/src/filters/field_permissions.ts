import {
  ObjectType, Element, Values, Field, isObjectType, isInstanceElement, InstanceElement, isField,
  Change,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import wu from 'wu'
import { CUSTOM_OBJECT, FIELD_PERMISSIONS } from '../constants'
import {
  sfCase, fieldFullName, bpCase, apiName, metadataType,
} from '../transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo } from '../client/types'

export const FIELD_LEVEL_SECURITY_ANNOTATION = 'field_level_security'
export const PROFILE_METADATA_TYPE = 'Profile'

// --- Utils functions
export const fieldPermissions = (field: Field): Values =>
  (field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
    ? field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
    : {})

const setEmptyFieldPermissions = (field: Field): void => {
  field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION] = {}
}

export const setProfileFieldPermissions = (field: Field, profile: string, editable: boolean,
  readable: boolean): void => {
  if (_.isEmpty(fieldPermissions(field))) {
    setEmptyFieldPermissions(field)
  }
  field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION][profile] = { editable, readable }
}

const setFieldPermissions = (field: Field, fieldPermission: ProfileToPermission): void => {
  field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION] = fieldPermission
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
      .filter(element => metadataType(element) === CUSTOM_OBJECT)
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

    // Add field permissions to all fetched elements
    customObjectTypes.forEach(sobject => {
      Object.values(sobject.fields).forEach(field => {
        const fieldPermission = permissions[fieldFullName(sobject, field)]
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
    if (isObjectType(after)) {
      const profiles = toProfiles(after)
      return client.update(PROFILE_METADATA_TYPE, profiles)
    }
    return []
  },

  onUpdate: async (before: Element, after: Element, changes: Iterable<Change>):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after))) {
      return []
    }

    // Look for fields that used to have permissions and permission was deleted from BP
    // For those fields we will mark then as { editable: false, readable: false } explcit
    wu(changes)
      .map(c => (c.action === 'modify' ? c.data.before : undefined))
      .filter(isField)
      .forEach(elem => {
        const beforeField = elem as Field
        const afterField = after.fields[beforeField.name]
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
      })

    // Filter out permissions that were already updated
    const preProfiles = toProfiles(before)
    const profiles = toProfiles(after).map(p => {
      const preProfile = preProfiles.find(pre => pre.fullName === p.fullName)
      let fields = p.fieldPermissions
      if (preProfile) {
        // for some reason .include is not working so we use find + _.isEqual
        fields = fields.filter(f => preProfile.fieldPermissions
          .find(pf => _.isEqual(pf, f)) === undefined)
      }
      return { fullName: p.fullName, fieldPermissions: fields }
    }).filter(p => p.fieldPermissions.length > 0)

    return client.update(PROFILE_METADATA_TYPE, profiles)
  },
})

export default filterCreator
