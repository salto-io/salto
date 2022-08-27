/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { AUTOMATION_TYPE, NOTIFICATION_EVENT_TYPE_NAME, NOTIFICATION_SCHEME_TYPE_NAME, WORKFLOW_RULES_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

type ValueToSort = {
  typeName: string
  fieldName: string
  sortBy: string[]
}

const WORKFLOW_CONDITION_SORT_BY = ['type', 'nodeType', 'operator', 'configuration.fieldId', 'configuration.comparator',
  'configuration.fieldValue', 'configuration.permissionKey', 'configuration.ignoreLoopTransitions',
  'configuration.includeCurrentStatus', 'configuration.mostRecentStatusOnly', 'configuration.reverseCondition',
  'configuration.previousStatus.id', 'configuration.value', 'configuration.toStatus.id', 'configuration.fromStatus.id',
  'configuration.group', 'configuration.allowUserInField', 'configuration.projectRole.id', 'configuration.comparisonType']

const VALUES_TO_SORT: ValueToSort[] = [
  {
    typeName: 'PermissionScheme',
    fieldName: 'permissions',
    sortBy: ['permission', 'holder.type', 'holder.parameter'],
  },
  {
    typeName: WORKFLOW_TYPE_NAME,
    fieldName: 'statuses',
    sortBy: ['id.elemID.name'],
  },
  {
    typeName: 'IssueTypeScreenScheme',
    fieldName: 'issueTypeMappings',
    sortBy: ['issueTypeId.elemID.name'],
  },
  {
    typeName: AUTOMATION_TYPE,
    fieldName: 'tags',
    sortBy: ['tagType', 'tagValue'],
  },
  {
    typeName: WORKFLOW_TYPE_NAME,
    fieldName: 'transitions',
    sortBy: ['name'],
  },
  {
    typeName: NOTIFICATION_EVENT_TYPE_NAME,
    fieldName: 'notifications',
    sortBy: ['type', 'parameter.elemID.name', 'parameter'],
  },
  {
    typeName: 'FieldConfigurationScheme',
    fieldName: 'items',
    sortBy: ['issueTypeId', 'fieldConfigurationId'],
  },
  {
    typeName: NOTIFICATION_SCHEME_TYPE_NAME,
    fieldName: 'notificationSchemeEvents',
    sortBy: ['eventType'],
  },
  {
    typeName: WORKFLOW_RULES_TYPE_NAME,
    fieldName: 'postFunctions',
    sortBy: ['type', 'configuration.event.id', 'configuration.fieldId', 'configuration.sourceFieldId', 'configuration.destinationFieldId',
      'configuration.copyType', 'configuration.projectRole.id', 'configuration.issueSecurityLevel.id', 'configuration.webhook.id',
      'configuration.mode', 'configuration.fieldValue', 'configuration.value'],
  },
  {
    typeName: WORKFLOW_RULES_TYPE_NAME,
    fieldName: 'validators',
    sortBy: ['type', 'configuration.comparator', 'configuration.date1', 'configuration.date2', 'configuration.expression',
      'configuration.includeTime', 'configuration.windowsDays', 'configuration.ignoreContext', 'configuration.errorMessage',
      'configuration.fieldId', 'configuration.excludeSubtasks', 'configuration.permissionKey', 'configuration.mostRecentStatusOnly',
      'configuration.previousStatus.id', 'configuration.nullAllowed', 'configuration.username'],
  },
  {
    typeName: WORKFLOW_RULES_TYPE_NAME,
    fieldName: 'conditions',
    sortBy: WORKFLOW_CONDITION_SORT_BY,
  },
  {
    typeName: WORKFLOW_RULES_TYPE_NAME,
    fieldName: 'triggers',
    sortBy: ['key'],
  },
  {
    typeName: 'WorkflowCondition',
    fieldName: 'conditions',
    sortBy: WORKFLOW_CONDITION_SORT_BY,
  },
]

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
      if (field === undefined) {
        return value
      }
      VALUES_TO_SORT
        .filter(
          ({ typeName, fieldName }) =>
            field.parent.elemID.typeName === typeName
              && field.name === fieldName
            && Array.isArray(value)
        )
        .forEach(({ sortBy }) => {
          _.assign(
            value,
            _.orderBy(
              value,
              sortBy.map(fieldPath => item => getValue(_.get(item, fieldPath))),
            )
          )
        })

      return value
    },
  }) ?? {}


  VALUES_TO_SORT
    .filter(({ typeName }) => instance.elemID.typeName === typeName)
    .forEach(({ fieldName, sortBy }) => {
      if (instance.value[fieldName] === undefined) {
        return
      }

      instance.value[fieldName] = _.orderBy(
        instance.value[fieldName],
        sortBy.map(fieldPath => item => getValue(_.get(item, fieldPath))),
      )
    })
}

const filter: FilterCreator = () => ({
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(sortLists)
  },
})

export default filter
