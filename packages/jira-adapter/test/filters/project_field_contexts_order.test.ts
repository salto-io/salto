/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { createEmptyType, getFilterParams } from '../utils'
import { PROJECT_IDS, PROJECT_TYPE } from '../../src/constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../src/filters/fields/constants'
import projectFieldContextsFilter from '../../src/filters/project_field_contexts_order'

describe('projectFieldContext', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let contextType: ObjectType
  let projectType: ObjectType
  let projectInstances: InstanceElement[]
  let firstContextInstance: InstanceElement
  let secondContextInstance: InstanceElement

  beforeEach(() => {
    contextType = createEmptyType(FIELD_CONTEXT_TYPE_NAME)
    projectType = createEmptyType(PROJECT_TYPE)

    firstContextInstance = new InstanceElement('first', contextType, {
      id: 1,
    })

    secondContextInstance = new InstanceElement('second', contextType, {
      id: 2,
    })

    projectInstances = _.range(0, 3).map(i => new InstanceElement(`project${String(i)}`, projectType, {}))
    firstContextInstance.value[PROJECT_IDS] = [
      new ReferenceExpression(projectInstances[2].elemID, projectInstances[2]),
      new ReferenceExpression(projectInstances[0].elemID, projectInstances[0]),
      new ReferenceExpression(projectInstances[1].elemID, projectInstances[1]),
    ]
    secondContextInstance.value[PROJECT_IDS] = [
      new ReferenceExpression(projectInstances[1].elemID, projectInstances[1]),
      new ReferenceExpression(projectInstances[0].elemID, projectInstances[0]),
      new ReferenceExpression(projectInstances[2].elemID, projectInstances[2]),
    ]
    filter = projectFieldContextsFilter(getFilterParams()) as typeof filter
  })

  describe('onFetch', () => {
    it('should change the contexts order', async () => {
      await filter.onFetch([...projectInstances, firstContextInstance, secondContextInstance])

      expect(firstContextInstance.value[PROJECT_IDS]).toHaveLength(3)
      expect(firstContextInstance.value[PROJECT_IDS][0]).toBeInstanceOf(ReferenceExpression)
      expect(firstContextInstance.value[PROJECT_IDS][0].resValue.elemID).toEqual(projectInstances[0].elemID)
      expect(firstContextInstance.value[PROJECT_IDS][1]).toBeInstanceOf(ReferenceExpression)
      expect(firstContextInstance.value[PROJECT_IDS][1].resValue.elemID).toEqual(projectInstances[1].elemID)
      expect(firstContextInstance.value[PROJECT_IDS][2]).toBeInstanceOf(ReferenceExpression)
      expect(firstContextInstance.value[PROJECT_IDS][2].resValue.elemID).toEqual(projectInstances[2].elemID)

      expect(secondContextInstance.value[PROJECT_IDS]).toHaveLength(3)
      expect(secondContextInstance.value[PROJECT_IDS][0]).toBeInstanceOf(ReferenceExpression)
      expect(secondContextInstance.value[PROJECT_IDS][0].resValue.elemID).toEqual(projectInstances[0].elemID)
      expect(secondContextInstance.value[PROJECT_IDS][1]).toBeInstanceOf(ReferenceExpression)
      expect(secondContextInstance.value[PROJECT_IDS][1].resValue.elemID).toEqual(projectInstances[1].elemID)
      expect(secondContextInstance.value[PROJECT_IDS][2]).toBeInstanceOf(ReferenceExpression)
      expect(secondContextInstance.value[PROJECT_IDS][2].resValue.elemID).toEqual(projectInstances[2].elemID)
    })
  })
})
