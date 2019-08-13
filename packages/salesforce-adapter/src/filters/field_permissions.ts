import {
  ObjectType, Element, Values, Field, isObjectType,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce-types'
import {
  sfCase, fieldFullName, bpCase,
} from '../transformer'
import SalesforceClient from '../client/client'
import Filter from './filter'
import { ProfileInfo } from '../client/types'

export const FIELD_LEVEL_SECURITY_ANNOTATION = 'field_level_security'
export const PROFILE_METADATA_TYPE = 'Profile'

// --- Utils functions
const fieldPermissions = (field: Field): Values =>
  (field.getAnnotationsValues()[FIELD_LEVEL_SECURITY_ANNOTATION]
    ? field.getAnnotationsValues()[FIELD_LEVEL_SECURITY_ANNOTATION]
    : {})

const setEmptyFieldPermissions = (field: Field): void => {
  field.getAnnotationsValues()[FIELD_LEVEL_SECURITY_ANNOTATION] = {}
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

type FieldPermissions = Map<string, { editable: boolean; readable: boolean }>
/**
 * Transform list of ProfileInfo to map fieldFullName -> profileName -> FieldPermission
 */
const fromProfiles = (profiles: ProfileInfo[]): Map<string, FieldPermissions> => {
  const permissions = new Map<string, FieldPermissions>()
  profiles.forEach(profile => {
    if (!profile.fieldPermissions) {
      return
    }
    profile.fieldPermissions.forEach(fieldPermission => {
      const name = fieldPermission.field
      if (!permissions.has(name)) {
        permissions.set(name, new Map<string, { editable: boolean; readable: boolean }>())
      }
      (permissions.get(name) as Map<string, { editable: boolean; readable: boolean }>)
        .set(profile.fullName, {
          editable: fieldPermission.editable,
          readable: fieldPermission.readable,
        })
    })
  })

  return permissions
}

const readProfiles = async (client: SalesforceClient): Promise<ProfileInfo[]> => {
  const profilesNames = (await client.listMetadataObjects(PROFILE_METADATA_TYPE))
    .map(obj => obj.fullName)
  if (_.isEmpty(profilesNames)) {
    return []
  }

  return _.flatten(await Promise.all(_.chunk(profilesNames, 10)
    .map(chunk => client.readMetadata(PROFILE_METADATA_TYPE, chunk) as Promise<ProfileInfo[]>)))
}
// ---

/**
 * Field permissions filter. Handle the mapping from sobject field FIELD_LEVEL_SECURITY_ANNOTATION
 * annotation and Profile.fieldsPermissions.
 */
export const filter: Filter = {
  onDiscover: async (client: SalesforceClient, elements: Element[]): Promise<void> => {
    const sobjects = elements.filter(isObjectType)
    if (_.isEmpty(sobjects)) {
      return
    }
    const permissions = fromProfiles(await readProfiles(client))
    // add field permissions to all discovered elements
    sobjects.forEach(sobject => {
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
  },

  onAdd: async (client: SalesforceClient, after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after)) {
      const profiles = toProfiles(after)
      if (profiles.length > 0) {
        return client.update(PROFILE_METADATA_TYPE, profiles) as Promise<SaveResult[]>
      }
    }
    return []
  },

  onUpdate: async (client: SalesforceClient, before: Element, after: Element):
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

    if (profiles.length > 0) {
      return client.update(PROFILE_METADATA_TYPE, profiles) as Promise<SaveResult[]>
    }
    return []
  },

  onRemove: (_client: SalesforceClient, _elem: Element): Promise<SaveResult[]> =>
    Promise.resolve([]),
}
