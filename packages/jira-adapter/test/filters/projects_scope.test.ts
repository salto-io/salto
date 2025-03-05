/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'

import _ from 'lodash'
import { FilterResult } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { AUTOMATION_TYPE, BOARD_TYPE_NAME, FIELD_TYPE, PROJECT_TYPE } from '../../src/constants'
import projectScopeFilter from '../../src/filters/projects_scope'
import { createEmptyType, getFilterParams } from '../utils'
import { FIELD_CONTEXT_TYPE_NAME } from '../../src/filters/fields/constants'

describe('projectsScopeFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch', FilterResult>
  let config: JiraConfig
  let generalType: ObjectType
  let projectType: ObjectType

  let project1: InstanceElement
  let project2: InstanceElement
  let elements: InstanceElement[]

  beforeEach(() => {
    jest.clearAllMocks()
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableProjectsScope = true
    filter = projectScopeFilter(
      getFilterParams({
        config,
      }),
    ) as typeof filter
    projectType = createEmptyType(PROJECT_TYPE)
    generalType = createEmptyType('general')
    project1 = new InstanceElement('project1', projectType, {
      key: 'project1Key',
    })
    project2 = new InstanceElement('project2', projectType, {
      key: 'project2Key',
    })
  })

  describe('enableProjectScope config flag', () => {
    let objectType: ObjectType
    let instance: InstanceElement
    beforeEach(() => {
      config.fetch.enableProjectsScope = false
      objectType = createEmptyType('objectType')
      instance = new InstanceElement('instance', objectType)
      project1.value = {
        ...project1.value,
        field: new ReferenceExpression(instance.elemID, instance),
      }
    })
    it('should not add projectsScope field to object types', async () => {
      await filter.onFetch([project1, project2, objectType, instance])
      expect(objectType.fields.projectsScope).toBeUndefined()
    })

    it('should not add projectsScope to important values annotation', async () => {
      await filter.onFetch([project1, project2, objectType, instance])
      expect(objectType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toBeUndefined()
    })

    it('should not add projectsScope to instance', async () => {
      await filter.onFetch([project1, project2, objectType, instance])
      expect(instance.value.projectsScope).toBeUndefined()
    })
  })

  describe('object types', () => {
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

    it('should not add projectsScope to important values annotation if it already exists', async () => {
      objectType1.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = [
        { value: 'projectsScope', highlighted: false, indexed: true },
      ]
      await filter.onFetch([instance1, objectType1])
      expect(objectType1.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]).toEqual([
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

  describe('references from projects', () => {
    let project1Ref11: InstanceElement
    let project1Ref12: InstanceElement
    let project1Ref13: InstanceElement
    let project1Ref21: InstanceElement
    let project1Ref22: InstanceElement
    let project1Ref31: InstanceElement

    let project2Ref11: InstanceElement
    let project2Ref12: InstanceElement
    let project2Ref21: InstanceElement
    let project2Ref22: InstanceElement
    let bothProjectsRef: InstanceElement

    beforeEach(() => {
      bothProjectsRef = new InstanceElement('bothProjectsRef', generalType)
      // project1 => project1Ref11 => project1Ref21 => project1Ref31
      project1Ref31 = new InstanceElement('project1Ref31', generalType)
      project1Ref21 = new InstanceElement('project1Ref21', generalType, {
        field: new ReferenceExpression(project1Ref31.elemID, project1Ref31),
      })
      project1Ref11 = new InstanceElement('project1Ref11', generalType, {
        field: new ReferenceExpression(project1Ref21.elemID, project1Ref21),
      })
      // Project1 => project1Ref12 => project1Ref22
      project1Ref22 = new InstanceElement('project1Ref22', generalType)
      project1Ref12 = new InstanceElement('project1Ref12', generalType, {
        field: new ReferenceExpression(project1Ref22.elemID, project1Ref22),
      })
      project1Ref13 = new InstanceElement('project1Ref13', generalType)
      // Project1 => project1Ref13
      project1 = new InstanceElement('project1', projectType, {
        key: 'project1Key',
        field1: new ReferenceExpression(project1Ref11.elemID, project1Ref11),
        field2: new ReferenceExpression(project1Ref12.elemID, project1Ref12),
        field3: new ReferenceExpression(project1Ref13.elemID, project1Ref13),
        field4: new ReferenceExpression(bothProjectsRef.elemID, bothProjectsRef),
      })

      // project2Ref11 => project2Ref21
      project2Ref21 = new InstanceElement('project2Ref21', generalType)
      project2Ref11 = new InstanceElement('project2Ref11', generalType, {
        field: new ReferenceExpression(project2Ref21.elemID, project2Ref21),
      })
      project2Ref22 = new InstanceElement('project2Ref22', generalType)
      project2Ref12 = new InstanceElement('project2Ref12', generalType, {
        field: new ReferenceExpression(project2Ref22.elemID, project2Ref22),
      })
      // Project2 => [project2Ref11, project2Ref12]
      // project2 => {project2Ref12} => project2Ref2
      project2 = new InstanceElement('project2', projectType, {
        key: 'project2Key',
        objectField: {
          field: new ReferenceExpression(project2Ref12.elemID, project2Ref12),
        },
        arrayField: [
          new ReferenceExpression(project2Ref11.elemID, project2Ref11),
          new ReferenceExpression(project2Ref12.elemID, project2Ref12),
        ],
        field: new ReferenceExpression(bothProjectsRef.elemID, bothProjectsRef),
      })
    })

    it('should add projectsScope recursively for references from projects', async () => {
      elements = [
        project1,
        // project1 references
        project1Ref11,
        project1Ref12,
        project1Ref13,
        project1Ref21,
        project1Ref22,
        project1Ref31,
        project2,
        // project2 references
        project2Ref11,
        project2Ref12,
        project2Ref21,
        project2Ref22,
        // both projects reference
        bothProjectsRef,
      ]
      await filter.onFetch(elements)
      expect(elements.length).toBe(13)
      const project1RefInstances = elements.slice(0, 7)
      project1RefInstances.forEach(instance => {
        expect(instance.value.projectsScope).toEqual(['project1Key'])
      })
      const project2RefInstances = elements.slice(7, 12)
      project2RefInstances.forEach(instance => {
        expect(instance.value.projectsScope).toEqual(['project2Key'])
      })
      expect(elements[12].value.projectsScope).toEqual(['project1Key', 'project2Key'])
    })

    it('should not add projectsScope for unrelated instances', async () => {
      const unrelatedInstance = new InstanceElement('unrelatedInstance', generalType)
      await filter.onFetch([project1, project2, unrelatedInstance])
      expect(unrelatedInstance.value.projectsScope).toBeUndefined()
    })

    it('should not add other projects to projectsScope', async () => {
      const otherProject = new InstanceElement('otherProject', projectType, {
        key: 'otherProjectKey',
      })
      project1.value = {
        ...project1.value,
        field: new ReferenceExpression(otherProject.elemID, otherProject),
      }
      await filter.onFetch([project1, otherProject])
      expect(otherProject.value.projectsScope).toEqual(['otherProjectKey'])
      expect(project1.value.projectsScope).toEqual(['project1Key'])
    })
  })

  describe('project children', () => {
    let project1Child1: InstanceElement
    let project1Child2: InstanceElement

    let project2Child1: InstanceElement
    let project2Child2: InstanceElement

    beforeEach(() => {
      // project1 <= project1Child1 <= project1Child2
      project1Child1 = new InstanceElement('project1Child11', generalType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(project1.elemID, project1)],
      })
      project1Child2 = new InstanceElement('project1Child12', generalType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(project1Child1.elemID, project1Child1)],
      })

      // project2 <= project2Child1 <= project2Child2
      project2Child1 = new InstanceElement('project2Child11', generalType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(project2.elemID, project2)],
      })
      project2Child2 = new InstanceElement('project2Child12', generalType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(project2Child1.elemID, project2Child1)],
      })
    })

    it('should add projectsScope recursively for project children', async () => {
      elements = [project1, project1Child1, project1Child2, project2, project2Child1, project2Child2]
      await filter.onFetch(elements)
      expect(elements.length).toBe(6)

      expect(project1.value.projectsScope).toEqual(['project1Key'])
      expect(project1Child1.value.projectsScope).toEqual(['project1Key'])
      expect(project1Child2.value.projectsScope).toEqual(['project1Key'])

      expect(project2.value.projectsScope).toEqual(['project2Key'])
      expect(project2Child1.value.projectsScope).toEqual(['project2Key'])
      expect(project2Child2.value.projectsScope).toEqual(['project2Key'])
    })

    it('should not add projectsScope for unrelated instances', async () => {
      const unrelatedInstance = new InstanceElement('unrelatedInstance', generalType)
      await filter.onFetch([project1, project2, unrelatedInstance])
      expect(unrelatedInstance.value.projectsScope).toBeUndefined()
    })
  })

  describe('boards', () => {
    let boardType: ObjectType
    let board1: InstanceElement
    let board2: InstanceElement
    let unrelatedBoard: InstanceElement

    beforeEach(() => {
      boardType = createEmptyType(BOARD_TYPE_NAME)
      board1 = new InstanceElement('board1', boardType, {
        location: {
          projectId: new ReferenceExpression(project1.elemID, project1),
        },
      })
      board2 = new InstanceElement('board2', boardType, {
        location: {
          projectId: new ReferenceExpression(project2.elemID, project2),
        },
      })
      unrelatedBoard = new InstanceElement('unrelatedBoard', boardType, {
        location: {
          projectId: 'not a project reference',
        },
      })
    })

    it('should add projectsScope for boards', async () => {
      await filter.onFetch([project1, project2, board1, board2])
      expect(board1.value.projectsScope).toEqual(['project1Key'])
      expect(board2.value.projectsScope).toEqual(['project2Key'])
    })

    it('should not add projectsScope for unrelated boards', async () => {
      await filter.onFetch([project1, project2, unrelatedBoard])
      expect(unrelatedBoard.value.projectsScope).toBeUndefined()
    })
  })

  describe('automations', () => {
    let automationType: ObjectType
    let automation1: InstanceElement
    let automation2: InstanceElement
    let automation3: InstanceElement
    let unrelatedAutomation: InstanceElement

    beforeEach(() => {
      automationType = createEmptyType(AUTOMATION_TYPE)
      automation1 = new InstanceElement('automation1', automationType, {
        projects: [{ projectId: new ReferenceExpression(project1.elemID, project1) }],
      })
      automation2 = new InstanceElement('automation2', automationType, {
        projects: [{ projectId: new ReferenceExpression(project2.elemID, project2) }],
      })
      automation3 = new InstanceElement('automation3', automationType, {
        projects: [
          { projectId: new ReferenceExpression(project1.elemID, project1) },
          { projectId: new ReferenceExpression(project2.elemID, project2) },
        ],
      })
      unrelatedAutomation = new InstanceElement('unrelatedAutomation', automationType, {
        projects: [{ projectId: 'not a project reference' }],
      })
    })

    it('should add projectsScope for automations', async () => {
      await filter.onFetch([project1, project2, automation1, automation2, automation3])
      expect(automation1.value.projectsScope).toEqual(['project1Key'])
      expect(automation2.value.projectsScope).toEqual(['project2Key'])
      expect(automation3.value.projectsScope).toEqual(['project1Key', 'project2Key'])
    })

    it('should not add projectsScope for unrelated automations', async () => {
      await filter.onFetch([project1, project2, unrelatedAutomation])
      expect(unrelatedAutomation.value.projectsScope).toBeUndefined()
    })
  })

  describe('contexts', () => {
    let contextType: ObjectType
    let context1: InstanceElement
    let context2: InstanceElement
    let context3: InstanceElement
    let unrelatedContext: InstanceElement

    beforeEach(() => {
      contextType = createEmptyType(FIELD_CONTEXT_TYPE_NAME)
      context1 = new InstanceElement('context1', contextType, {
        projectIds: [new ReferenceExpression(project1.elemID, project1)],
      })
      context2 = new InstanceElement('context2', contextType, {
        projectIds: [new ReferenceExpression(project2.elemID, project2)],
      })
      context3 = new InstanceElement('context3', contextType, {
        projectIds: [
          new ReferenceExpression(project1.elemID, project1),
          new ReferenceExpression(project2.elemID, project2),
        ],
      })
      unrelatedContext = new InstanceElement('unrelatedContext', contextType)
    })

    it('should add projectsScope for contexts', async () => {
      await filter.onFetch([project1, project2, context1, context2, context3])
      expect(context1.value.projectsScope).toEqual(['project1Key'])
      expect(context2.value.projectsScope).toEqual(['project2Key'])
      expect(context3.value.projectsScope).toEqual(['project1Key', 'project2Key'])
    })

    it('should not add projectsScope for unrelated contexts', async () => {
      await filter.onFetch([project1, project2, unrelatedContext])
      expect(unrelatedContext.value.projectsScope).toBeUndefined()
    })

    it('should add global context to projectsScope', async () => {
      const globalContextInstance = new InstanceElement('context', contextType)
      const fieldInstance = new InstanceElement('field', createEmptyType(FIELD_TYPE), {
        contexts: [new ReferenceExpression(globalContextInstance.elemID, globalContextInstance)],
      })
      project1.value = {
        ...project1.value,
        field: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      }
      await filter.onFetch([project1, fieldInstance, globalContextInstance])
      expect(project1.value.projectsScope).toEqual(['project1Key'])
      expect(fieldInstance.value.projectsScope).toEqual(['project1Key'])
      expect(globalContextInstance.value.projectsScope).toEqual(['project1Key'])
    })

    it('should not add unrelated global context to projectsScope', async () => {
      const globalContextInstance = new InstanceElement('context', contextType)
      const fieldInstance = new InstanceElement('field', createEmptyType(FIELD_TYPE), {
        contexts: [new ReferenceExpression(globalContextInstance.elemID, globalContextInstance)],
      })
      await filter.onFetch([project1, fieldInstance, globalContextInstance])
      expect(project1.value.projectsScope).toEqual(['project1Key'])
      expect(fieldInstance.value.projectsScope).toBeUndefined()
      expect(globalContextInstance.value.projectsScope).toBeUndefined()
    })

    it('should not add unrelated context to projectsScope', async () => {
      const contextInstance = new InstanceElement('context', contextType, {
        projectIds: [new ReferenceExpression(project2.elemID, project2)],
      })
      const fieldInstance = new InstanceElement('field', createEmptyType(FIELD_TYPE), {
        contexts: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
      })
      project1.value = {
        ...project1.value,
        field: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      }
      await filter.onFetch([project1, fieldInstance, contextInstance])
      expect(project1.value.projectsScope).toEqual(['project1Key'])
      expect(fieldInstance.value.projectsScope).toEqual(['project1Key'])
      expect(contextInstance.value.projectsScope).toBeUndefined()
    })
  })
})
