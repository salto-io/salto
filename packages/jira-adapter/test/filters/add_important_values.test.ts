/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import addImportantValuesFilter from '../../src/filters/add_important_values'
import { createEmptyType, getFilterParams } from '../utils'
import { AUTOMATION_TYPE, FIELD_TYPE, PROJECT_TYPE, SCHEDULED_JOB_TYPE } from '../../src/constants'

describe('add important values filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  // const automationType = createEmptyType(AUTOMATION_TYPE)
  const automationType = new ObjectType({
    elemID: new ElemID('test', AUTOMATION_TYPE),
  })
  const fieldType = createEmptyType(FIELD_TYPE)
  const projectType = createEmptyType(PROJECT_TYPE)
  const scheduledJobType = createEmptyType(SCHEDULED_JOB_TYPE)
  const noType = createEmptyType('noType')

  beforeEach(async () => {
    filter = addImportantValuesFilter(getFilterParams()) as FilterType
  })
  describe('onFetch', () => {
    it('should add important values annotation correctly', async () => {
      await filter.onFetch([automationType, fieldType, projectType, scheduledJobType])
      expect(automationType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
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
      ])
      expect(fieldType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'description', highlighted: true, indexed: false },
        { value: 'isLocked', highlighted: false, indexed: true },
        { value: 'type', highlighted: true, indexed: true },
      ])
      expect(projectType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'description', highlighted: true, indexed: false },
        { value: 'key', highlighted: true, indexed: false },
        { value: 'projectTypeKey', highlighted: true, indexed: true },
        { value: 'leadAccountID', highlighted: true, indexed: false },
        { value: 'leadAccountID.displayName', highlighted: false, indexed: true },
      ])
      expect(scheduledJobType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
        { value: 'name', highlighted: true, indexed: false },
        { value: 'enabled', highlighted: true, indexed: true },
        { value: 'script', highlighted: true, indexed: false },
        { value: 'atlassianUser', highlighted: true, indexed: false },
        { value: 'atlassianUser.displayName', highlighted: false, indexed: true },
      ])
      expect(noType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toBeUndefined()
    })
    describe('projectsScope', () => {
      let objectType1: ObjectType
      let objectType2: ObjectType
      let objectType3: ObjectType
      let instance1: InstanceElement
      let instance2: InstanceElement
      let instance3: InstanceElement

      beforeEach(async () => {
        objectType1 = createEmptyType('objectType1')
        objectType2 = createEmptyType('objectType2')
        objectType3 = createEmptyType('objectType3')
        objectType2.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = []
        objectType3.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = [
          { value: 'quack', highlighted: false, indexed: true },
        ]
        instance1 = new InstanceElement('instance1', objectType1)
        instance2 = new InstanceElement('instance2', objectType2)
        instance3 = new InstanceElement('instance3', objectType3)
      })

      it('should add projectsScope as a hidden field to object types', async () => {
        const objectTypes = [objectType1, objectType2, objectType3]
        await filter.onFetch([instance1, instance2, instance3, ...objectTypes])

        objectTypes.forEach(objectType => {
          expect(objectType.fields.projectsScope).toBeDefined()
          expect(objectType.fields.projectsScope.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeTrue()
        })
      })

      it('should add projectsScope to important values annotation', async () => {
        const objectTypes = [objectType1, objectType2, objectType3]
        await filter.onFetch([instance1, instance2, instance3, ...objectTypes])
        expect(objectType1.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
          { value: 'projectsScope', highlighted: false, indexed: true },
        ])
        expect(objectType2.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
          { value: 'projectsScope', highlighted: false, indexed: true },
        ])
        expect(objectType3.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
          { value: 'quack', highlighted: false, indexed: true },
          { value: 'projectsScope', highlighted: false, indexed: true },
        ])
      })

      it('should not add projectsScope important values annotation to object types that does not represent instances', async () => {
        await filter.onFetch([objectType1])
        expect(objectType1.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toBeUndefined()
      })

      it('should not add projectsScope field to object types that does not represent instances', async () => {
        await filter.onFetch([objectType1])
        expect(objectType1.fields.projectsScope).toBeUndefined()
      })
    })
  })
})
