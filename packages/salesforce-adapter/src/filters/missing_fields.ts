import _ from 'lodash'
import {
  isObjectType, Field, Values, Type, isType, BuiltinTypes, ElemID, Element,
  CORE_ANNOTATIONS, RESTRICTION_ANNOTATIONS,
} from 'adapter-api'
import { logger } from '@salto/logging'
import { FilterCreator } from '../filter'
import { SALESFORCE, WORKFLOW_METADATA_TYPE } from '../constants'
import { LEAD_CONVERT_SETTINGS_TYPE_ID } from './lead_convert_settings'
import { id } from './utils'
import {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_FLOW_ACTIONS_FIELD,
  WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD, WORKFLOW_OUTBOUND_MESSAGES_FIELD, WORKFLOW_TASKS_FIELD,
} from './workflow'

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
    id: new ElemID(SALESFORCE, WORKFLOW_METADATA_TYPE),
    fields: [
      {
        name: WORKFLOW_ALERTS_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowAlert'),
      },
      {
        name: WORKFLOW_FIELD_UPDATES_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowFieldUpdate'),
      },
      {
        name: WORKFLOW_FLOW_ACTIONS_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowFlowAction'),
      },
      {
        name: WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowKnowledgePublish'),
      },
      {
        name: WORKFLOW_OUTBOUND_MESSAGES_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowOutboundMessage'),
      },
      {
        name: WORKFLOW_TASKS_FIELD,
        type: new ElemID(SALESFORCE, 'WorkflowTask'),
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowCondition'),
    fields: [
      {
        name: 'operator',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['EqualTo', 'NotEqualTo', 'GreaterThan', 'LessThan',
            'GreaterThanOrEqualTo', 'LessThanOrEqualTo', 'StartsWith', 'EndsWith', 'Contains',
            'IsNull', 'WasSet', 'WasSelected', 'WasVisited'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowAssignmentItem'),
    fields: [
      {
        name: 'operator',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Add', 'AddAtStart', 'AddItem', 'Assign', 'AssignCount',
            'RemoveAfterFirst', 'RemoveAll', 'RemoveBeforeFirst', 'RemoveFirst', 'RemovePosition',
            'RemoveUncommon', 'Subtract'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowRecordFilter'),
    fields: [
      {
        name: 'operator',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['EqualTo', 'NotEqualTo', 'GreaterThan', 'LessThan',
            'GreaterThanOrEqualTo', 'LessThanOrEqualTo', 'StartsWith', 'EndsWith', 'Contains',
            'IsNull'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowDynamicChoiceSet'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Currency', 'Date', 'Number', 'String', 'Boolean', 'Picklist',
            'Multipicklist'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowScreenField'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Boolean', 'Currency', 'Date', 'DateTime', 'Number',
            'String'],
        },
      },
      {
        name: 'fieldType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['DisplayText', 'InputField', 'LargeTextArea', 'PasswordField',
            'RadioButtons', 'DropdownBox', 'MultiSelectCheckboxes', 'MultiSelectPicklist',
            'ComponentInstance'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowVariable'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Apex', 'Boolean', 'Currency', 'Date', 'DateTime', 'Number',
            'Multipicklist', 'Picklist', 'String', 'SObject'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowChoice'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Boolean', 'Currency', 'Date', 'Number', 'String'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowConstant'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Boolean', 'Currency', 'Date', 'Number', 'String'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowFormula'),
    fields: [
      {
        name: 'dataType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Boolean', 'Currency', 'Date', 'DateTime', 'Number',
            'String'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowRecordLookup'),
    fields: [
      {
        name: 'sortOrder',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['ASC', 'DESC'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'FlowLoop'),
    fields: [
      {
        name: 'iterationOrder',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['ASC', 'DESC'],
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
