/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import {
  Change,
  Element,
  Field,
  getChangeData,
  isFieldChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { ACTIVITY_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT, TASK_CUSTOM_OBJECT } from '../constants'
import {
  apiNameSync,
  buildElementsSourceForFetch,
  ensureSafeFilterFetch,
  isCustomField,
  isCustomObjectSync, isFieldOfTaskOrEvent,
} from './utils'
import { findMatchingActivityChange } from '../change_validators/task_or_event_fields_modifications'

const { isDefined } = values
const { awu } = collections.asynciterable

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
        const elementsSource = buildElementsSourceForFetch(elements, config)
        const elementSourceByApiName = await awu(await elementsSource.getAll())
          .filter(isDefined)
          .filter(isCustomObjectSync)
          .keyBy(co => apiNameSync(co) ?? '')
        const activity = elementSourceByApiName[ACTIVITY_CUSTOM_OBJECT]
        if (activity === undefined) {
          return
        }

        const elementsByApiName = _.keyBy(elements, elem => apiNameSync(elem) ?? '')

        Object.entries(activity.fields)
          .filter(([, activityField]) => isCustomField(activityField))
          .flatMap(([activityFieldName]) => {
            const ret = [
              elementsByApiName[TASK_CUSTOM_OBJECT].fields[activityFieldName],
              elementsByApiName[EVENT_CUSTOM_OBJECT].fields[activityFieldName],
            ]
            return ret
          })
          .forEach(taskOrEventField => {
            taskOrEventField.annotations = {
              ..._.pick(taskOrEventField.annotations, ANNOTATIONS_TO_KEEP),
              activityField: new ReferenceExpression(elementSourceByApiName[ACTIVITY_CUSTOM_OBJECT].fields[taskOrEventField.name].elemID),
            }
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
