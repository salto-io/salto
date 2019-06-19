import { Field, MetadataInfo } from 'jsforce'
import SalesforceClient from './client'

// TODO: handle snakeCase and __c
// should this be in TypeElement?
// import { snakeCase } from 'lodash'

// TODO: this should be replaced with Elements from core once ready
type Config = Record<string, any>
type TypeElement = Record<string, any>

interface FieldPermissions {
  field: string
  editable: boolean
  readable: boolean
}

export interface ProfileInfo extends MetadataInfo {
  fieldPermissions: FieldPermissions[]
}

export class SalesforceAdapter {
  client: SalesforceClient

  constructor(conf: Config) {
    this.client = new SalesforceClient(
      conf.username,
      conf.password + conf.token,
      conf.sandbox
    )
  }

  async discover(): Promise<TypeElement[]> {
    // TODO: add here salesforce primitive data types
    const result = await Promise.all([
      this.discoverSObjects(),
      this.discoverMetadataTypes()
    ])
    return result[0].concat(result[1])
  }

  private async discoverMetadataTypes(): Promise<TypeElement[]> {
    const objects = await this.client.listMetadataTypes()
    return Promise.all(
      objects
        .filter(obj => {
          return obj.xmlName !== 'CustomObject'
        })
        .map(async obj => {
          return SalesforceAdapter.createMetadataTypeElement(obj.xmlName)
        })
    )
  }

  private static createMetadataTypeElement(objectName: string): TypeElement {
    // TODO: use conn.metadata.describeValueType once we have it in our dependencies
    return { object: objectName }
  }

  private async discoverSObjects(): Promise<TypeElement[]> {
    const sobjects = await Promise.all(
      (await this.client.listSObjects()).map(async obj => {
        return this.createSObjectTypeElement(obj.name)
      })
    )
    // discover permissions per field
    const permissions = await this.discoverPermissions()
    // add field permissions to all discovered elements
    // we don't use here forEach as we changed the element (linter issue)
    for (let i = 0; i < sobjects.length; i += 1) {
      // eslint-disable-next-line no-loop-func
      Object.keys(sobjects[i]).forEach(field => {
        // we skip object property as it's not a field
        if (field !== 'object') {
          const fieldPermission = permissions.get(
            `${sobjects[i].object}.${field}`
          )
          if (fieldPermission) {
            // eslint-disable-next-line @typescript-eslint/camelcase
            sobjects[i][field].field_level_security = {}
            fieldPermission.forEach((profilePermission, profile) => {
              sobjects[i][field].field_level_security[profile] = {
                editable: profilePermission.editable,
                readable: profilePermission.readable
              }
            })
          }
        }
      })
    }
    return sobjects
  }

  private async createSObjectTypeElement(
    objectName: string
  ): Promise<TypeElement> {
    const element: TypeElement = { object: objectName }
    const fields = await this.client.discoverSObject(objectName)
    fields.forEach(field => {
      element[field.name] = SalesforceAdapter.createSObjectFieldTypeElement(
        field
      )
    })
    return element
  }

  /**
   * Discover all sobject field permissions
   * return fullFieldName -> (profile -> permissions)
   */
  private async discoverPermissions(): Promise<
    Map<string, Map<string, FieldPermissions>>
  > {
    const profiles = await this.client.listMetadataObjects('Profile')
    const profilesInfo = await Promise.all(
      profiles.map(prof => {
        return this.client.readMetadata('Profile', prof.fullName) as Promise<
          ProfileInfo
        >
      })
    )

    const permissions = new Map<string, Map<string, FieldPermissions>>()
    profilesInfo.forEach(info => {
      info.fieldPermissions.forEach(fieldPermission => {
        const name = fieldPermission.field
        if (!permissions.has(name)) {
          permissions.set(name, new Map<string, FieldPermissions>())
        }
        permissions.get(name).set(info.fullName, fieldPermission)
      })
    })

    return permissions
  }

  private static createSObjectFieldTypeElement(field: Field): TypeElement {
    const element: TypeElement = {
      type: field.type,
      label: field.label,
      required: field.nillable,
      _default: field.defaultValue
    }

    if (field.type === 'combobox' || field.type === 'picklist') {
      // This will be translated to core element object, it's camelcase
      // due to HCL naming conventions.
      // eslint-disable-next-line @typescript-eslint/camelcase
      element.restricted_pick_list = field.restrictedPicklist
      element.values = field.picklistValues.map(val => val.value)

      const defaults = field.picklistValues
        .filter(val => {
          return val.defaultValue === true
        })
        .map(val => val.value)
      if (defaults.length > 0) {
        if (field.type === 'picklist') {
          // eslint-disable-next-line no-underscore-dangle
          element._default = defaults.pop()
        } else {
          // eslint-disable-next-line no-underscore-dangle
          element._default = defaults
        }
      }
    }

    return element
  }
}
