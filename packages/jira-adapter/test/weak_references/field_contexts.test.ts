/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { JIRA, PROJECT_TYPE } from '../../src/constants'
import { fieldContextsHandler } from '../../src/weak_references/field_contexts'
import { createEmptyType, createMockElementsSource } from '../utils'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../src/filters/fields/constants'

describe('field_contexts', () => {
  let projectInstance: InstanceElement
  let contextInstance: InstanceElement
  let instance: InstanceElement
  let instance2: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  const AdapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)

  beforeEach(() => {
    projectInstance = new InstanceElement('proj1', createEmptyType(PROJECT_TYPE))
    contextInstance = new InstanceElement('context1', createEmptyType(FIELD_CONTEXT_TYPE_NAME))
    elementsSource = createMockElementsSource([projectInstance, contextInstance])
    const fieldType = createEmptyType(FIELD_TYPE_NAME)
    instance = new InstanceElement('inst', fieldType, {
      contexts: [
        'context1',
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context1')),
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context2')),
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context3')),
        'software',
      ],
    })
    instance2 = new InstanceElement('inst2', fieldType, {
      contexts: [
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context4')),
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context1')),
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context5')),
      ],
    })
  })
  describe('findWeakReferences', () => {
    it('should return weak references contexts', async () => {
      const references = await fieldContextsHandler.findWeakReferences([instance, instance2], adapterConfig)

      expect(references).toEqual([
        { source: instance.elemID.createNestedID('contexts', '1'), target: contextInstance.elemID, type: 'weak' },
        {
          source: instance.elemID.createNestedID('contexts', '2'),
          target: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context2'),
          type: 'weak',
        },
        {
          source: instance.elemID.createNestedID('contexts', '3'),
          target: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context3'),
          type: 'weak',
        },
        {
          source: instance2.elemID.createNestedID('contexts', '0'),
          target: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context4'),
          type: 'weak',
        },
        {
          source: instance2.elemID.createNestedID('contexts', '1'),
          target: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context1'),
          type: 'weak',
        },
        {
          source: instance2.elemID.createNestedID('contexts', '2'),
          target: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context5'),
          type: 'weak',
        },
      ])
    })
    it('should do nothing if received invalid contexts', async () => {
      instance.value.contexts = 'invalid'
      const references = await fieldContextsHandler.findWeakReferences([instance], adapterConfig)
      expect(references).toEqual([])
    })
    it('should do nothing if there are no contexts', async () => {
      delete instance.value.contexts
      const references = await fieldContextsHandler.findWeakReferences([instance], adapterConfig)
      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    let contextInstanceAllInvalid: InstanceElement
    let contextInstanceSomeValid: InstanceElement
    beforeEach(() => {
      contextInstanceAllInvalid = new InstanceElement('context2', createEmptyType(FIELD_CONTEXT_TYPE_NAME), {
        projectIds: [
          new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2')),
          new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj3')),
        ],
      })
      contextInstanceSomeValid = new InstanceElement('context3', createEmptyType(FIELD_CONTEXT_TYPE_NAME), {
        projectIds: [
          new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')),
          new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2')),
        ],
      })
      elementsSource = createMockElementsSource([
        projectInstance,
        contextInstance,
        contextInstanceAllInvalid,
        contextInstanceSomeValid,
      ])
    })
    it('should remove the invalid context', async () => {
      const fixes = await fieldContextsHandler.removeWeakReferences({ elementsSource })([instance, instance2])
      expect(fixes.errors).toEqual([
        {
          elemID: instance.elemID.createNestedID('contexts'),
          severity: 'Info',
          message: 'Deploying field without all attached contexts',
          detailedMessage:
            'This field contains contexts that do not reference any projects existing in the target environment. It will be deployed without referencing these contexts.',
        },
        {
          elemID: instance2.elemID.createNestedID('contexts'),
          severity: 'Info',
          message: 'Deploying field without all attached contexts',
          detailedMessage:
            'This field contains contexts that do not reference any projects existing in the target environment. It will be deployed without referencing these contexts.',
        },
      ])
      expect(fixes.fixedElements).toHaveLength(2)
      expect((fixes.fixedElements[0] as InstanceElement).value.contexts).toEqual([
        'context1',
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context1')),
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context3')),
        'software',
      ])
      expect((fixes.fixedElements[1] as InstanceElement).value.contexts).toEqual([
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context1')),
      ])
    })
    it('should do nothing if received invalid contexts', async () => {
      instance.value.contexts = 'invalid'
      const fixes = await fieldContextsHandler.removeWeakReferences({ elementsSource })([instance])
      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
    it('should do nothing if there are no contexts', async () => {
      delete instance.value.contexts
      const fixes = await fieldContextsHandler.removeWeakReferences({ elementsSource })([instance])
      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
    it('should do nothing if all contexts are valid', async () => {
      instance.value.contexts = [
        new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'context1')),
      ]
      const fixes = await fieldContextsHandler.removeWeakReferences({ elementsSource })([instance])
      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
