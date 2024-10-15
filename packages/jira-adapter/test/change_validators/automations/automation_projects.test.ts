/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, ReadOnlyElementsSource, InstanceElement, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { automationProjectsValidator } from '../../../src/change_validators/automation/automation_projects'
import { AUTOMATION_TYPE, JIRA } from '../../../src/constants'

describe('automationProjectsValidator', () => {
  let automationType: ObjectType
  let instance: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  beforeEach(() => {
    elementsSource = buildElementsSourceFromElements([])

    automationType = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
    instance = new InstanceElement('instance', automationType, {
      name: 'someName',
      projects: [],
    })
  })

  it('should return an error when there are no projects', async () => {
    expect(await automationProjectsValidator([toChange({ after: instance })], elementsSource)).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot deploy automation without projects.',
        detailedMessage:
          'In order to deploy an automation it must be either global, assigned to at least one project type, or assigned to at least one project that exist in the current environment. To learn more, go to https://help.salto.io/en/articles/9763118-can-t-deploy-a-non-global-automation-without-projects',
      },
    ])
  })

  it('should not return an error when assigned to a project', async () => {
    instance.value.projects = ['someProject']
    expect(await automationProjectsValidator([toChange({ after: instance })], elementsSource)).toEqual([])
  })

  it('should not return an error when global', async () => {
    delete instance.value.projects
    expect(await automationProjectsValidator([toChange({ after: instance })], elementsSource)).toEqual([])
  })
})
