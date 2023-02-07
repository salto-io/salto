/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { ElemID } from '@salto-io/adapter-api'
import { automationProjectReferenceDetector } from '../../src/change_validators/unresolved_references'
import { AUTOMATION_TYPE, JIRA } from '../../src/constants'

describe('automationProjectUnresolvedReferenceValidator', () => {
  let elemId: ElemID

  beforeEach(() => {
    elemId = new ElemID(JIRA, AUTOMATION_TYPE, 'instance', 'ruleName', 'projects', '0', 'projectId')
  })

  it('should return true when the elemId fit automationProjectId  ', async () => {
    expect(automationProjectReferenceDetector(elemId))
      .toBeTrue()
  })

  it('should return false when the elemId not fit automationProjectId  ', async () => {
    elemId = new ElemID(JIRA, AUTOMATION_TYPE, 'instance', 'ruleName', 'projects', '0', 'projectIds')
    expect(automationProjectReferenceDetector(elemId))
      .toBeFalse()
    elemId = new ElemID(JIRA, AUTOMATION_TYPE, 'instance', 'ruleName', 'projects', 'notNumber', 'projectId')
    expect(automationProjectReferenceDetector(elemId))
      .toBeFalse()
    elemId = new ElemID(JIRA, AUTOMATION_TYPE, 'instance', 'ruleName', 'project', '0', 'projectId')
    expect(automationProjectReferenceDetector(elemId))
      .toBeFalse()
    elemId = new ElemID(JIRA, 'anotherType', 'instance', 'ruleName', 'project', '0', 'projectId')
    expect(automationProjectReferenceDetector(elemId))
      .toBeFalse()
    elemId = new ElemID('anotherAdapter', AUTOMATION_TYPE, 'instance', 'ruleName', 'project', '0', 'projectId')
    expect(automationProjectReferenceDetector(elemId))
      .toBeFalse()
    elemId = new ElemID('anotherAdapter', AUTOMATION_TYPE, 'instance', 'project', '0', 'projectId')
    expect(automationProjectReferenceDetector(elemId))
      .toBeFalse()
  })
})
