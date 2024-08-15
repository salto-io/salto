/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE, JIRA, PROJECT_TYPE } from '../../src/constants'
import { automationProjectsHandler } from '../../src/weak_references/automation_projects'

describe('automation_projects', () => {
  let projectInstance: InstanceElement
  let instance: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  const AdapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)

  beforeEach(() => {
    projectInstance = new InstanceElement('proj1', new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) }))

    elementsSource = buildElementsSourceFromElements([projectInstance])

    instance = new InstanceElement('inst', new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) }), {
      projects: [
        { projectId: 'proj1' },
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')) },
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2')) },
        { projectType: 'software' },
      ],
    })
  })
  describe('findWeakReferences', () => {
    it('should return weak references projects', async () => {
      const references = await automationProjectsHandler.findWeakReferences([instance], adapterConfig)

      expect(references).toEqual([
        { source: instance.elemID.createNestedID('1', 'projectId'), target: projectInstance.elemID, type: 'weak' },
        {
          source: instance.elemID.createNestedID('2', 'projectId'),
          target: new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj2'),
          type: 'weak',
        },
      ])
    })

    it('should do nothing if received invalid automation', async () => {
      instance.value.projects = 'invalid'
      const references = await automationProjectsHandler.findWeakReferences([instance], adapterConfig)

      expect(references).toEqual([])
    })

    it('should do nothing if there are no projects', async () => {
      delete instance.value.projects
      const references = await automationProjectsHandler.findWeakReferences([instance], adapterConfig)

      expect(references).toEqual([])
    })
  })

  describe('removeWeakReferences', () => {
    it('should remove the invalid projects', async () => {
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([
        {
          elemID: instance.elemID.createNestedID('projects'),
          severity: 'Info',
          message: 'Deploying automation without all attached projects',
          detailedMessage:
            'This automation is attached to some projects that do not exist in the target environment. It will be deployed without referencing these projects.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      expect((fixes.fixedElements[0] as InstanceElement).value.projects).toEqual([
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')) },
        { projectType: 'software' },
      ])
    })

    it('should do nothing if received invalid automation', async () => {
      instance.value.projects = 'invalid'
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if there are no projects', async () => {
      delete instance.value.projects
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if all projects are valid', async () => {
      instance.value.projects = [
        { projectId: new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'proj1')) },
        { projectType: 'software' },
      ]
      const fixes = await automationProjectsHandler.removeWeakReferences({ elementsSource })([instance])

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
