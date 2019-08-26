import _ from 'lodash'
import { SaveResult } from 'jsforce-types'
import {
  Element, isObjectType, Field, Values, Type, isType, BuiltinTypes,
} from 'adapter-api'
import Filter from './filter'
import SalesforceClient from '../client/client'

interface MissingField {
  name: string
  // One of type (builtin type instance) or typeName (salesforce type name) must be specified
  type?: Type
  typeName?: string
  annotationValues?: Values
  isList?: boolean
}

const salesforceMissingFields: Record<string, MissingField[]> = {
  // eslint-disable-next-line @typescript-eslint/camelcase
  filter_item: [
    {
      name: 'operation',
      type: BuiltinTypes.STRING,
      annotationValues: {
        [Type.RESTRICTION]: {
          values: [
            'equals', 'notEqual', 'lessThan', 'greaterThan', 'lessOrEqual', 'greaterOrEqual',
            'contains', 'notContain', 'startsWith', 'includes', 'excludes', 'within',
          ],
        },
      },
    },
  ],
  // eslint-disable-next-line @typescript-eslint/camelcase
  lead_convert_settings: [
    {
      name: 'object_mapping',
      typeName: 'object_mapping',
      isList: true,
    },
  ],
  // eslint-disable-next-line @typescript-eslint/camelcase
  rule_entry: [
    {
      name: 'assigned_to_type',
      type: BuiltinTypes.STRING,
      annotationValues: {
        [Type.RESTRICTION]: { values: ['User', 'Queue'] },
      },
    },
  ],
}

export class MissingFieldsFilter implements Filter {
  constructor(
    private missingFields: Record<string, MissingField[]> = salesforceMissingFields
  ) {}

  async onDiscover(_client: SalesforceClient, elements: Element[]): Promise<void> {
    // We need a mapping of all the types so we can replace type names with the correct types
    const typeMap = _(elements)
      .filter(isType)
      .map(t => [t.elemID.name, t])
      .fromPairs()
      .value()

    // Add missing fields to types
    elements.filter(isObjectType).forEach(elem => {
      const fieldsToAdd = this.missingFields[elem.elemID.name]
      if (fieldsToAdd !== undefined) {
        _.assign(elem.fields, _(fieldsToAdd)
          .map(f => [f.name, new Field(
            elem.elemID,
            f.name,
            f.type || typeMap[f.typeName as string],
            f.annotationValues || {},
            f.isList === true,
          )])
          .fromPairs()
          .value())
      }
    })
  }

  // eslint-disable-next-line class-methods-use-this
  async onAdd(_client: SalesforceClient, _elem: Element): Promise<SaveResult[]> {
    return []
  }

  // eslint-disable-next-line class-methods-use-this
  async onUpdate(_c: SalesforceClient, _elem1: Element, _elem2: Element): Promise<SaveResult[]> {
    return []
  }

  // eslint-disable-next-line class-methods-use-this
  async onRemove(_client: SalesforceClient, _elem: Element): Promise<SaveResult[]> {
    return []
  }
}

export default new MissingFieldsFilter()
