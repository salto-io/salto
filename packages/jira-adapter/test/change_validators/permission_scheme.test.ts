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
import { toChange, InstanceElement, ElemID, ObjectType, ReadOnlyElementsSource, ReferenceExpression, SeverityLevel, ChangeError } from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getAccountInfoInstance, getLicenseElementSource, mockClient } from '../utils'
import { JIRA, PERMISSION_SCHEME_TYPE_NAME, PROJECT_TYPE } from '../../src/constants'
import { permissionSchemeDeploymentValidator } from '../../src/change_validators/permission_scheme'

const projectError = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Can’t modify association between a project and a permission scheme',
  detailedMessage: 'This free Jira instance doesn’t support modifying associations between projects and permission schemes.',
})

const projectWarning = (elemID: ElemID, schemeName: string): ChangeError => ({
  elemID,
  severity: 'Warning' as SeverityLevel,
  message: 'Project will be deployed with a default permission scheme instead',
  detailedMessage: `This project uses the ${schemeName} permission scheme. However, the target Jira instance is a free one, which doesn’t support creating permission schemes. After deployment, the project will use a newly created default scheme.`,
})

const schemeError = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Can’t modify permission schemes in a free Jira instance',
  detailedMessage: 'The target Jira instance is a free one, which doesn’t support permission schemes. This change won’t be deployed.',
})

const schemeWarning = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Warning' as SeverityLevel,
  message: 'Can’t deploy new permission schemes to a free Jira instance',
  detailedMessage: 'The target Jira instance is a free one, which doesn’t support permission schemes. This change won’t be deployed. The project will use a default change permission scheme instead.',
})
describe('permissionSchemeDeploymentValidator', () => {
  const { client } = mockClient()
  let elementsSource: ReadOnlyElementsSource
  const validator = permissionSchemeDeploymentValidator(client)
  let permissionInstances: InstanceElement[]
  let projectInstances: InstanceElement[]
  let project3NoScheme: InstanceElement
  let project0MoreFields: InstanceElement

  beforeEach(() => {
    const permissionType = new ObjectType({
      elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME),
    })
    const projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
    })
    permissionInstances = _.range(4).map(index =>
      new InstanceElement(
        `permission${index}`,
        permissionType,
        {}
      ))

    projectInstances = _.range(3).map(index => new InstanceElement(
      `project${index}`,
      projectType,
      {
        permissionScheme: new ReferenceExpression(permissionInstances[index].elemID),
      }
    ))
    project3NoScheme = new InstanceElement(
      'project3',
      projectType,
      {}
    )
    project0MoreFields = new InstanceElement(
      'project0',
      projectType,
      {
        permissionScheme: new ReferenceExpression(permissionInstances[0].elemID),
        description: 'test',
      }
    )
    elementsSource = getLicenseElementSource(true)
  })
  describe('projects', () => {
    it('should create a warning for project creation', async () => {
      expect(await validator(
        [toChange({ after: projectInstances[0] })], elementsSource
      )).toEqual([projectWarning(projectInstances[0].elemID, 'permission0')])
    })
    it('should not create a warning for project creation without a scheme reference', async () => {
      expect(await validator(
        [toChange({ after: project3NoScheme })], elementsSource
      )).toEqual([])
    })
    it('should create an error for association modification', async () => {
      expect(await validator(
        [toChange({ before: projectInstances[1], after: projectInstances[0] })], elementsSource
      )).toEqual([projectError(projectInstances[0].elemID)])
    })
    it('should create an error for association removal', async () => {
      expect(await validator(
        [toChange({ before: projectInstances[1], after: project3NoScheme })], elementsSource
      )).toEqual([projectError(project3NoScheme.elemID)])
    })
    it('should not create an error for removal', async () => {
      expect(await validator(
        [toChange({ before: projectInstances[1] })], elementsSource
      )).toEqual([])
    })
    it('should not create an error for modification without change for association', async () => {
      expect(await validator(
        [toChange({ before: project0MoreFields, after: projectInstances[0] })], elementsSource
      )).toEqual([])
    })
  })
  describe('permission schemes', () => {
    describe('associated schemes', () => {
      beforeEach(() => {
        elementsSource = buildElementsSourceFromElements([
          getAccountInfoInstance(true),
          ...projectInstances,
          ...permissionInstances,
        ])
      })
      it('should not return a warning for removal of project and scheme', async () => {
        elementsSource = getLicenseElementSource(true)
        expect(await validator(
          [toChange({ before: permissionInstances[0] }),
            toChange({ before: projectInstances[0] })],
          elementsSource
        )).toEqual([])
      })
      it('should return a warning for creation of project and scheme', async () => {
        expect(await validator(
          [toChange({ after: permissionInstances[0] }),
            toChange({ after: projectInstances[0] })],
          elementsSource
        )).toEqual([schemeWarning(permissionInstances[0].elemID),
          projectWarning(projectInstances[0].elemID, 'permission0')])
      })
      it('should return an error for schemes', async () => {
        expect(await validator(
          [toChange({ after: permissionInstances[0] }),
            toChange({ before: permissionInstances[1], after: permissionInstances[2] }),
            toChange({ before: permissionInstances[1] }),
          ],
          elementsSource
        )).toEqual([schemeError(permissionInstances[0].elemID),
          schemeError(permissionInstances[2].elemID),
          schemeError(permissionInstances[1].elemID)])
      })
    })
    describe('unassociated schemes', () => {
      beforeEach(() => {
        elementsSource = buildElementsSourceFromElements([
          getAccountInfoInstance(true),
          ...permissionInstances,
        ])
      })
      it('should return an error for scheme creation', async () => {
        expect(await validator(
          [toChange({ after: permissionInstances[0] })],
          elementsSource
        )).toEqual([schemeError(permissionInstances[0].elemID)])
      })
      it('should return an error for association removed as part of the change', async () => {
        expect(await validator(
          [toChange({ before: permissionInstances[1], after: permissionInstances[0] }),
            toChange({ before: projectInstances[0], after: project3NoScheme })],
          elementsSource
        )).toEqual([schemeError(permissionInstances[0].elemID),
          projectError(project3NoScheme.elemID)])
      })
      it('should not return an error for unassociated schemes', async () => {
        expect(await validator(
          [toChange({ before: permissionInstances[1], after: permissionInstances[0] }),
            toChange({ before: permissionInstances[2] })],
          elementsSource
        )).toEqual([])
      })
    })
  })
  it('should not return an error when paid plan', async () => {
    elementsSource = buildElementsSourceFromElements([getAccountInfoInstance(false)])
    expect(await validator(
      [toChange({ after: permissionInstances[0] })],
      elementsSource
    )).toEqual([])
  })
  it('should not return an error for DC', async () => {
    const { client: dcClient } = mockClient(true)
    const dcValidator = permissionSchemeDeploymentValidator(dcClient)
    expect(await dcValidator(
      [toChange({ after: permissionInstances[0] })],
      elementsSource
    )).toEqual([])
  })
  it('should not fail on edge cases (increase branch coverage)', async () => {
    expect(await validator(
      [toChange({ before: project3NoScheme, after: project3NoScheme }),
        toChange({ before: projectInstances[0], after: project3NoScheme }),
        toChange({ before: permissionInstances[0], after: permissionInstances[0] })],
      elementsSource
    )).toEqual([schemeError(permissionInstances[0].elemID), projectError(project3NoScheme.elemID)])
  })
})
