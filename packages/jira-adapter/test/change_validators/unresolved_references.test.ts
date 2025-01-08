/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
    expect(automationProjectReferenceDetector(elemId)).toBeTrue()
  })

  it('should return false when the elemId not fit automationProjectId  ', async () => {
    elemId = new ElemID(JIRA, AUTOMATION_TYPE, 'instance', 'ruleName', 'projects', '0', 'projectIds')
    expect(automationProjectReferenceDetector(elemId)).toBeFalse()
    elemId = new ElemID(JIRA, AUTOMATION_TYPE, 'instance', 'ruleName', 'projects', 'notNumber', 'projectId')
    expect(automationProjectReferenceDetector(elemId)).toBeFalse()
    elemId = new ElemID(JIRA, AUTOMATION_TYPE, 'instance', 'ruleName', 'project', '0', 'projectId')
    expect(automationProjectReferenceDetector(elemId)).toBeFalse()
    elemId = new ElemID(JIRA, 'anotherType', 'instance', 'ruleName', 'project', '0', 'projectId')
    expect(automationProjectReferenceDetector(elemId)).toBeFalse()
    elemId = new ElemID('anotherAdapter', AUTOMATION_TYPE, 'instance', 'ruleName', 'project', '0', 'projectId')
    expect(automationProjectReferenceDetector(elemId)).toBeFalse()
    elemId = new ElemID('anotherAdapter', AUTOMATION_TYPE, 'instance', 'project', '0', 'projectId')
    expect(automationProjectReferenceDetector(elemId)).toBeFalse()
  })
})
