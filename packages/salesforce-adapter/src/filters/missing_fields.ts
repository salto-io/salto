import _ from 'lodash'
import {
  isObjectType, Field, Values, Type, isType, BuiltinTypes,
} from 'adapter-api'
import { FilterCreator } from '../filter'

interface MissingField {
  name: string
  type: Type | string
  annotationValues?: Values
  isList?: boolean
}

const allMissingFields: Record<string, MissingField[]> = {
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
      type: 'object_mapping',
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

export const makeFilter = (
  missingFields: Record<string, MissingField[]>
): FilterCreator => () => ({
  onDiscover: async function onDiscover(elements) {
    // We need a mapping of all the types so we can replace type names with the correct types
    const typeMap = _(elements)
      .filter(isType)
      .map(t => [t.elemID.name, t])
      .fromPairs()
      .value()

    // Add missing fields to types
    elements.filter(isObjectType).forEach(elem => {
      const fieldsToAdd = missingFields[elem.elemID.name]
      if (fieldsToAdd !== undefined) {
        _.assign(elem.fields, _(fieldsToAdd)
          .map(f => [f.name, new Field(
            elem.elemID,
            f.name,
            isType(f.type) ? f.type : typeMap[f.type],
            f.annotationValues || {},
            f.isList === true,
          )])
          .fromPairs()
          .value())
      }
    })
  },
})

export default makeFilter(allMissingFields)
