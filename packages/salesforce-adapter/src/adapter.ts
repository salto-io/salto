/* eslint-disable class-methods-use-this */
import { Field, SaveResult, ValueTypeField } from 'jsforce'
import SalesforceClient from './client'
import * as constants from './constants'
import {
  TypeElement,
  CustomObject,
  FieldPermissions,
  ProfileInfo
} from './salesforce_types'

// TODO: handle snakeCase and __c
// should this be in TypeElement?
// import { snakeCase } from 'lodash'

// TODO: this should be replaced with Elements from core once ready
type Config = Record<string, any>

export default class SalesforceAdapter {
  client: SalesforceClient

  constructor(conf: Config) {
    this.client = new SalesforceClient(
      conf.username,
      conf.password + conf.token,
      conf.sandbox
    )
  }

  /**
   * Discover configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  public async discover(): Promise<TypeElement[]> {
    // TODO: add here salesforce primitive data types
    const result = await Promise.all([
      this.discoverSObjects(),
      this.discoverMetadataTypes()
    ])
    return result[0].concat(result[1])
  }

  /**
   * Add new type element
   */
  public async add(element: TypeElement): Promise<boolean> {
    // TODO: handle permissions
    const customObject = new CustomObject(element)
    const result = await this.client.create(
      constants.CUSTOM_OBJECT,
      customObject
    )
    const saveResult = this.isSaveResultsSuccessful(result)

    let permissionsResult: boolean
    if (saveResult) {
      permissionsResult = await this.updatePermissions(customObject)
    }

    return saveResult && permissionsResult
  }

  /**
   * Remove an element
   * @param type The metadata type of the element to remove
   * @param element The provided element to remove
   * @returns true for success, false for failure
   */
  public async remove(element: TypeElement): Promise<boolean> {
    // Build the custom object to retrieve the full name from
    const customObject = new CustomObject(element)
    const result = await this.client.delete(
      constants.CUSTOM_OBJECT,
      customObject.fullName
    )
    return (result as SaveResult).success
  }

  private async discoverMetadataTypes(): Promise<TypeElement[]> {
    const objects = await this.client.listMetadataTypes()
    return Promise.all(
      objects
        .filter(obj => {
          return obj.xmlName !== constants.CUSTOM_OBJECT
        })
        .map(async obj => {
          return this.createMetadataTypeElement(obj.xmlName)
        })
    )
  }

  private async createMetadataTypeElement(
    objectName: string
  ): Promise<TypeElement> {
    const element: TypeElement = { object: objectName }
    const fields = await this.client.discoverMetadataObject(objectName)
    if (!fields) {
      return element
    }
    fields.forEach(field => {
      if (field.name !== constants.METADATA_OBJECT_NAME_FIELD) {
        element[field.name] = SalesforceAdapter.createMetadataFieldTypeElement(
          field
        )
      }
    })
    return element
  }

  private static createMetadataFieldTypeElement(
    field: ValueTypeField
  ): TypeElement {
    const element: TypeElement = {
      type: field.soapType,
      required: field.valueRequired
    }

    if (field.picklistValues && field.picklistValues.length > 0) {
      element.values = field.picklistValues.map(val => {
        return val.value
      })
      const defaults = field.picklistValues
        .filter(val => {
          return val.defaultValue === true
        })
        .map(val => {
          return val.value
        })
      if (defaults.length === 1) {
        // eslint-disable-next-line no-underscore-dangle
        element._default = defaults.pop()
      } else {
        // eslint-disable-next-line no-underscore-dangle
        element._default = defaults
      }
    }

    return element
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

  private async updatePermissions(obj: CustomObject): Promise<boolean> {
    const profile = new ProfileInfo(constants.PROFILE_NAME_SYSTEM_ADMINISTRATOR)
    obj.fields.forEach(field => {
      profile.fieldPermissions.push({
        field: `${obj.fullName}.${field.fullName}`,
        editable: true,
        readable: true
      })
    })

    const result = await this.client.update(
      constants.METADATA_PROFILE_OBJECT,
      profile
    )
    return (result as SaveResult).success
  }

  private async createSObjectTypeElement(
    objectName: string
  ): Promise<TypeElement> {
    const element: TypeElement = { object: objectName }
    const fields = await this.client.discoverSObject(objectName)
    fields.forEach(field => {
      element[field.name] = this.createSObjectFieldTypeElement(field)
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
    const profiles = await this.client.listMetadataObjects(
      constants.METADATA_PROFILE_OBJECT
    )
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

  private createSObjectFieldTypeElement(field: Field): TypeElement {
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

  /**
   * Checks whether an operation's SaveResult or SaveResult[] is successful
   * @param saveResult either a single SaveResult or an array of SaveResult
   * @returns true if all SaveResults are successful
   */
  private isSaveResultsSuccessful(
    saveResult: SaveResult | SaveResult[]
  ): boolean {
    if (Array.isArray(saveResult)) {
      return (saveResult as SaveResult[])
        .map(r => {
          return r.success
        })
        .reduce((pre, current) => {
          return pre && current
        })
    }
    return (saveResult as SaveResult).success
  }
}
