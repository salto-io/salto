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
import { findMatchingActivityChange } from '../change_validators/task_or_event_fields_modifications'

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
      warningMessage: 'Error occurred when attempting to remodel CustomFields of Task and Event to reference their respective Activity fields.',
      filterName: 'taskAndEventCustomFields',
      config,
      fetchFilterFunc: async (elements: Element[]) => {
        const activity = elements.filter(co => co.elemID.name === ACTIVITY_CUSTOM_OBJECT).pop() as ObjectType

        elements
          .filter(isCustomObjectSync)
          .filter(co => [TASK_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT].includes(apiNameSync(co, true) ?? ''))
          .forEach(co => {
            Object.entries(co.fields).forEach(([, field]) => {
              if (!isCustomField(field)) {
                return
              }

              const activityField = activity?.fields[field.name]
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
      for (const change of changesToRestore) {
        if (findMatchingActivityChange(change, changes) !== undefined) {
          changes.push(change)
        }
      }
    },
  }
}

export default filterCreator
