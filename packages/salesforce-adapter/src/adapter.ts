import { Field } from 'jsforce'
import { snakeCase } from 'lodash'
import SalesforceClient from './client'

// TODO: this should be replaced with Elements from core once ready
type Config = Record<string, any>
type TypeElement = Record<string, any>

export default class SalesforceAdapter {
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
    const objects = await this.client.listMetadataObjects()
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
    const objects = await this.client.listSObjects()
    return Promise.all(
      objects.map(async obj => {
        return this.createSObjectTypeElement(obj.name)
      })
    )
  }

  private async createSObjectTypeElement(
    objectName: string
  ): Promise<TypeElement> {
    const element: TypeElement = { object: snakeCase(objectName) }
    const fields = await this.client.discoverSObject(objectName)
    fields.forEach(field => {
      element[
        snakeCase(field.name)
      ] = SalesforceAdapter.createSObjectFieldTypeElement(field)
    })
    return element
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
