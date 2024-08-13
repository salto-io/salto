/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
