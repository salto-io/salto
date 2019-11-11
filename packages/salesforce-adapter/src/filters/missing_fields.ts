import _ from 'lodash'
import {
  isObjectType, Field, Values, Type, isType, BuiltinTypes, ElemID,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import { LEAD_CONVERT_SETTINGS_TYPE } from './lead_convert_settings'

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
    id: new ElemID(SALESFORCE, LEAD_CONVERT_SETTINGS_TYPE),
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
  {
    id: new ElemID(SALESFORCE, 'workflow'),
    fields: [
      {
        name: 'alerts',
        type: new ElemID(SALESFORCE, 'workflow_alert'),
      },
      {
        name: 'field_updates',
        type: new ElemID(SALESFORCE, 'workflow_field_update'),
      },
      {
        name: 'outbound_messages',
        type: new ElemID(SALESFORCE, 'workflow_outbound_message'),
      },
      {
        name: 'tasks',
        type: new ElemID(SALESFORCE, 'workflow_task'),
      },
      {
        name: 'knowledge_publishes',
        type: new ElemID(SALESFORCE, 'workflow_knowledge_publish'),
      },
      {
        name: 'send',
        type: new ElemID(SALESFORCE, 'workflow_send'),
      },
    ],
  },
]

export const makeFilter = (
  missingFields: Record<string, MissingField[]>
): FilterCreator => () => ({
  onFetch: async function onFetch(elements) {
    // We need a mapping of all the types so we can replace type names with the correct types
    const typeMap = _(elements)
      .filter(isType)
      .map(t => [t.elemID.getFullName(), t])
      .fromPairs()
      .value()

    // Add missing fields to types
    elements.filter(isObjectType).forEach(elem => {
      const fieldsToAdd = missingFields[elem.elemID.getFullName()]
      if (fieldsToAdd !== undefined) {
        _.assign(elem.fields, _(fieldsToAdd)
          .map(f => [f.name, new Field(
            elem.elemID,
            f.name,
            isType(f.type) ? f.type : typeMap[f.type.getFullName()],
            f.annotations || {},
            f.isList === true,
          )])
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
