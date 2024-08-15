/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, InstanceElement } from '@salto-io/adapter-api'
import { createEmptyType } from '../../utils'
import { projectAssigneeTypeValidator } from '../../../src/change_validators/projects/project_assignee_type'
import { ASSIGNEE_TYPE_FIELD } from '../../../src/constants'

describe('projectAssigneeTypeValidator', () => {
  const projectType = createEmptyType('Project')
  let projectInstance: InstanceElement

  beforeEach(() => {
    projectInstance = new InstanceElement('project', projectType, {})
  })
  it('should not return errors for valid assignee type', async () => {
    projectInstance.value[ASSIGNEE_TYPE_FIELD] = 'PROJECT_LEAD'
    const changeErrors = await projectAssigneeTypeValidator([toChange({ after: projectInstance })])
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return errors for undefined assignee type', async () => {
    const changeErrors = await projectAssigneeTypeValidator([toChange({ after: projectInstance })])
    expect(changeErrors).toHaveLength(0)
  })
  it('should return error for invalid assignee type', async () => {
    projectInstance.value[ASSIGNEE_TYPE_FIELD] = 'INVALID'
    const changeErrors = await projectAssigneeTypeValidator([toChange({ after: projectInstance })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: projectInstance.elemID,
      severity: 'Error',
      message: 'Invalid assignee type',
      detailedMessage: "Project assignee type must be one of ['PROJECT_LEAD', 'UNASSIGNED'], got INVALID",
    })
  })
})
