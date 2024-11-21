/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { isResolvedReferenceExpression, transformValuesSync } from '@salto-io/adapter-utils'
import _ from 'lodash'
import {
  AUTOMATION_TYPE,
  DASHBOARD_TYPE,
  FIELD_CONFIGURATION_SCHEME_TYPE,
  ISSUE_TYPE_SCREEN_SCHEME_TYPE,
  NOTIFICATION_EVENT_TYPE_NAME,
  NOTIFICATION_SCHEME_TYPE_NAME,
  PERMISSION_SCHEME_TYPE_NAME,
  PROJECT_ROLE_TYPE,
  WORKFLOW_CONFIGURATION_TYPE,
  WORKFLOW_RULES_TYPE_NAME,
  WORKFLOW_STATUS_TYPE_NAME,
  WORKFLOW_TRANSITION_TYPE_NAME,
  WORKFLOW_TYPE_NAME,
} from '../constants'
import { FilterCreator } from '../filter'

const WORKFLOW_CONDITION_SORT_BY = [
  'type',
  'nodeType',
  'operator',
  'configuration.fieldId',
  'configuration.comparator',
  'configuration.fieldValue',
  'configuration.permissionKey',
  'configuration.ignoreLoopTransitions',
  'configuration.includeCurrentStatus',
  'configuration.mostRecentStatusOnly',
  'configuration.reverseCondition',
  'configuration.previousStatus.id',
  'configuration.value',
  'configuration.toStatus.id',
  'configuration.fromStatus.id',
  'configuration.group',
  'configuration.allowUserInField',
  'configuration.projectRole.id',
  'configuration.comparisonType',
]

const TYPES_AND_VALUES_TO_SORT: Record<string, Record<string, Record<string, string[]>>> = {
  [PERMISSION_SCHEME_TYPE_NAME]: {
    PermissionScheme: {
      permissions: ['permission', 'holder.type', 'holder.parameter'],
    },
  },
  [ISSUE_TYPE_SCREEN_SCHEME_TYPE]: {
    IssueTypeScreenScheme: {
      issueTypeMappings: ['issueTypeId.elemID.name'],
    },
  },
  [AUTOMATION_TYPE]: {
    [AUTOMATION_TYPE]: {
      tags: ['tagType', 'tagValue'],
      projects: ['projectId.elemID.name', 'projectTypeKey'],
    },
  },
  [FIELD_CONFIGURATION_SCHEME_TYPE]: {
    FieldConfigurationScheme: {
      items: ['issueTypeId', 'fieldConfigurationId'],
    },
  },
  [NOTIFICATION_SCHEME_TYPE_NAME]: {
    [NOTIFICATION_EVENT_TYPE_NAME]: {
      notifications: ['type', 'parameter.elemID.name', 'parameter'],
    },
    [NOTIFICATION_SCHEME_TYPE_NAME]: {
      notificationSchemeEvents: ['eventType'],
    },
  },
  [DASHBOARD_TYPE]: {
    [DASHBOARD_TYPE]: {
      gadgets: ['value.value.position.column', 'value.value.position.row'],
    },
  },
  [PROJECT_ROLE_TYPE]: {
    [PROJECT_ROLE_TYPE]: {
      actors: ['displayName'],
    },
  },
  // Jira DC Workflow
  [WORKFLOW_TYPE_NAME]: {
    [WORKFLOW_TYPE_NAME]: {
      statuses: ['id.elemID.name'],
    },
    [WORKFLOW_STATUS_TYPE_NAME]: {
      properties: ['key'],
    },
    WorkflowCondition: {
      conditions: WORKFLOW_CONDITION_SORT_BY,
    },
    [WORKFLOW_TRANSITION_TYPE_NAME]: {
      from: ['elemID.name'],
      properties: ['key'],
    },
    [WORKFLOW_RULES_TYPE_NAME]: {
      validators: [
        'type',
        'configuration.comparator',
        'configuration.date1',
        'configuration.date2',
        'configuration.expression',
        'configuration.includeTime',
        'configuration.windowsDays',
        'configuration.ignoreContext',
        'configuration.errorMessage',
        'configuration.fieldId',
        'configuration.excludeSubtasks',
        'configuration.permissionKey',
        'configuration.mostRecentStatusOnly',
        'configuration.previousStatus.id',
        'configuration.nullAllowed',
        'configuration.username',
      ],
      conditions: WORKFLOW_CONDITION_SORT_BY,
      triggers: ['key'],
    },
  },
  // Jira Cloud Workflow
  [WORKFLOW_CONFIGURATION_TYPE]: {
    [WORKFLOW_CONFIGURATION_TYPE]: {
      statuses: ['statusReference.elemID.name'],
    },
    WorkflowReferenceStatus: {
      properties: ['key'],
    },
    WorkflowTransitions: {
      properties: ['key'],
    },
    //TODO: add also WorkflowCondition
  }
}

const getValue = (value: Value): Value => (isResolvedReferenceExpression(value) ? value.elemID.getFullName() : value)

const sortLists = (instance: InstanceElement): void => {
  instance.value =
    transformValuesSync({
      values: instance.value,
      type: instance.getTypeSync(),
      strict: false,
      allowEmptyArrays: true,
      allowEmptyObjects: true,
      transformFunc: ({ value, field }) => {
        if (field === undefined || !Array.isArray(value)) {
          return value
        }
        const sortFields = TYPES_AND_VALUES_TO_SORT[instance.elemID.typeName][field.parent.elemID.typeName]?.[field.name]

        if (sortFields !== undefined) {
          _.assign(
            value,
            _.orderBy(
              value,
              sortFields.map(fieldPath => item => getValue(_.get(item, fieldPath))),
            ),
          )
        }

        return value
      },
    }) ?? {}
}

const filter: FilterCreator = () => ({
  name: 'sortListsFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName in TYPES_AND_VALUES_TO_SORT)
      .forEach(instance => sortLists(instance))
  },
})

export default filter
