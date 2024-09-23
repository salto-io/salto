/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA, PROJECT_TYPE } from '../../src/constants'
import { contextProjectsHandler } from '../../src/weak_references/context_projects'
import { createEmptyType } from '../utils'
import { FIELD_CONTEXT_TYPE_NAME } from '../../src/filters/fields/constants'

describe('context_projects', () => {
  let projectInstance: InstanceElement
  let instance: InstanceElement
  let instance2: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  const AdapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)

  beforeEach(() => {
    projectInstance = new InstanceElement('proj1', new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) }))

    elementsSource = buildElementsSourceFromElements([projectInstance])
    const contextType = createEmptyType(FIELD_CONTEXT_TYPE_NAME)
    instance = new InstanceElement('inst', contextType, {
      projectIds: [
        'proj1',
        new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')),
        new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2')),
        new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj3')),
        'software',
      ],
    })
    instance2 = new InstanceElement('inst2', contextType, {
      projectIds: [
        new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj4')),
        new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')),
        new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj5')),
      ],
    })
  })
  describe('findWeakReferences', () => {
    it('should return weak references projects', async () => {
      const references = await contextProjectsHandler.findWeakReferences([instance, instance2], adapterConfig)

      expect(references).toEqual([
        { source: instance.elemID.createNestedID('projectIds', '1'), target: projectInstance.elemID, type: 'weak' },
        {
          source: instance.elemID.createNestedID('projectIds', '2'),
          target: new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2'),
          type: 'weak',
        },
        {
          source: instance.elemID.createNestedID('projectIds', '3'),
          target: new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj3'),
          type: 'weak',
        },
        {
          source: instance2.elemID.createNestedID('projectIds', '0'),
          target: new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj4'),
          type: 'weak',
        },
        {
          source: instance2.elemID.createNestedID('projectIds', '1'),
          target: new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1'),
          type: 'weak',
        },
        {
          source: instance2.elemID.createNestedID('projectIds', '2'),
          target: new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj5'),
          type: 'weak',
        },
      ])
    })

    it('should do nothing if received invalid automation', async () => {
      instance.value.projectIds = 'invalid'
      const references = await contextProjectsHandler.findWeakReferences([instance], adapterConfig)

      expect(references).toEqual([])
    })

    it('should do nothing if there are no projects', async () => {
      delete instance.value.projectIds
      const references = await contextProjectsHandler.findWeakReferences([instance], adapterConfig)

      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    it('should remove the invalid projects', async () => {
      const fixes = await contextProjectsHandler.removeWeakReferences({ elementsSource })([instance, instance2])
      expect(fixes.errors).toEqual([
        {
          elemID: instance.elemID.createNestedID('projectIds'),
          severity: 'Info',
          message: 'Deploying context without all attached projects',
          detailedMessage:
            'This context is attached to some projects that do not exist in the target environment. It will be deployed without referencing these projects.',
        },
        {
          elemID: instance2.elemID.createNestedID('projectIds'),
          severity: 'Info',
          message: 'Deploying context without all attached projects',
          detailedMessage:
            'This context is attached to some projects that do not exist in the target environment. It will be deployed without referencing these projects.',
        },
      ])
      expect(fixes.fixedElements).toHaveLength(2)
      expect((fixes.fixedElements[0] as InstanceElement).value.projectIds).toEqual([
        'proj1',
        new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')),
        'software',
      ])
    })
    it('should warn if all projects are removed', async () => {
      instance.value.projectIds = [new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2'))]
      const fixes = await contextProjectsHandler.removeWeakReferences({ elementsSource })([instance])
      expect(fixes.errors).toEqual([
        {
          elemID: instance.elemID.createNestedID('projectIds'),
          severity: 'Warning',
          message: 'Deploying project scoped context as global context',
          detailedMessage:
            'This context is attached to projects that do not exist in the target environment. It will be deployed as a global context.',
        },
      ])
      expect((fixes.fixedElements[0] as InstanceElement).value.projectIds).toEqual([])
    })
    it('should do nothing if received invalid contexts', async () => {
      instance.value.projectIds = 'invalid'
      const fixes = await contextProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
    it('should do nothing if there are no projects', async () => {
      delete instance.value.projectIds
      const fixes = await contextProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
    it('should do nothing if all projects are valid', async () => {
      instance.value.projectIds = [new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1'))]
      const fixes = await contextProjectsHandler.removeWeakReferences({ elementsSource })([instance])
      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
