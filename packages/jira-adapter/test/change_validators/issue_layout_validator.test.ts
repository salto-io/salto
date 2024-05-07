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
import {
  Change,
  InstanceElement,
  ChangeValidator,
  toChange,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  ElemID,
  ReadOnlyElementsSource,
  ChangeError,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import JiraClient from '../../src/client/client'
import { mockClient, createEmptyType } from '../utils'
import { issueLayoutsValidator } from '../../src/change_validators/issue_layouts_validator'
import {
  ISSUE_LAYOUT_TYPE,
  ISSUE_TYPE_NAME,
  ISSUE_TYPE_SCHEMA_NAME,
  ISSUE_TYPE_SCREEN_SCHEME_TYPE,
  PROJECT_TYPE,
  SCREEN_SCHEME_TYPE,
  SCREEN_TYPE_NAME,
} from '../../src/constants'
import { generateLayoutId } from '../../src/filters/layouts/layout_service_operations'
import { getDefaultConfig } from '../../src/config/config'

describe('issue layouts validator', () => {
  let validator: ChangeValidator
  let elements: InstanceElement[]
  let screenInstance1: InstanceElement
  let screenInstance2: InstanceElement
  let screenInstance3: InstanceElement
  let screenSchemeInstance1: InstanceElement
  let screenSchemeInstance2: InstanceElement
  let screenSchemeInstance3: InstanceElement
  let screenSchemeInstance4: InstanceElement
  let issueTypeScreenSchemeInstance1: InstanceElement
  let issueTypeScreenSchemeInstance2: InstanceElement
  let issueTypeScreenSchemeInstance3: InstanceElement
  let projectInstance1: InstanceElement
  let projectInstance2: InstanceElement
  let issueTypeInstance1: InstanceElement
  let issueTypeInstance2: InstanceElement
  let issueTypeSchemeInstance1: InstanceElement
  let issueTypeSchemeInstance2: InstanceElement
  let issueTypeSchemeInstance3: InstanceElement
  let issueLayoutInstance1: InstanceElement
  let issueLayoutInstance2: InstanceElement
  let changeIssueLayout1: Change
  let changeIssueLayout2: Change
  let elementSource: ReadOnlyElementsSource
  let client: JiraClient
  let error: ChangeError

  beforeEach(() => {
    jest.clearAllMocks()
    client = mockClient().client

    validator = issueLayoutsValidator(client, getDefaultConfig({ isDataCenter: false }))

    const screenSchemeType = createEmptyType(SCREEN_SCHEME_TYPE)
    const issueTypeScreenSchemeType = createEmptyType(ISSUE_TYPE_SCREEN_SCHEME_TYPE)
    const projectType = createEmptyType(PROJECT_TYPE)
    const issueTypeType = createEmptyType(ISSUE_TYPE_NAME)
    const issueTypeSchemeType = createEmptyType(ISSUE_TYPE_SCHEMA_NAME)
    const issueLayoutType = createEmptyType(ISSUE_LAYOUT_TYPE)
    const screenType = createEmptyType(SCREEN_TYPE_NAME)

    issueTypeInstance1 = new InstanceElement('issueType1', issueTypeType, {
      name: 'issueType1',
      id: 100,
    })
    issueTypeInstance2 = new InstanceElement('issueType2', issueTypeType, {
      name: 'issueType2',
      id: 200,
    })
    issueTypeSchemeInstance1 = new InstanceElement('issueTypeScheme1', issueTypeSchemeType, {
      name: 'issueTypeScheme1',
      id: 10,
      issueTypeIds: [new ReferenceExpression(issueTypeInstance1.elemID, issueTypeInstance1)],
    })
    issueTypeSchemeInstance2 = new InstanceElement('issueTypeScheme2', issueTypeSchemeType, {
      name: 'issueTypeScheme2',
      id: 20,
      issueTypeIds: [
        new ReferenceExpression(issueTypeInstance1.elemID, issueTypeInstance1),
        new ReferenceExpression(issueTypeInstance2.elemID, issueTypeInstance2),
      ],
    })
    issueTypeSchemeInstance3 = new InstanceElement('issueTypeScheme3', issueTypeSchemeType, {
      name: 'issueTypeScheme3',
      id: 30,
      issueTypeIds: [new ReferenceExpression(issueTypeInstance2.elemID, issueTypeInstance2)],
    })

    screenInstance1 = new InstanceElement('screen1', screenType, {
      name: 'screen1',
      id: 11,
    })
    screenInstance2 = new InstanceElement('screen2', screenType, {
      name: 'screen2',
      id: 12,
    })
    screenInstance3 = new InstanceElement('screen3', screenType, {
      name: 'screen3',
      id: 13,
    })

    screenSchemeInstance1 = new InstanceElement('screenScheme1', screenSchemeType, {
      name: 'screenScheme1',
      id: 111,
      screens: {},
    })
    screenSchemeInstance2 = new InstanceElement('screenScheme2', screenSchemeType, {
      name: 'screenScheme2',
      id: 222,
      screens: { default: new ReferenceExpression(screenInstance1.elemID, screenInstance1) },
    })
    screenSchemeInstance3 = new InstanceElement('screenScheme3', screenSchemeType, {
      name: 'screenScheme3',
      id: 333,
      screens: {
        default: new ReferenceExpression(screenInstance3.elemID, screenInstance3),
        view: new ReferenceExpression(screenInstance2.elemID, screenInstance2),
      },
    })
    screenSchemeInstance4 = new InstanceElement('screenScheme4', screenSchemeType, {
      name: 'screenScheme4',
      id: 444,
      screens: { default: new ReferenceExpression(screenInstance2.elemID, screenInstance2) },
    })
    issueTypeScreenSchemeInstance1 = new InstanceElement('issueTypeScreenScheme1', issueTypeScreenSchemeType, {
      name: 'issueTypeScreenScheme1',
      id: 1111,
      issueTypeMappings: [
        {
          issueTypeId: new ReferenceExpression(issueTypeInstance1.elemID, issueTypeInstance1),
          screenSchemeId: new ReferenceExpression(screenSchemeInstance2.elemID, screenSchemeInstance2),
        },
      ],
    })
    issueTypeScreenSchemeInstance2 = new InstanceElement('issueTypeScreenScheme2', issueTypeScreenSchemeType, {
      name: 'issueTypeScreenScheme2',
      id: 2222,
      issueTypeMappings: [
        {
          issueTypeId: new ReferenceExpression(issueTypeInstance1.elemID, issueTypeInstance1),
          screenSchemeId: new ReferenceExpression(screenSchemeInstance3.elemID, screenSchemeInstance3),
        },
        {
          issueTypeId: 'default',
          screenSchemeId: new ReferenceExpression(screenSchemeInstance2.elemID, screenSchemeInstance2),
        },
      ],
    })
    issueTypeScreenSchemeInstance3 = new InstanceElement('issueTypeScreenScheme3', issueTypeScreenSchemeType, {
      name: 'issueTypeScreenScheme3',
      id: 3333,
      issueTypeMappings: [
        {
          issueTypeId: new ReferenceExpression(issueTypeInstance2.elemID, issueTypeInstance2),
          screenSchemeId: new ReferenceExpression(screenSchemeInstance4.elemID, screenSchemeInstance4),
        },
      ],
    })

    projectInstance1 = new InstanceElement('project1', projectType, {
      name: 'project1',
      id: '11111',
      projectTypeKey: 'software',
      issueTypeScreenScheme: new ReferenceExpression(
        issueTypeScreenSchemeInstance1.elemID,
        issueTypeScreenSchemeInstance1,
      ),
      issueTypeScheme: new ReferenceExpression(issueTypeSchemeInstance1.elemID, issueTypeSchemeInstance1),
    })

    projectInstance2 = new InstanceElement('project2', projectType, {
      name: 'project2',
      id: '22222',
      projectTypeKey: 'software',
      issueTypeScreenScheme: new ReferenceExpression(
        issueTypeScreenSchemeInstance2.elemID,
        issueTypeScreenSchemeInstance2,
      ),
      issueTypeScheme: new ReferenceExpression(issueTypeSchemeInstance2.elemID, issueTypeSchemeInstance2),
    })

    issueLayoutInstance1 = new InstanceElement(
      'issueLayout1',
      issueLayoutType,
      {
        name: 'issueLayout1',
        extraDefinerId: new ReferenceExpression(screenInstance1.elemID, screenInstance1),
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance1.elemID, projectInstance1)] },
    )

    issueLayoutInstance2 = new InstanceElement(
      'issueLayout2',
      issueLayoutType,
      {
        name: 'issueLayout2',
        extraDefinerId: new ReferenceExpression(screenInstance2.elemID, screenInstance2),
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance2.elemID, projectInstance2)] },
    )
    changeIssueLayout1 = toChange({ after: issueLayoutInstance1 })
    changeIssueLayout2 = toChange({ after: issueLayoutInstance2 })

    elements = [
      issueTypeSchemeInstance1,
      issueTypeSchemeInstance2,
      screenSchemeInstance1,
      screenSchemeInstance2,
      screenSchemeInstance3,
      issueTypeScreenSchemeInstance1,
      issueTypeScreenSchemeInstance2,
      projectInstance1,
      issueLayoutInstance1,
    ]

    elementSource = buildElementsSourceFromElements(elements)

    error = {
      elemID: issueLayoutInstance1.elemID,
      severity: 'Error',
      message: 'Invalid screen in Issue Layout',
      detailedMessage: 'This issue layout references an invalid or non-existing screen.',
    }
  })
  it('should not return error when issue layout is linked to relevant project screens', async () => {
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should return the correct error if the issueTypeScreenScheme are empty and there is issueLayout', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = []
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
    expect(errors).toEqual([error])
  })
  it('should not return error if the issue layout is linked to the view screen', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
      {
        issueTypeId: new ReferenceExpression(issueTypeInstance1.elemID, issueTypeInstance1),
        screenSchemeId: new ReferenceExpression(screenSchemeInstance3.elemID, screenSchemeInstance3),
      },
    ]
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance2.elemID, screenInstance2)
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should not return error if client is data center', async () => {
    const errors = await issueLayoutsValidator(client, getDefaultConfig({ isDataCenter: true }))(
      [changeIssueLayout1],
      elementSource,
    )
    expect(errors).toHaveLength(0)
  })
  it('should return error and not abort if there is issueTypeScreenScheme without issueTypeIds', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
      {
        screenSchemeId: new ReferenceExpression(screenSchemeInstance2.elemID, screenSchemeInstance2),
      },
    ]
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the project has no issueTypeScheme', async () => {
    delete projectInstance1.value.issueTypeScheme
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the project has no issueTypeScreenScheme', async () => {
    delete projectInstance1.value.issueTypeScreenScheme
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueLayout has no extraDefinerId', async () => {
    delete issueLayoutInstance1.value.extraDefinerId
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueTypeScheme has no issueTypeIds', async () => {
    issueTypeSchemeInstance1.value.issueTypeIds = []
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if project linked to non existing issueTypeScheme', async () => {
    projectInstance1.value.issueTypeScheme = new ReferenceExpression(new ElemID('salto', 'nonExistingIssueTypeScheme'))
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if project linked to non existing issueTypeScreenScheme', async () => {
    projectInstance1.value.issueTypeScreenScheme = new ReferenceExpression(
      new ElemID('salto', 'nonExistingIssueTypeScreenScheme'),
    )
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the screens of the screenScheme is empty', async () => {
    screenSchemeInstance2.value.screens = {}
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the screenScheme has no screens', async () => {
    delete screenSchemeInstance2.value.screens
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if project linked to issueTypeScheme without issueTypeIds', async () => {
    issueTypeSchemeInstance1.value.issueTypeIds = []
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueLayout parent is undefined', async () => {
    delete issueLayoutInstance1.annotations[CORE_ANNOTATIONS.PARENT][0]
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueLayout has no parent list', async () => {
    delete issueLayoutInstance1.annotations[CORE_ANNOTATIONS.PARENT]
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error if the project has no issueTypeScheme', async () => {
    delete projectInstance1.value.issueTypeScheme
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error if the project has no issueTypeScreenScheme', async () => {
    delete projectInstance1.value.issueTypeScreenScheme
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueTypeMappings of the issueTypeScreenScheme are empty', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = []
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueTypeMappings of the issueTypeScreenScheme are undefined', async () => {
    delete issueTypeScreenSchemeInstance1.value.issueTypeMappings
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueTypes in the issueTypeScheme are strings', async () => {
    issueTypeSchemeInstance1.value.issueTypeIds = ['issueType1']
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueTypes in the issueTypeScheme are numbers', async () => {
    issueTypeSchemeInstance1.value.issueTypeIds = [1]
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueTypeScreenScheme of the project is not ReferenceExpression', async () => {
    projectInstance1.value.issueTypeScreenScheme = 'issueTypeScreenScheme1'
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueTypeScheme of the project is not ReferenceExpression', async () => {
    projectInstance1.value.issueTypeScheme = 'issueTypeScheme1'
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the issueTypeId of the issueTypeMappings of the issueTypeScreenScheme are not ReferenceExpression', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
      {
        issueTypeId: 'issueType1',
        screenSchemeId: new ReferenceExpression(screenSchemeInstance2.elemID, screenSchemeInstance2),
      },
    ]
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the screenSchemeId of the issueTypeMappings of the issueTypeScreenScheme are not ReferenceExpression', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
      {
        issueTypeId: new ReferenceExpression(issueTypeInstance1.elemID, issueTypeInstance1),
        screenSchemeId: 'screenScheme2',
      },
    ]
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the screen of the screenScheme is not ReferenceExpression', async () => {
    screenSchemeInstance2.value.screens = { default: 'screen1' }
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the parent of the issueLayout is not ReferenceExpression', async () => {
    issueLayoutInstance1.annotations[CORE_ANNOTATIONS.PARENT] = ['project1']
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error and not abort if the extraDefinerId of the issueLayout is not ReferenceExpression', async () => {
    issueLayoutInstance1.value.extraDefinerId = 'screen1'
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout is linked to the default screen if there is view screen', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
      {
        issueTypeId: new ReferenceExpression(issueTypeInstance1.elemID, issueTypeInstance1),
        screenSchemeId: new ReferenceExpression(screenSchemeInstance3.elemID, screenSchemeInstance3),
      },
    ]
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance3.elemID, screenInstance3)
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should not return error if the issue layout is linked to the default screen if there is no view screen', async () => {
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance1.elemID, screenInstance1)
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should return error if the issue layout linked to anon existing project', async () => {
    issueLayoutInstance1.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(new ElemID('salto', 'nonExistingProject')),
    ]
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout linked to a non existing screen', async () => {
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(new ElemID('salto', 'nonExistingScreen'))
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout linked to issueType that is not linked to the project', async () => {
    issueTypeScreenSchemeInstance2.value.issueTypeMappings = [
      {
        issueTypeId: new ReferenceExpression(issueTypeInstance1.elemID, issueTypeInstance1),
        screenSchemeId: new ReferenceExpression(screenSchemeInstance3.elemID, screenSchemeInstance3),
      },
      {
        issueTypeId: new ReferenceExpression(issueTypeInstance2.elemID, issueTypeInstance2),
        screenSchemeId: new ReferenceExpression(screenSchemeInstance2.elemID, screenSchemeInstance2),
      },
    ]
    projectInstance1.value.issueTypeScreenScheme = new ReferenceExpression(
      issueTypeScreenSchemeInstance2.elemID,
      issueTypeScreenSchemeInstance2,
    )

    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should not return error if the issue layout links to a default issueTypeScreenScheme for unaddressed projects issue types', async () => {
    projectInstance1.value.issueTypeScreenScheme = new ReferenceExpression(
      issueTypeScreenSchemeInstance2.elemID,
      issueTypeScreenSchemeInstance2,
    )
    projectInstance1.value.issueTypeScheme = new ReferenceExpression(
      issueTypeSchemeInstance2.elemID,
      issueTypeSchemeInstance2,
    )
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should return error if the issue layout links to a default issueTypeScreenScheme if managed all project issue types', async () => {
    projectInstance1.value.issueTypeScreenScheme = new ReferenceExpression(
      issueTypeScreenSchemeInstance2.elemID,
      issueTypeScreenSchemeInstance2,
    )
    projectInstance1.value.issueTypeScheme = new ReferenceExpression(
      issueTypeSchemeInstance1.elemID,
      issueTypeSchemeInstance1,
    )
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance1.elemID, screenInstance1)
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout is linked to a non default or view screens', async () => {
    screenSchemeInstance2.value.screens = { edit: new ReferenceExpression(screenInstance1.elemID, screenInstance1) }
    const errors = await validator([changeIssueLayout1], elementSource)
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout is linked to screen of different project', async () => {
    issueLayoutInstance1.value.id = generateLayoutId({
      projectId: projectInstance1.value.id,
      extraDefinerId: screenInstance2.value.id,
    })
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance2.elemID, screenInstance2)
    elements.push(projectInstance2)
    const errors = await validator([changeIssueLayout1], buildElementsSourceFromElements(elements))
    expect(errors).toHaveLength(1)
  })
  it('should not return error if there is 2 issue layout that are linked to 2 different projects', async () => {
    projectInstance2.value.issueTypeScreenScheme = new ReferenceExpression(
      issueTypeScreenSchemeInstance3.elemID,
      issueTypeScreenSchemeInstance3,
    )
    projectInstance2.value.issueTypeScheme = new ReferenceExpression(
      issueTypeSchemeInstance3.elemID,
      issueTypeSchemeInstance3,
    )
    elements.push(projectInstance2)
    elements.push(issueLayoutInstance2)
    elements.push(screenSchemeInstance4)
    elements.push(issueTypeSchemeInstance3)
    elements.push(issueTypeScreenSchemeInstance3)
    const errors = await validator([changeIssueLayout1, changeIssueLayout2], buildElementsSourceFromElements(elements))
    expect(errors).toHaveLength(0)
  })
  it('should return 2 errors if there are 2 issue layouts that each linked to the wrong project', async () => {
    projectInstance2.value.issueTypeScreenScheme = new ReferenceExpression(
      issueTypeScreenSchemeInstance3.elemID,
      issueTypeScreenSchemeInstance3,
    )
    projectInstance2.value.issueTypeScheme = new ReferenceExpression(
      issueTypeSchemeInstance3.elemID,
      issueTypeSchemeInstance3,
    )
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance2.elemID, screenInstance2)
    issueLayoutInstance2.value.extraDefinerId = new ReferenceExpression(screenInstance1.elemID, screenInstance1)
    elements.push(projectInstance2)
    elements.push(issueLayoutInstance2)
    elements.push(screenSchemeInstance4)
    elements.push(issueTypeSchemeInstance3)
    elements.push(issueTypeScreenSchemeInstance3)
    const errors = await validator([changeIssueLayout1, changeIssueLayout2], buildElementsSourceFromElements(elements))
    expect(errors).toHaveLength(2)
    expect(errors[0].elemID).toEqual(issueLayoutInstance1.elemID)
    expect(errors[1].elemID).toEqual(issueLayoutInstance2.elemID)
  })
})
