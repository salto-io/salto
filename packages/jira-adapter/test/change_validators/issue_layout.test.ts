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
  ObjectType,
  InstanceElement,
  ChangeValidator,
  toChange,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  ElemID,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { issueLayoutsValidator } from '../../src/change_validators/issue_layouts_validator'
import {
  ISSUE_LAYOUT_TYPE,
  ISSUE_TYPE_NAME,
  ISSUE_TYPE_SCHEMA_NAME,
  ISSUE_TYPE_SCREEN_SCHEME_TYPE,
  JIRA,
  PROJECT_TYPE,
  SCREEN_SCHEME_TYPE,
  SCREEN_TYPE_NAME,
} from '../../src/constants'
import { generateLayoutId } from '../../src/filters/layouts/layout_service_operations'

describe('issue layouts validator', () => {
  let validator: ChangeValidator
  let elements: InstanceElement[]
  let screenType: ObjectType
  let screenInstance1: InstanceElement
  let screenInstance2: InstanceElement
  let screenInstance3: InstanceElement
  let screenSchemeType: ObjectType
  let screenSchemeInstance1: InstanceElement
  let screenSchemeInstance2: InstanceElement
  let screenSchemeInstance3: InstanceElement
  let screenSchemeInstance4: InstanceElement
  let issueTypeScreenSchemeType: ObjectType
  let issueTypeScreenSchemeInstance1: InstanceElement
  let issueTypeScreenSchemeInstance2: InstanceElement
  let issueTypeScreenSchemeInstance3: InstanceElement
  let projectType: ObjectType
  let projectInstance1: InstanceElement
  let projectInstance2: InstanceElement
  let issueTypeType: ObjectType
  let issueTypeInstance1: InstanceElement
  let issueTypeInstance2: InstanceElement
  let issueTypeSchemeType: ObjectType
  let issueTypeSchemeInstance1: InstanceElement
  let issueTypeSchemeInstance2: InstanceElement
  let issueTypeSchemeInstance3: InstanceElement
  let issueLayoutType: ObjectType
  let issueLayoutInstance1: InstanceElement
  let issueLayoutInstance2: InstanceElement

  beforeEach(() => {
    jest.clearAllMocks()

    validator = issueLayoutsValidator

    screenSchemeType = new ObjectType({ elemID: new ElemID(JIRA, SCREEN_SCHEME_TYPE) })
    issueTypeScreenSchemeType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_SCREEN_SCHEME_TYPE) })
    projectType = new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) })
    issueTypeType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) })
    issueTypeSchemeType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_SCHEMA_NAME) })
    issueLayoutType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_LAYOUT_TYPE) })
    screenType = new ObjectType({ elemID: new ElemID(JIRA, SCREEN_TYPE_NAME) })

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
        id: generateLayoutId({ projectId: projectInstance1.value.id, extraDefinerId: screenInstance1.value.id }),
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
        id: generateLayoutId({ projectId: projectInstance2.value.id, extraDefinerId: screenInstance2.value.id }),
        extraDefinerId: new ReferenceExpression(screenInstance2.elemID, screenInstance2),
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance2.elemID, projectInstance2)] },
    )

    elements = [
      issueTypeInstance1,
      issueTypeInstance2,
      issueTypeSchemeInstance1,
      issueTypeSchemeInstance2,
      screenInstance1,
      screenInstance2,
      screenInstance3,
      screenSchemeInstance1,
      screenSchemeInstance2,
      screenSchemeInstance3,
      issueTypeScreenSchemeInstance1,
      issueTypeScreenSchemeInstance2,
      projectInstance1,
      issueLayoutInstance1,
    ]
  })
  it('should not return error when issue layout is linked to relevant project screens', async () => {
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(0)
  })
  it('should return error if the issueTypeScreenScheme are empty and there is issueLayout', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = []
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(1)
  })
  it('should not return error if the issue layout is linked to the view screen', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings[0].screenSchemeId = new ReferenceExpression(
      screenSchemeInstance3.elemID,
      screenSchemeInstance3,
    )
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance2.elemID, screenInstance2)
    issueLayoutInstance1.value.id = generateLayoutId({
      projectId: projectInstance1.value.id,
      extraDefinerId: screenInstance2.value.id,
    })
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(0)
  })
  it('should return error if the issue layout is linked to the default screen if there is view screen', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings[0].screenSchemeId = new ReferenceExpression(
      screenSchemeInstance3.elemID,
      screenSchemeInstance3,
    )
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance3.elemID, screenInstance3)
    issueLayoutInstance1.value.id = generateLayoutId({
      projectId: projectInstance1.value.id,
      extraDefinerId: screenInstance3.value.id,
    })
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(1)
  })
  it('should not return error if the issue layout is linked to the default screen if there is no view screen', async () => {
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance1.elemID, screenInstance1)
    issueLayoutInstance1.value.id = generateLayoutId({
      projectId: projectInstance1.value.id,
      extraDefinerId: screenInstance1.value.id,
    })
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(0)
  })
  it('should return error if the issue layout linked to anon existing project', async () => {
    issueLayoutInstance1.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(new ElemID('salto', 'nonExistingProject')),
    ]
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout linked to a non existing screen', async () => {
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(new ElemID('salto', 'nonExistingScreen'))
    issueLayoutInstance1.value.id = generateLayoutId({
      projectId: projectInstance1.value.id,
      extraDefinerId: 'nonExistingScreen',
    })
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout linked to issueType that is not linked to the project', async () => {
    issueTypeScreenSchemeInstance2.value.issueTypeMappings[1].issueTypeId = new ReferenceExpression(
      issueTypeInstance2.elemID,
      issueTypeInstance2,
    )
    projectInstance1.value.issueTypeScreenScheme = new ReferenceExpression(
      issueTypeScreenSchemeInstance2.elemID,
      issueTypeScreenSchemeInstance2,
    )

    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(1)
  })
  it('Passes if the issue layout links to a default issueTypeScreenScheme for unaddressed projects issue types', async () => {
    projectInstance1.value.issueTypeScreenScheme = new ReferenceExpression(
      issueTypeScreenSchemeInstance2.elemID,
      issueTypeScreenSchemeInstance2,
    )
    projectInstance1.value.issueTypeScheme = new ReferenceExpression(
      issueTypeSchemeInstance2.elemID,
      issueTypeSchemeInstance2,
    )
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(0)
  })
  it('Fails if the issue layout links to a default issueTypeScreenScheme if managed all project issue types', async () => {
    projectInstance1.value.issueTypeScreenScheme = new ReferenceExpression(
      issueTypeScreenSchemeInstance2.elemID,
      issueTypeScreenSchemeInstance2,
    )
    projectInstance1.value.issueTypeScheme = new ReferenceExpression(
      issueTypeSchemeInstance1.elemID,
      issueTypeSchemeInstance1,
    )
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance1.elemID, screenInstance1)
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout is linked to a non default or view screens', async () => {
    screenSchemeInstance2.value.screens = { edit: new ReferenceExpression(screenInstance1.elemID, screenInstance1) }
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(1)
  })
  it('should return error if the issue layout is linked to screen of different project', async () => {
    issueLayoutInstance1.value.id = generateLayoutId({
      projectId: projectInstance1.value.id,
      extraDefinerId: screenInstance2.value.id,
    })
    issueLayoutInstance1.value.extraDefinerId = new ReferenceExpression(screenInstance2.elemID, screenInstance2)
    elements.push(projectInstance2)
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 })],
      buildElementsSourceFromElements(elements),
    )
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
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 }), toChange({ after: issueLayoutInstance2 })],
      buildElementsSourceFromElements(elements),
    )
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
    issueLayoutInstance1.value.id = generateLayoutId({
      projectId: projectInstance1.value.id,
      extraDefinerId: screenInstance2.value.id,
    })
    issueLayoutInstance2.value.extraDefinerId = new ReferenceExpression(screenInstance1.elemID, screenInstance1)
    issueLayoutInstance2.value.id = generateLayoutId({
      projectId: projectInstance2.value.id,
      extraDefinerId: screenInstance1.value.id,
    })
    elements.push(projectInstance2)
    elements.push(issueLayoutInstance2)
    elements.push(screenSchemeInstance4)
    elements.push(issueTypeSchemeInstance3)
    elements.push(issueTypeScreenSchemeInstance3)
    const errors = await validator(
      [toChange({ after: issueLayoutInstance1 }), toChange({ after: issueLayoutInstance2 })],
      buildElementsSourceFromElements(elements),
    )
    expect(errors).toHaveLength(2)
  })
})
