import _ from 'lodash'
import {
  isObjectType, Field, Values, Type, isType, BuiltinTypes, ElemID, Element,
  CORE_ANNOTATIONS, RESTRICTION_ANNOTATIONS,
} from 'adapter-api'
import { logger } from '@salto/logging'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import { LEAD_CONVERT_SETTINGS_TYPE_ID } from './lead_convert_settings'
import { id } from './utils'

const log = logger(module)

interface MissingField {
  name: string
  type: Type | ElemID
  annotations?: Values
  isList?: boolean
}

const allMissingFields: {id: ElemID; fields: MissingField[]}[] = [
  {
    id: new ElemID(SALESFORCE, 'FilterItem'),
    fields: [
      {
        name: 'operation',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: [
            'equals', 'notEqual', 'lessThan', 'greaterThan', 'lessOrEqual', 'greaterOrEqual',
            'contains', 'notContain', 'startsWith', 'includes', 'excludes', 'within',
          ],
          [CORE_ANNOTATIONS.RESTRICTION]: {
            [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true,
          },
        },
      },
    ],
  },
  {
    id: LEAD_CONVERT_SETTINGS_TYPE_ID,
    fields: [
      {
        name: 'objectMapping',
        type: new ElemID(SALESFORCE, 'ObjectMapping'),
        isList: true,
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'RuleEntry'),
    fields: [
      {
        name: 'assignedToType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['User', 'Queue'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ProfileTabVisibility'),
    fields: [
      {
        name: 'visibility',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['DefaultOff', 'DefaultOn', 'Hidden'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LayoutSection'),
    fields: [
      {
        name: 'style',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: [
            'TwoColumnsTopToBottom', 'TwoColumnsLeftToRight', 'OneColumn', 'CustomLinks',
          ],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'LayoutItem'),
    fields: [
      {
        name: 'behavior',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: [
            'Edit', 'Required', 'Readonly',
          ],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'Profile'),
    fields: [
      {
        name: 'userPermissions',
        type: new ElemID(SALESFORCE, 'ProfileUserPermission'),
        isList: true,
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
        name: 'flow_actions',
        type: new ElemID(SALESFORCE, 'workflow_flow_action'),
      },
      {
        name: 'knowledge_publishes',
        type: new ElemID(SALESFORCE, 'workflow_knowledge_publish'),
      },
      {
        name: 'outbound_messages',
        type: new ElemID(SALESFORCE, 'workflow_outbound_message'),
      },
      {
        name: 'tasks',
        type: new ElemID(SALESFORCE, 'workflow_task'),
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
      .map(t => [id(t), t])
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
      const fieldsToAdd = missingFields[id(elem)]
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
    .map(missingField => [missingField.id.getFullName(), missingField.fields])
    .fromPairs()
    .value(),
)
