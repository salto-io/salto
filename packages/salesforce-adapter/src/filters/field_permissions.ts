import {
  ObjectType, Element, Values, Field, isObjectType, isInstanceElement, InstanceElement,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import { CUSTOM_OBJECT } from '../constants'
import {
  sfCase, fieldFullName, bpCase, apiName, metadataType,
} from '../transformer'
import { FilterCreator } from '../filter'
import { ProfileInfo } from '../client/types'

export const FIELD_LEVEL_SECURITY_ANNOTATION = 'field_level_security'
export const PROFILE_METADATA_TYPE = 'Profile'

// --- Utils functions
const fieldPermissions = (field: Field): Values =>
  (field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
    ? field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
    : {})

const setEmptyFieldPermissions = (field: Field): void => {
  field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION] = {}
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
type ProfileToPermission = Map<string, { editable: boolean; readable: boolean }>

/**
 * Reduce a list of Profile InstanceElement to map: fieldFullName -> profileName -> permission
 */
const permissionsFromProfileInstances = (permissionsAccumulator: Map<string, ProfileToPermission>,
  profileInstance: InstanceElement):
    Map<string, ProfileToPermission> => {
  const instanceFieldPermissions = (profileInstance.value.field_permissions as FieldPermission[])
  if (!instanceFieldPermissions) {
    return permissionsAccumulator
  }
  const profileInstanceName = apiName(profileInstance)

  instanceFieldPermissions.forEach(fieldPermission => {
    const fieldName = fieldPermission.field
    if (!permissionsAccumulator.has(fieldName)) {
      permissionsAccumulator.set(fieldName,
        new Map<string, { editable: boolean; readable: boolean}>())
    }
    (permissionsAccumulator.get(fieldName) as
      Map<string, { editable: boolean; readable: boolean }>)
      .set(profileInstanceName, {
        editable: fieldPermission.editable,
        readable: fieldPermission.readable,
      })
  })
  return permissionsAccumulator
}
// ---

/**
 * Field permissions filter. Handle the mapping from sobject field FIELD_LEVEL_SECURITY_ANNOTATION
 * annotation and remove Profile.fieldsPermissions.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onDiscover: async (elements: Element[]): Promise<void> => {
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
    const permissions = profileInstances
      .reduce(permissionsFromProfileInstances, new Map<string, ProfileToPermission>())
    // Add field permissions to all discovered elements
    customObjectTypes.forEach(sobject => {
      Object.values(sobject.fields).forEach(field => {
        const fieldPermission = permissions.get(fieldFullName(sobject, field))
        if (fieldPermission) {
          setEmptyFieldPermissions(field)
          fieldPermission.forEach((profilePermission, profile) => {
            fieldPermissions(field)[bpCase(profile)] = profilePermission
          })
        }
      })
    })

    // Remove field permissions from Profile Instances & Type to avoid information duplication
    profileInstances.forEach(profileInstance => delete profileInstance.value.field_permissions)
    elements.filter(isObjectType)
      .filter(element => metadataType(element) === PROFILE_METADATA_TYPE)
      .forEach(profileType => delete profileType.fields.field_permissions)
  },

  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after)) {
      const profiles = toProfiles(after)
      return client.update(PROFILE_METADATA_TYPE, profiles)
    }
    return []
  },

  onUpdate: async (before: Element, after: Element):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after))) {
      return []
    }

    // Look for fields that used to have permissions and permission was deleted from BP
    // For those fields we will mark then as { editable: false, readable: false } explcit
    before.getMutualFieldsWithOther(after).forEach(beforeField => {
      // If the delta is only new field permissions, then skip
      if (_.isEmpty(fieldPermissions(beforeField))) {
        return
      }
      if (_.isEmpty(fieldPermissions(after.fields[beforeField.name]))) {
        setEmptyFieldPermissions(after.fields[beforeField.name])
      }
      const afterFieldPermissions = fieldPermissions(after.fields[beforeField.name])
      // If some permissions were removed, we will need to remove the permissions from the
      // field explicitly (update them to be not editable and not readable)
      Object.keys(fieldPermissions(beforeField)).forEach((p: string) => {
        if (afterFieldPermissions[p] === undefined) {
          afterFieldPermissions[p] = { editable: false, readable: false }
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
