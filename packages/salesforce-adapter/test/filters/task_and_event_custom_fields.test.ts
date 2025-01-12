/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { BuiltinTypes, Change, Field, toChange } from '@salto-io/adapter-api'
import { createCustomObjectType, createField, defaultFilterContext } from '../utils'
import { ACTIVITY_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT, TASK_CUSTOM_OBJECT } from '../../src/constants'
import { FilterWith } from './mocks'
import filterCreator from '../../src/filters/task_and_event_custom_fields'

describe('taskAndEventCustomFieldsFilter', () => {
  const FIELD_NAME = 'TestField__c'
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  const activityType = createCustomObjectType(ACTIVITY_CUSTOM_OBJECT, {})
  const taskType = createCustomObjectType(TASK_CUSTOM_OBJECT, {})
  const eventType = createCustomObjectType(EVENT_CUSTOM_OBJECT, {})

  // Arbitrary field annotations to verify they are removed.
  const activityAnnotations = {
    label: 'Test',
    length: 18,
    someOtherAnnotation: 'some',
  }
  const activityField = createField(
    activityType,
    BuiltinTypes.STRING,
    `Activity.${FIELD_NAME}`,
    activityAnnotations,
    FIELD_NAME,
  )
  const derivedFieldAnnotations = {
    ...activityAnnotations,
    creatable: true,
    deletable: true,
    updateable: true,
  }
  let taskField: Field
  let eventField: Field

  beforeEach(() => {
    taskField = createField(taskType, BuiltinTypes.STRING, `Task.${FIELD_NAME}`, derivedFieldAnnotations, FIELD_NAME)
    eventField = createField(eventType, BuiltinTypes.STRING, `Event.${FIELD_NAME}`, derivedFieldAnnotations, FIELD_NAME)

    filter = filterCreator({
      config: defaultFilterContext,
    }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  })

  describe('onFetch', () => {
    it('should mutate custom fields to references', async () => {
      const elements = [activityType, taskType, eventType, activityField, taskField, eventField]
      await filter.onFetch(elements)
      ;[taskField, eventField].forEach(field => {
        expect(Object.keys(field.annotations).sort()).toEqual(
          ['apiName', 'updateable', 'creatable', 'deletable', 'activityField'].sort(),
        )
        expect(field.annotations.activityField.elemID).toEqual(activityField.elemID)
      })
    })
    it('should not mutate custom fields to references if Activity is not found', async () => {
      const elements = [taskType, eventType, taskField, eventField]
      const res = await filter.onFetch(elements)
      expect(res).toBeUndefined()
      ;[taskField, eventField].forEach(field => {
        expect(Object.keys(field.annotations).sort()).toEqual(
          [
            'apiName',
            'modifyMe',
            'label',
            'length',
            'someOtherAnnotation',
            'updateable',
            'creatable',
            'deletable',
          ].sort(),
        )
        expect(field.annotations.activityField).toBeUndefined()
      })
    })

    describe('when types are missing', () => {
      it('should not return errors', async () => {
        const elements = [activityType, activityField, taskField, eventField]
        const res = await filter.onFetch(elements)
        expect(res).toBeUndefined()
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
