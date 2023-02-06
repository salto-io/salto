/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { InstanceElement, isInstanceElement, isReferenceExpression, Value } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { AUTOMATION_TYPE, DASHBOARD_TYPE, NOTIFICATION_EVENT_TYPE_NAME, NOTIFICATION_SCHEME_TYPE_NAME, PROJECT_ROLE_TYPE, WORKFLOW_RULES_TYPE_NAME, WORKFLOW_STATUS_TYPE_NAME, WORKFLOW_TRANSITION_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable


const WORKFLOW_CONDITION_SORT_BY = ['type', 'nodeType', 'operator', 'configuration.fieldId', 'configuration.comparator',
  'configuration.fieldValue', 'configuration.permissionKey', 'configuration.ignoreLoopTransitions',
  'configuration.includeCurrentStatus', 'configuration.mostRecentStatusOnly', 'configuration.reverseCondition',
  'configuration.previousStatus.id', 'configuration.value', 'configuration.toStatus.id', 'configuration.fromStatus.id',
  'configuration.group', 'configuration.allowUserInField', 'configuration.projectRole.id', 'configuration.comparisonType']

const VALUES_TO_SORT: Record<string, Record<string, string[]>> = {
  PermissionScheme: {
    permissions: ['permission', 'holder.type', 'holder.parameter'],
  },
  IssueTypeScreenScheme: {
    issueTypeMappings: ['issueTypeId.elemID.name'],
  },
  [AUTOMATION_TYPE]: {
    tags: ['tagType', 'tagValue'],
  },
  [WORKFLOW_TYPE_NAME]: {
    transitions: ['name'],
    statuses: ['id.elemID.name'],
  },
  [NOTIFICATION_EVENT_TYPE_NAME]: {
    notifications: ['type', 'parameter.elemID.name', 'parameter'],
  },
  FieldConfigurationScheme: {
    items: ['issueTypeId', 'fieldConfigurationId'],
  },
  [NOTIFICATION_SCHEME_TYPE_NAME]: {
    notificationSchemeEvents: ['eventType'],
  },
  [WORKFLOW_RULES_TYPE_NAME]: {
    postFunctions: ['type', 'configuration.event.id', 'configuration.fieldId', 'configuration.sourceFieldId', 'configuration.destinationFieldId',
      'configuration.copyType', 'configuration.projectRole.id', 'configuration.issueSecurityLevel.id', 'configuration.webhook.id',
      'configuration.mode', 'configuration.fieldValue', 'configuration.value'],

    validators: ['type', 'configuration.comparator', 'configuration.date1', 'configuration.date2', 'configuration.expression',
      'configuration.includeTime', 'configuration.windowsDays', 'configuration.ignoreContext', 'configuration.errorMessage',
      'configuration.fieldId', 'configuration.excludeSubtasks', 'configuration.permissionKey', 'configuration.mostRecentStatusOnly',
      'configuration.previousStatus.id', 'configuration.nullAllowed', 'configuration.username'],

    conditions: WORKFLOW_CONDITION_SORT_BY,
    triggers: ['key'],
  },
  WorkflowCondition: {
    conditions: WORKFLOW_CONDITION_SORT_BY,
  },
  [WORKFLOW_TRANSITION_TYPE_NAME]: {
    from: ['elemID.name'],
    properties: ['key'],
  },
  [DASHBOARD_TYPE]: {
    gadgets: ['value.value.position.column', 'value.value.position.row'],
  },
  [PROJECT_ROLE_TYPE]: {
    actors: ['displayName'],
  },
  [WORKFLOW_STATUS_TYPE_NAME]: {
    properties: ['key'],
  },
}

const getValue = (value: Value): Value => (
  isReferenceExpression(value) ? value.elemID.getFullName() : value
)

const sortLists = async (instance: InstanceElement): Promise<void> => {
  instance.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, field }) => {
      if (field === undefined || !Array.isArray(value)) {
        return value
      }
      const sortFields = VALUES_TO_SORT[field.parent.elemID.typeName]?.[field.name]

      if (sortFields !== undefined) {
        _.assign(
          value,
          _.orderBy(
            value,
            sortFields.map(fieldPath => item => getValue(_.get(item, fieldPath))),
          )
        )
      }

      return value
    },
  }) ?? {}
}

const filter: FilterCreator = () => ({
  name: 'sortListsFilter',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(sortLists)
  },
})

export default filter
