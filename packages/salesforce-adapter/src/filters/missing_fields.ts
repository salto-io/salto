import _ from 'lodash'
import {
  isObjectType, Field, Values, Type, isType, BuiltinTypes, ElemID, Element,
} from 'adapter-api'
import { logger } from '@salto/logging'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import { LEAD_CONVERT_SETTINGS_TYPE_ID } from './lead_convert_settings'

const log = logger(module)

interface MissingField {
  name: string
  type: Type | ElemID
  annotations?: Values
  isList?: boolean
}

const allMissingFields: {id: ElemID; fields: MissingField[]}[] = [
  {
    id: new ElemID(SALESFORCE, 'filter_item'),
    fields: [
      {
        name: 'operation',
        type: BuiltinTypes.STRING,
        annotations: {
          [Type.VALUES]: [
            'equals', 'notEqual', 'lessThan', 'greaterThan', 'lessOrEqual', 'greaterOrEqual',
            'contains', 'notContain', 'startsWith', 'includes', 'excludes', 'within',
          ],
        },
      },
    ],
  },
  {
    id: LEAD_CONVERT_SETTINGS_TYPE_ID,
    fields: [
      {
        name: 'object_mapping',
        type: new ElemID(SALESFORCE, 'object_mapping'),
        isList: true,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'rule_entry'),
    fields: [
      {
        name: 'assigned_to_type',
        type: BuiltinTypes.STRING,
        annotations: {
          [Type.VALUES]: ['User', 'Queue'],
        },
      },
    ],
  },
]

export const makeFilter = (
  missingFields: Record<string, MissingField[]>
): FilterCreator => () => ({
  onFetch: async function onFetch(elements) {
    // We need a mapping of all the types so we can replace type names with the correct types
    const typeMap: Record<string, Type> = _(elements)
      .filter(isType)
      .map(t => [t.elemID.getFullName(), t])
      .fromPairs()
      .value()

    const addMissingField = (elem: Element) => (f: MissingField): Field | undefined => {
      const type = isType(f.type) ? f.type : typeMap[f.type.getFullName()]
      if (type === undefined) {
        log.warn('Failed to find type %s, omitting field %s', (f.type as ElemID).getFullName(), f.name)
        return undefined
      }
      return new Field(elem.elemID, f.name, type, f.annotations, f.isList)
    }

    // Add missing fields to types
    elements.filter(isObjectType).forEach(elem => {
      const fieldsToAdd = missingFields[elem.elemID.getFullName()]
      if (fieldsToAdd !== undefined) {
        _.assign(elem.fields, _(fieldsToAdd)
          .map(addMissingField(elem))
          .reject(_.isUndefined)
          .map((f: Field) => [f.name, f])
          .fromPairs()
          .value())
      }
    })
  },
})

export default makeFilter(
  _(allMissingFields)
    .map(({ id, fields }) => [id.getFullName(), fields])
    .fromPairs()
    .value(),
)
