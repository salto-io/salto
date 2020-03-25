/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import {
  isObjectType, Field, Values, TypeElement, isType, BuiltinTypes, ElemID, Element,
  CORE_ANNOTATIONS, RESTRICTION_ANNOTATIONS, TypeMap,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  CUSTOM_FIELD, CUSTOM_OBJECT, FIELD_TYPE_NAME_VALUES, SALESFORCE, WORKFLOW_METADATA_TYPE,
  LEAD_CONVERT_SETTINGS_METADATA_TYPE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE,
} from '../constants'
import { id } from './utils'
import {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_FLOW_ACTIONS_FIELD,
  WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD, WORKFLOW_OUTBOUND_MESSAGES_FIELD, WORKFLOW_TASKS_FIELD,
} from './workflow'

const log = logger(module)

interface MissingField {
  name: string
  type: TypeElement | ElemID
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
    id: new ElemID(SALESFORCE, LEAD_CONVERT_SETTINGS_METADATA_TYPE),
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
          [CORE_ANNOTATIONS.VALUES]: ['Asc', 'Desc'],
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
          [CORE_ANNOTATIONS.VALUES]: ['Asc', 'Desc'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, CUSTOM_OBJECT),
    fields: [
      {
        name: 'customSettingsType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['List', 'Hierarchy'],
        },
      },
      {
        name: 'deploymentStatus',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['InDevelopment', 'Deployed'],
        },
      },
      {
        name: 'externalSharingModel',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Private', 'Read', 'ReadWrite', 'ReadWriteTransfer',
            'FullAccess', 'ControlledByParent', 'ControlledByCampaign', 'ControlledByLeadOrContact',
          ],
        },
      },
      {
        name: 'gender',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Masculine', 'Feminine', 'Neuter', 'AnimateMasculine'],
        },
      },
      {
        name: 'sharingModel',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Private', 'Read', 'ReadWrite', 'ReadWriteTransfer',
            'FullAccess', 'ControlledByParent', 'ControlledByCampaign', 'ControlledByLeadOrContact',
          ],
        },
      },
      {
        name: 'startsWith',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Consonant', 'Vowel', 'Special'],
        },
      },
      {
        name: 'visibility',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Public', 'Protected', 'PackageProtected'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, CUSTOM_FIELD),
    fields: [
      {
        name: 'type',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: FIELD_TYPE_NAME_VALUES,
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ListView'),
    fields: [
      {
        name: 'filterScope',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Everything', 'Mine', 'MineAndMyGroups', 'Queue', 'Delegated',
            'MyTerritory', 'MyTeamTerritory', 'Team'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'ListViewFilter'),
    fields: [
      {
        name: 'operation',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['equals', 'notEqual', 'lessThan', 'greaterThan',
            'lessOrEqual', 'greaterOrEqual', 'contains', 'notContain', 'startsWith', 'includes',
            'excludes', 'within'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'WebLink'),
    fields: [
      {
        name: 'displayType',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['link', 'button', 'massActionButton'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, 'StandardValue'),
    fields: [
      {
        name: 'forecastCategory',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Omitted', 'Pipeline', 'BestCase', 'Forecast', 'Closed'],
        },
      },
    ],
  },
  {
    id: new ElemID(SALESFORCE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE),
    fields: [
      {
        name: 'gender',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: [
            'Masculine', 'Feminine', 'Neuter', 'AnimateMasculine', 'ClassI', 'ClassIII', 'ClassV',
            'ClassVII', 'ClassIX', 'ClassXI', 'ClassXIV', 'ClassXV', 'ClassXVI', 'ClassXVII',
            'ClassXVIII',
          ],
        },
      },
      {
        name: 'startsWith',
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.VALUES]: ['Consonant', 'Vowel', 'Special'],
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
    const typeMap: TypeMap = _(elements)
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
      return new Field(elem.elemID, f.name, type, f.annotations)
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
