/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../utils'
import { JIRA, PROJECT_TYPE } from '../../src/constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../src/filters/fields/constants'
import projectFieldContextsFilter from '../../src/filters/project_field_contexts_order'
import { PROJECT_CONTEXTS_FIELD } from '../../src/filters/fields/contexts_projects_filter'

describe('projectFieldContext', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let contextType: ObjectType
  let projectType: ObjectType
  let projectInstance: InstanceElement
  let beforeProjectInstance: InstanceElement
  let firstContextInstance: InstanceElement
  let secondContextInstance: InstanceElement

  beforeEach(() => {
    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
    })

    firstContextInstance = new InstanceElement('first', contextType, {
      id: 1,
    })

    secondContextInstance = new InstanceElement('second', contextType, {
      id: 2,
    })

    projectInstance = new InstanceElement('instance', projectType, {
      [PROJECT_CONTEXTS_FIELD]: [
        new ReferenceExpression(firstContextInstance.elemID, firstContextInstance),
        new ReferenceExpression(secondContextInstance.elemID, secondContextInstance),
      ],
    })

    filter = projectFieldContextsFilter(getFilterParams()) as typeof filter
  })

  describe('onFetch', () => {
    it('should not change the contexts order', async () => {
      await filter.onFetch([projectInstance, firstContextInstance, secondContextInstance])

      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD]).toHaveLength(2)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0].resValue.value.id).toEqual(1)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][1]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][1].resValue.value.id).toEqual(2)
    })
    it('should change the contexts order', async () => {
      projectInstance.value[PROJECT_CONTEXTS_FIELD] = [
        new ReferenceExpression(secondContextInstance.elemID, secondContextInstance),
        new ReferenceExpression(firstContextInstance.elemID, firstContextInstance),
      ]
      await filter.onFetch([projectInstance, firstContextInstance, secondContextInstance])

      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD]).toHaveLength(2)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0].resValue.value.id).toEqual(1)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][1]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][1].resValue.value.id).toEqual(2)
    })
  })
  describe('onDeploy', () => {
    beforeEach(() => {
      beforeProjectInstance = new InstanceElement('first', projectType, {
        [PROJECT_CONTEXTS_FIELD]: [new ReferenceExpression(firstContextInstance.elemID, firstContextInstance)],
      })
    })
    it('should append the new context to the end of the list', async () => {
      await filter.onDeploy([toChange({ before: beforeProjectInstance, after: projectInstance })])

      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD]).toHaveLength(2)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0].resValue.value.id).toEqual(1)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][1]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][1].resValue.value.id).toEqual(2)
    })
    it('should insert the new context to the begin of the list', async () => {
      beforeProjectInstance.value[PROJECT_CONTEXTS_FIELD] = [
        new ReferenceExpression(secondContextInstance.elemID, secondContextInstance),
      ]
      projectInstance.value[PROJECT_CONTEXTS_FIELD] = [
        new ReferenceExpression(secondContextInstance.elemID, secondContextInstance),
        new ReferenceExpression(firstContextInstance.elemID, firstContextInstance),
      ]
      await filter.onDeploy([toChange({ before: beforeProjectInstance, after: projectInstance })])

      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD]).toHaveLength(2)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0].resValue.value.id).toEqual(1)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][1]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][1].resValue.value.id).toEqual(2)
    })
  })
})
