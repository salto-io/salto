/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  Element,
  Field,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  ListType,
  ObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { ImportantValues } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  APPLICATION_PROPERTY_TYPE,
  AUTOMATION_TYPE,
  BOARD_TYPE_NAME,
  DASHBOARD_TYPE,
  FIELD_CONFIGURATION_SCHEME_TYPE,
  FIELD_CONFIGURATION_TYPE_NAME,
  FILTER_TYPE_NAME,
  PROJECT_TYPE,
  SCHEDULED_JOB_TYPE,
  SCRIPTED_FIELD_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
  STATUS_TYPE_NAME,
  WEBHOOK_TYPE,
} from '../constants'
import { FIELD_TYPE_NAME } from './fields/constants'
import { PROJECT_SCOPE_FIELD_NAME } from './projects_scope'

const { makeArray } = collections.array

const importantValuesMap: Record<string, ImportantValues> = {
  [APPLICATION_PROPERTY_TYPE]: [{ value: 'type', highlighted: false, indexed: true }],
  [AUTOMATION_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'state', highlighted: true, indexed: true },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'authorAccountId', highlighted: true, indexed: false },
    { value: 'authorAccountId.displayName', highlighted: false, indexed: true },
    { value: 'projects', highlighted: true, indexed: false },
    { value: 'trigger', highlighted: true, indexed: false },
    { value: 'components', highlighted: true, indexed: false },
    { value: 'trigger.type', highlighted: false, indexed: true },
    { value: 'labels', highlighted: true, indexed: true },
  ],
  [BOARD_TYPE_NAME]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'type', highlighted: true, indexed: true },
    { value: 'location', highlighted: true, indexed: false },
    { value: 'filterId', highlighted: true, indexed: false },
  ],
  [DASHBOARD_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'gadgets', highlighted: true, indexed: false },
  ],
  [FIELD_TYPE_NAME]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'isLocked', highlighted: false, indexed: true },
    { value: 'type', highlighted: true, indexed: true },
  ],
  [FIELD_CONFIGURATION_TYPE_NAME]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
  ],
  [FIELD_CONFIGURATION_SCHEME_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
  ],
  [FILTER_TYPE_NAME]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'owner', highlighted: true, indexed: false },
    { value: 'owner.displayName', highlighted: false, indexed: true },
    { value: 'jql', highlighted: true, indexed: false },
  ],
  [PROJECT_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'description', highlighted: true, indexed: false },
    { value: 'key', highlighted: true, indexed: false },
    { value: 'projectTypeKey', highlighted: true, indexed: true },
    { value: 'leadAccountID', highlighted: true, indexed: false },
    { value: 'leadAccountID.displayName', highlighted: false, indexed: true },
  ],
  [SCHEDULED_JOB_TYPE]: [
    { value: 'name', highlighted: true, indexed: false },
    { value: 'enabled', highlighted: true, indexed: true },
    { value: 'script', highlighted: true, indexed: false },
    { value: 'atlassianUser', highlighted: true, indexed: false },
    { value: 'atlassianUser.displayName', highlighted: false, indexed: true },
  ],
  [SCRIPTED_FIELD_TYPE]: [
    { value: 'enabled', highlighted: false, indexed: true },
    { value: 'scriptedFieldType', highlighted: false, indexed: true },
  ],
  [SCRIPT_RUNNER_LISTENER_TYPE]: [{ value: 'enabled', highlighted: false, indexed: true }],
  [STATUS_TYPE_NAME]: [{ value: 'statusCategory', highlighted: false, indexed: true }],
  [WEBHOOK_TYPE]: [{ value: 'Enabled', highlighted: false, indexed: true }],
}

const createProjectScopeField = (objectType: ObjectType): Field =>
  new Field(objectType, PROJECT_SCOPE_FIELD_NAME, new ListType(BuiltinTypes.STRING), {
    [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
  })

const addProjectScopeAnnotation = (objectType: ObjectType): void => {
  objectType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = [
    ...makeArray(objectType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]),
    {
      value: PROJECT_SCOPE_FIELD_NAME,
      highlighted: false,
      indexed: true,
    },
  ]
}

const addProjectScopeToObjectTypes = (instances: InstanceElement[]): void => {
  const objectTypes = _.uniqBy(
    instances.map(instance => instance.getTypeSync()),
    objectType => objectType.elemID.getFullName(),
  )

  objectTypes.forEach(objectType => {
    objectType.fields[PROJECT_SCOPE_FIELD_NAME] = createProjectScopeField(objectType)
    addProjectScopeAnnotation(objectType)
  })
}

// Adds relevant important values for the Jira adapter
const filter: FilterCreator = () => ({
  name: 'addImportantValues',
  onFetch: async (elements: Element[]): Promise<void> => {
    const objectTypes = elements.filter(isObjectType)
    objectTypes.forEach(obj => {
      const { typeName } = obj.elemID
      const importantValuesArray = importantValuesMap[typeName]
      if (Array.isArray(importantValuesArray)) {
        obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = importantValuesArray
      }
    })
    // projectsScope field
    addProjectScopeToObjectTypes(elements.filter(isInstanceElement))
  },
})

export default filter
