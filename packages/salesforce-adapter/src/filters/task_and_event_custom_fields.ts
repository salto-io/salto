/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import {
  Change,
  Element,
  ElemID,
  Field,
  getChangeData,
  isFieldChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { ACTIVITY_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT, SALESFORCE, TASK_CUSTOM_OBJECT } from '../constants'
import {
  apiNameSync,
  buildElementsSourceForFetch,
  ensureSafeFilterFetch,
  isCustomField,
  isCustomObjectSync,
  isFieldOfTaskOrEvent,
} from './utils'
import { findMatchingActivityChange } from '../change_validators/task_or_event_fields_modifications'

const { isDefined } = values

const filterCreator: LocalFilterCreator = ({ config }) => {
  let taskOrEventFieldChanges: Change[]

  return {
    name: 'taskAndEventCustomFields',
    /**
     * Upon fetch modify custom fields of `Task` and `Event` to point to the corresponding field in the `Activity` object.
     */
    onFetch: ensureSafeFilterFetch({
      warningMessage:
        'Error occurred when attempting to remodel CustomFields of Task and Event to reference their respective Activity fields.',
      filterName: 'taskAndEventCustomFields',
      config,
      fetchFilterFunc: async (elements: Element[]) => {
        const elementsSource = buildElementsSourceForFetch(elements, config)
        const activity = await elementsSource.get(new ElemID(SALESFORCE, ACTIVITY_CUSTOM_OBJECT))
        if (!isCustomObjectSync(activity)) {
          log.debug('Activity Object not found')
          return
        }

        const elementsByApiName = _.keyBy(elements.filter(isCustomObjectSync), elem => apiNameSync(elem) ?? '')

        Object.values(activity.fields)
          .filter(isCustomField)
          .flatMap(activityField => {
            const activityFieldName = apiNameSync(activityField, true)
            if (activityFieldName === undefined) {
              return []
            }
            const getMatchingField = (objectName: string): Field | undefined =>
              Object.values(elementsByApiName[objectName]?.fields).find(
                field => apiNameSync(field, true) === activityFieldName,
              )
            return [
              [activityField, getMatchingField(TASK_CUSTOM_OBJECT)],
              [activityField, getMatchingField(EVENT_CUSTOM_OBJECT)],
            ]
          })
          .filter((fields): fields is Field[] => fields.every(isDefined))
          .forEach(([activityField, taskOrEventField]: Field[]) => {
            const annotationsToOmit = new Set(Object.keys(activity.fields[taskOrEventField.name].annotations))
            annotationsToOmit.delete('apiName')
            taskOrEventField.annotations = {
              ..._.omit(taskOrEventField.annotations, Array.from(annotationsToOmit)),
              activityField: new ReferenceExpression(activityField.elemID, activityField),
            }
          })
      },
    }),
    preDeploy: async (changes: Change[]): Promise<void> => {
      taskOrEventFieldChanges = changes
        .filter(isFieldChange)
        .filter(change => isFieldOfTaskOrEvent(getChangeData(change)))
        .filter(change => isCustomField(getChangeData(change)))

      _.pullAll(changes, taskOrEventFieldChanges)
    },
    onDeploy: async (changes: Change[]): Promise<void> => {
      taskOrEventFieldChanges
        .filter(change => findMatchingActivityChange(change, changes) !== undefined)
        .forEach(change => changes.push(change))
    },
  }
}

export default filterCreator
