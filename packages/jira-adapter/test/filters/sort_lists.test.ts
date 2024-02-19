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
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { getFilterParams } from '../utils'
import sortListsFilter from '../../src/filters/sort_lists'
import { Filter } from '../../src/filter'
import { AUTOMATION_PROJECT_TYPE, DASHBOARD_TYPE, JIRA, PROJECT_ROLE_TYPE } from '../../src/constants'

describe('sortListsFilter', () => {
  let filter: Filter
  let permissionSchemeType: ObjectType
  let permissionSchemeInstance: InstanceElement
  let projectRoleInstance: InstanceElement
  let dashboardInstance: InstanceElement
  let automationInstance: InstanceElement
  let sortedDashboardValues: Values
  let sortedProjectRoleValues: Values
  let sortedPermissionValues: Values
  let sortedAutomationValues: Values
  beforeEach(async () => {
    filter = sortListsFilter(getFilterParams())

    const projectRoleType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_ROLE_TYPE),
      fields: {
        actors: { refType: new ListType(BuiltinTypes.UNKNOWN) },
      },
    })
    projectRoleInstance = new InstanceElement('instance', projectRoleType, {
      actors: [{ displayName: 'c' }, { displayName: 'a' }, { displayName: 'b' }],
    })

    sortedProjectRoleValues = {
      actors: [{ displayName: 'a' }, { displayName: 'b' }, { displayName: 'c' }],
    }

    const dashboardType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_TYPE),
      fields: {
        gadgets: { refType: new ListType(BuiltinTypes.UNKNOWN) },
      },
    })

    dashboardInstance = new InstanceElement('instance', dashboardType, {
      gadgets: [
        new ReferenceExpression(ElemID.fromFullName('adapter.type.instance.c'), {
          value: { position: { column: 1, row: 0 } },
        }),
        new ReferenceExpression(ElemID.fromFullName('adapter.type.instance.a'), {
          value: { position: { column: 0, row: 1 } },
        }),
        new ReferenceExpression(ElemID.fromFullName('adapter.type.instance.b'), {
          value: { position: { column: 0, row: 0 } },
        }),
      ],
    })
    sortedDashboardValues = {
      gadgets: [
        new ReferenceExpression(ElemID.fromFullName('adapter.type.instance.b'), {
          value: { position: { column: 0, row: 0 } },
        }),
        new ReferenceExpression(ElemID.fromFullName('adapter.type.instance.a'), {
          value: { position: { column: 0, row: 1 } },
        }),
        new ReferenceExpression(ElemID.fromFullName('adapter.type.instance.c'), {
          value: { position: { column: 1, row: 0 } },
        }),
      ],
    }

    permissionSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'PermissionScheme'),
      fields: {
        permissions: { refType: new ListType(BuiltinTypes.UNKNOWN) },
      },
    })

    permissionSchemeInstance = new InstanceElement('instance', permissionSchemeType, {
      permissions: [
        {
          permission: 'A',
        },
        {
          permission: 'A',
          holder: {
            type: 'B',
          },
        },
        {
          permission: 'A',
          holder: {
            type: 'A',
          },
        },
        {
          permission: 'C',
          holder: {
            type: 'A',
            parameter: new ReferenceExpression(new ElemID(JIRA, 'B'), {}),
          },
        },
        {
          permission: 'C',
          holder: {
            type: 'A',
            parameter: new ReferenceExpression(new ElemID(JIRA, 'A'), {}),
          },
        },
        {
          permission: 'B',
        },
      ],
    })

    sortedPermissionValues = {
      permissions: [
        {
          permission: 'A',
          holder: {
            type: 'A',
          },
        },
        {
          permission: 'A',
          holder: {
            type: 'B',
          },
        },
        {
          permission: 'A',
        },
        {
          permission: 'B',
        },
        {
          permission: 'C',
          holder: {
            type: 'A',
            parameter: new ReferenceExpression(new ElemID(JIRA, 'A'), {}),
          },
        },
        {
          permission: 'C',
          holder: {
            type: 'A',
            parameter: new ReferenceExpression(new ElemID(JIRA, 'B'), {}),
          },
        },
      ],
    }
    const automationProjectType = new ObjectType({
      elemID: new ElemID(JIRA, AUTOMATION_PROJECT_TYPE),
      fields: {
        projectId: { refType: BuiltinTypes.STRING },
        projectTypeKey: { refType: BuiltinTypes.STRING },
        value: { refType: BuiltinTypes.STRING },
      },
    })
    const automationType = new ObjectType({
      elemID: new ElemID(JIRA, 'Automation'),
      fields: {
        projects: { refType: new ListType(automationProjectType) },
      },
    })
    automationInstance = new InstanceElement('instance', automationType, {
      projects: [
        {
          projectId: new ReferenceExpression(new ElemID(JIRA, 'Project', 'instance', 'c'), {}),
        },
        {
          projectId: new ReferenceExpression(new ElemID(JIRA, 'Project', 'instance', 'b'), {}),
        },
        {
          projectId: new ReferenceExpression(new ElemID(JIRA, 'Project', 'instance', 'a'), {}),
        },
      ],
    })
    sortedAutomationValues = {
      projects: [
        {
          projectId: new ReferenceExpression(new ElemID(JIRA, 'Project', 'instance', 'a'), {}),
        },
        {
          projectId: new ReferenceExpression(new ElemID(JIRA, 'Project', 'instance', 'b'), {}),
        },
        {
          projectId: new ReferenceExpression(new ElemID(JIRA, 'Project', 'instance', 'c'), {}),
        },
      ],
    }
  })

  describe('onFetch', () => {
    it('should sort the dashboard gadgets', async () => {
      await filter.onFetch?.([dashboardInstance])
      expect(dashboardInstance.value).toEqual(sortedDashboardValues)
    })
    it('should sort the project role actors', async () => {
      await filter.onFetch?.([projectRoleInstance])
      expect(projectRoleInstance.value).toEqual(sortedProjectRoleValues)
    })
    it('should sort the permissions', async () => {
      await filter.onFetch?.([permissionSchemeInstance])
      expect(permissionSchemeInstance.value).toEqual(sortedPermissionValues)
    })
    it('should sort the automation projects', async () => {
      await filter.onFetch?.([automationInstance])
      expect(automationInstance.value).toEqual(sortedAutomationValues)
    })
    it('should do nothing when field is undefined', async () => {
      delete permissionSchemeInstance.value.permissions
      await filter.onFetch?.([permissionSchemeInstance])
      expect(permissionSchemeInstance.value).toEqual({})
    })

    it('should sort inner lists', async () => {
      const type = new ObjectType({
        elemID: new ElemID(JIRA, 'someType'),
        fields: {
          schemes: {
            refType: new ListType(permissionSchemeType),
          },
        },
      })

      const inst = new InstanceElement('instance', type, {
        schemes: [
          {
            permissions: [
              {
                permission: 'B',
              },
              {
                permission: 'A',
              },
            ],
          },
        ],
      })

      await filter.onFetch?.([inst])
      expect(inst.value).toEqual({
        schemes: [
          {
            permissions: [
              {
                permission: 'A',
              },
              {
                permission: 'B',
              },
            ],
          },
        ],
      })
    })
  })
})
