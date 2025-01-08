/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ElemID, ReferenceExpression, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'
import { emptyProjectScopedContextValidator } from '../../../src/change_validators/field_contexts/empty_project_scoped_context'
import { createEmptyType, createMockElementsSource } from '../../utils'

describe('empty_project_scoped_context', () => {
  let instance: InstanceElement
  let instance2: InstanceElement
  let instance3: InstanceElement
  let projectInstance: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  beforeEach(() => {
    projectInstance = new InstanceElement('proj1', createEmptyType('Project'))
    elementsSource = createMockElementsSource([projectInstance])
    const contextType = createEmptyType(FIELD_CONTEXT_TYPE_NAME)
    instance = new InstanceElement('inst1', contextType, {
      projectIds: [
        new ReferenceExpression(new ElemID('jira', 'Project', 'instance', 'proj2')),
        new ReferenceExpression(new ElemID('jira', 'Project', 'instance', 'proj3')),
      ],
    })
    instance2 = new InstanceElement('inst2', contextType, {
      projectIds: [
        new ReferenceExpression(new ElemID('jira', 'Project', 'instance', 'proj4')),
        new ReferenceExpression(new ElemID('jira', 'Project', 'instance', 'proj1')),
        new ReferenceExpression(new ElemID('jira', 'Project', 'instance', 'proj5')),
      ],
    })
    instance3 = new InstanceElement('inst3', contextType, {
      projectIds: [
        new ReferenceExpression(new ElemID('jira', 'Project', 'instance', 'proj4')),
        new ReferenceExpression(new ElemID('jira', 'Project', 'instance', 'proj5')),
      ],
    })
  })

  describe('validate', () => {
    it('should return an error for empty project scoped context', async () => {
      const errors = await emptyProjectScopedContextValidator(
        [toChange({ after: instance }), toChange({ after: instance2 }), toChange({ after: instance3 })],
        elementsSource,
      )
      expect(errors).toHaveLength(2)
      expect(errors[0].message).toEqual(
        'Project-scoped context must have at least one project in the target environment',
      )
      expect(errors[0].detailedMessage).toEqual(
        'This context is attached to projects that do not exist in the target environment. It cannot be deployed without referencing at least one project in the target environment.',
      )
      expect(errors[0].elemID.getFullName()).toEqual('jira.CustomFieldContext.instance.inst1')
      expect(errors[0].severity).toEqual('Error')

      expect(errors[1].message).toEqual(
        'Project-scoped context must have at least one project in the target environment',
      )
      expect(errors[1].detailedMessage).toEqual(
        'This context is attached to projects that do not exist in the target environment. It cannot be deployed without referencing at least one project in the target environment.',
      )
      expect(errors[1].elemID.getFullName()).toEqual('jira.CustomFieldContext.instance.inst3')
      expect(errors[1].severity).toEqual('Error')
    })

    it('should not return an error for non empty project scoped context', async () => {
      const errors = await emptyProjectScopedContextValidator([toChange({ after: instance2 })], elementsSource)
      expect(errors).toHaveLength(0)
    })
    it('should not return an error for global context', async () => {
      instance2.value.projectIds = []
      const errors = await emptyProjectScopedContextValidator([toChange({ after: instance2 })], elementsSource)
      expect(errors).toHaveLength(0)
    })
    it('should not return an error when no elements source is provided', async () => {
      const errors = await emptyProjectScopedContextValidator([toChange({ after: instance })], undefined)
      expect(errors).toHaveLength(0)
    })
  })
})
