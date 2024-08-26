/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { BuiltinTypes, Change, toChange } from '@salto-io/adapter-api'
import { createCustomObjectType, createField, defaultFilterContext } from '../utils'
import { ACTIVITY_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT, TASK_CUSTOM_OBJECT } from '../../src/constants'
import { FilterWith } from './mocks'
import filterCreator from '../../src/filters/task_and_event_custom_fields'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('taskAndEventCustomFieldsFilter', () => {
  const FIELD_NAME = 'TestField__c'
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  const activityType = createCustomObjectType(ACTIVITY_CUSTOM_OBJECT, {})
  const taskType = createCustomObjectType(TASK_CUSTOM_OBJECT, {})
  const eventType = createCustomObjectType(EVENT_CUSTOM_OBJECT, {})

  const activityField = createField(activityType, BuiltinTypes.STRING, `Activity.${FIELD_NAME}`, {}, FIELD_NAME)
  const additionalAnnotations = {
    creatable: true,
    deletable: true,
    updateable: true,
    // Arbitrary annotations to verify they are removed.
    label: 'Test',
    length: 18,
    someOtherAnnotation: 'some',
  }
  const taskField = createField(taskType, BuiltinTypes.STRING, `Task.${FIELD_NAME}`, additionalAnnotations, FIELD_NAME)
  const eventField = createField(
    eventType,
    BuiltinTypes.STRING,
    `Event.${FIELD_NAME}`,
    additionalAnnotations,
    FIELD_NAME,
  )

  beforeEach(() => {
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        fetchProfile: buildFetchProfile({
          fetchParams: {
            optionalFeatures: {
              taskAndEventCustomFields: true,
            },
          },
        }),
      },
    }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  })

  describe('onFetch', () => {
    it('should mutate custom fields to references', async () => {
      const elements = [activityType, taskType, eventType, activityField, taskField, eventField]
      await filter.onFetch(elements)
      ;[taskField, eventField].forEach(field => {
        expect(Object.keys(field.annotations)).toEqual([
          'apiName',
          'updateable',
          'creatable',
          'deletable',
          'activityField',
        ])
        expect(field.annotations.activityField.elemID).toEqual(activityField.elemID)
      })
    })
  })

  describe('deploy', () => {
    it('should drop addition and removal changes to Task and Event custom fields and re-add them after deploying', async () => {
      const originalChanges = [
        toChange({ after: taskField }),
        toChange({ after: eventField }),
        toChange({ after: activityField }),

        toChange({ before: taskField }),
        toChange({ before: eventField }),
        toChange({ before: activityField }),
      ]
      const changes = [...originalChanges]
      await filter.preDeploy(changes)
      expect(changes).toEqual([toChange({ after: activityField }), toChange({ before: activityField })])
      await filter.onDeploy(changes)
      expect(changes).toContainAllValues(originalChanges)
    })
    it('should not re-add a change if its corresponding Activity change failed', async () => {
      // Feed the filter with a change to Task field so it'll store it for `onDeploy`.
      await filter.preDeploy([toChange({ after: taskField })])
      const changes: Change[] = []
      await filter.onDeploy(changes)
      expect(changes).toBeEmpty()
    })
  })
})
