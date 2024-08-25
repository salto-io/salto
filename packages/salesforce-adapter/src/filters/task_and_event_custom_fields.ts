/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  Element,
  Field,
  getChangeData,
  isFieldChange,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { ACTIVITY_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT, SALESFORCE_CUSTOM_SUFFIX, TASK_CUSTOM_OBJECT } from '../constants'
import { apiNameSync, ensureSafeFilterFetch, isCustomObjectSync } from './utils'

const isCustomField = (field: Field): boolean => field.name.endsWith(SALESFORCE_CUSTOM_SUFFIX)

const isFieldOfTaskOrEvent = ({ parent }: Field): boolean =>
  isCustomObjectSync(parent) && [TASK_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT].includes(apiNameSync(parent) ?? '')


const ANNOTATIONS_TO_KEEP = ['apiName', 'updateable', 'creatable', 'deletable']

const filterCreator: LocalFilterCreator = ({ config }) => {
  let changesToRestore: Change[]

  return {
    name: 'taskAndEventCustomFields',
    /**
     * Upon fetch modify custom fields of `Task` and `Event` to point to the corresponding field in the `Activity` object.
     */
    onFetch: ensureSafeFilterFetch({
      warningMessage: 'Error occurred when attempting to modify custom fields of Task and Event objects',
      filterName: 'taskAndEventCustomFields',
      config,
      fetchFilterFunc: async (elements: Element[]) => {
        const activity = elements.filter(co => co.elemID.name === ACTIVITY_CUSTOM_OBJECT).pop() as ObjectType

        elements
          .filter(isCustomObjectSync)
          // TODO: filter with apiNameSync instead of elemID
          .filter(co => [TASK_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT].includes(co.elemID.name))
          .forEach(co => {
            Object.entries(co.fields).forEach(([fieldName, field]) => {
              if (!isCustomField(field)) {
                return
              }

              const activityField = activity?.fields[fieldName.replace(co.elemID.name, 'Activity')]
              if (!activityField) {
                return
              }

              field.annotations = {
                ..._.pick(field.annotations, ANNOTATIONS_TO_KEEP),
                activityField: new ReferenceExpression(activityField.elemID),
              }
            })
          })
      },
    }),
    preDeploy: async (changes: Change[]): Promise<void> => {
      changesToRestore = changes
        .filter(isFieldChange)
        .filter(change => isFieldOfTaskOrEvent(getChangeData(change)))
        .filter(change => isCustomField(getChangeData(change)))

      for (const change of changesToRestore) {
        changes.splice(changes.indexOf(change), 1)
      }
    },
    onDeploy: async (changes: Change[]): Promise<void> => {
      changes.push(...changesToRestore)
    },
  }
}

export default filterCreator
