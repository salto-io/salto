/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  toChange,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { JIRA } from '../../../src/constants'
import { fieldSecondContextValidator } from '../../../src/change_validators/field_contexts/second_global_context'
import { createEmptyType, createMockElementsSource } from '../../utils'

const mockLogError = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn().mockReturnValue({
    error: jest.fn((...args) => mockLogError(...args)),
  }),
}))

describe('Field second global contexts', () => {
  let contextType: ObjectType
  let fieldType: ObjectType
  let elements: InstanceElement[]
  let projectScopeContext1a: InstanceElement
  let projectScopeContext2a: InstanceElement
  let projectScopeContext3a: InstanceElement
  let projectScopeContext3b: InstanceElement
  let globalContext1a: InstanceElement
  let globalContext2a: InstanceElement
  let globalContext3a: InstanceElement
  let fieldInstance: InstanceElement
  let fieldInstance2: InstanceElement
  let fieldInstance3: InstanceElement

  const createGlobalContext = (name: string, parent: InstanceElement): InstanceElement =>
    new InstanceElement(name, contextType, {}, undefined, { _parent: [new ReferenceExpression(parent.elemID, parent)] })
  const createProjectContext = (name: string, parent: InstanceElement): InstanceElement =>
    new InstanceElement(
      name,
      contextType,
      {
        projectIds: ['projAA', 'projBB'],
      },
      undefined,
      { _parent: [new ReferenceExpression(parent.elemID, parent)] },
    )
  beforeEach(() => {
    jest.clearAllMocks()
    contextType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME) })
    fieldType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) })
    fieldInstance = new InstanceElement('field_name', fieldType)
    fieldInstance2 = new InstanceElement('field_name2', fieldType)
    fieldInstance3 = new InstanceElement('field_name3', fieldType)

    projectScopeContext1a = createProjectContext('proj1', fieldInstance)
    projectScopeContext2a = createProjectContext('proj2', fieldInstance2)
    projectScopeContext3a = createProjectContext('proj3a', fieldInstance3)
    projectScopeContext3b = createProjectContext('proj3b', fieldInstance3)
    globalContext1a = createGlobalContext('global1', fieldInstance)
    globalContext2a = createGlobalContext('global2', fieldInstance2)
    globalContext3a = createGlobalContext('global3', fieldInstance3)
    elements = [
      fieldInstance,
      fieldInstance2,
      fieldInstance3,
      globalContext1a,
      globalContext2a,
      globalContext3a,
      projectScopeContext1a,
      projectScopeContext2a,
      projectScopeContext3a,
      projectScopeContext3b,
    ]
  })

  it('should not return error when setting one global context to the field', async () => {
    expect(
      await fieldSecondContextValidator([toChange({ after: globalContext1a })], createMockElementsSource(elements)),
    ).toEqual([])
  })
  it('should not return changes when its not global context change', async () => {
    expect(
      await fieldSecondContextValidator(
        [toChange({ after: projectScopeContext3a })],
        createMockElementsSource(elements),
      ),
    ).toEqual([])
  })
  it('should log error if elementSource is undefined', async () => {
    const addedGlobalContext1 = toChange({ after: createGlobalContext('global4', fieldInstance) })
    expect(await fieldSecondContextValidator([addedGlobalContext1])).toEqual([])
    expect(mockLogError).toHaveBeenCalledWith(
      'Failed to run fieldSecondContextValidator because element source is undefined',
    )
  })
  it('should return error when setting two global contexts to a field', async () => {
    const addedGlobalInstance1 = createGlobalContext('global2b', fieldInstance2)
    elements.push(addedGlobalInstance1)
    expect(
      await fieldSecondContextValidator(
        [toChange({ after: addedGlobalInstance1 })],
        createMockElementsSource(elements),
      ),
    ).toEqual([
      {
        elemID: addedGlobalInstance1.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage:
          "Can't deploy this global context because the deployment will result in more than a single global context for field field_name2.",
      },
    ])
  })
  it('should return error when setting two global contexts to a field with alias', async () => {
    fieldInstance.annotations[CORE_ANNOTATIONS.ALIAS] = 'beautiful name'
    const addedGlobalInstance1 = createGlobalContext('global1b', fieldInstance)
    elements.push(addedGlobalInstance1)
    expect(
      await fieldSecondContextValidator(
        [toChange({ after: addedGlobalInstance1 })],
        createMockElementsSource(elements),
      ),
    ).toEqual([
      {
        elemID: addedGlobalInstance1.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage:
          "Can't deploy this global context because the deployment will result in more than a single global context for field beautiful name.",
      },
    ])
  })
  it('should return error when adding two global contexts to a field without global context', async () => {
    const addedGlobalContext1 = createGlobalContext('global2b', fieldInstance2)
    elements.push(addedGlobalContext1)
    expect(
      await fieldSecondContextValidator(
        [toChange({ after: addedGlobalContext1 }), toChange({ after: globalContext1a })],
        createMockElementsSource(elements),
      ),
    ).toEqual([
      {
        elemID: addedGlobalContext1.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage:
          "Can't deploy this global context because the deployment will result in more than a single global context for field field_name2.",
      },
    ])
  })
  it('should return an error when modifying a context to become a second global', async () => {
    const preModifiedGlobalContext = projectScopeContext1a.clone()
    delete projectScopeContext1a.value.projectIds
    expect(
      await fieldSecondContextValidator(
        [toChange({ before: preModifiedGlobalContext, after: projectScopeContext1a })],
        createMockElementsSource(elements),
      ),
    ).toEqual([
      {
        elemID: preModifiedGlobalContext.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage:
          "Can't deploy this global context because the deployment will result in more than a single global context for field field_name.",
      },
    ])
  })
  it('should return the correct errors for multiple changes', async () => {
    const addedGlobalContext1b = createGlobalContext('global1b', fieldInstance)
    const addedGlobalContext1c = createGlobalContext('global1c', fieldInstance)
    const addedGlobalContext2b = createGlobalContext('global2b', fieldInstance2)

    const modifiedContext2c = createProjectContext('proj2c', fieldInstance2)
    const postContext2c = modifiedContext2c.clone()
    delete postContext2c.value.projectIds
    const modifiedContext3c = createProjectContext('proj3c', fieldInstance3)
    const postContext3c = modifiedContext3c.clone()
    delete postContext3c.value.projectIds
    const modifiedContext3d = createProjectContext('proj3d', fieldInstance3)
    const postContext3d = modifiedContext3d.clone()
    delete postContext3d.value.projectIds
    elements.push(
      addedGlobalContext1b,
      addedGlobalContext1c,
      addedGlobalContext2b,
      postContext2c,
      postContext3c,
      postContext3d,
    )
    const changes = [
      toChange({ after: addedGlobalContext1b }),
      toChange({ after: addedGlobalContext1c }),
      toChange({ after: addedGlobalContext2b }),
      toChange({ before: modifiedContext2c, after: postContext2c }),
      toChange({ before: modifiedContext3c, after: postContext3c }),
      toChange({ before: modifiedContext3d, after: postContext3d }),
    ]
    const results = await fieldSecondContextValidator(changes, createMockElementsSource(elements))
    expect(results).toHaveLength(6)
    expect(results[0]).toEqual({
      elemID: addedGlobalContext1b.elemID,
      severity: 'Error',
      message: 'A field can only have a single global context',
      detailedMessage:
        "Can't deploy this global context because the deployment will result in more than a single global context for field field_name.",
    })
    expect(results[1]).toEqual({
      elemID: addedGlobalContext1c.elemID,
      severity: 'Error',
      message: 'A field can only have a single global context',
      detailedMessage:
        "Can't deploy this global context because the deployment will result in more than a single global context for field field_name.",
    })
    expect(results[2]).toEqual({
      elemID: addedGlobalContext2b.elemID,
      severity: 'Error',
      message: 'A field can only have a single global context',
      detailedMessage:
        "Can't deploy this global context because the deployment will result in more than a single global context for field field_name2.",
    })
    expect(results[3]).toEqual({
      elemID: modifiedContext2c.elemID,
      severity: 'Error',
      message: 'A field can only have a single global context',
      detailedMessage:
        "Can't deploy this global context because the deployment will result in more than a single global context for field field_name2.",
    })
    expect(results[4]).toEqual({
      elemID: modifiedContext3c.elemID,
      severity: 'Error',
      message: 'A field can only have a single global context',
      detailedMessage:
        "Can't deploy this global context because the deployment will result in more than a single global context for field field_name3.",
    })
    expect(results[5]).toEqual({
      elemID: modifiedContext3d.elemID,
      severity: 'Error',
      message: 'A field can only have a single global context',
      detailedMessage:
        "Can't deploy this global context because the deployment will result in more than a single global context for field field_name3.",
    })
  })
  it('should treat a context as global when it has empty projectIds', async () => {
    const addedGlobalContext = createGlobalContext('global4', fieldInstance)
    addedGlobalContext.value.projectIds = []
    elements.push(addedGlobalContext)
    expect(
      await fieldSecondContextValidator([toChange({ after: addedGlobalContext })], createMockElementsSource(elements)),
    ).toEqual([
      {
        elemID: addedGlobalContext.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage:
          "Can't deploy this global context because the deployment will result in more than a single global context for field field_name.",
      },
    ])
  })
  it('should not return an error when there are no relevant changes', async () => {
    expect(
      await fieldSecondContextValidator(
        [toChange({ after: new InstanceElement('not_context', createEmptyType('Other')) })],
        createMockElementsSource(elements),
      ),
    ).toEqual([])
  })
})
