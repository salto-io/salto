/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import {
  AUTOMATION_PROJECT_TYPE,
  DASHBOARD_TYPE,
  JIRA,
  PERMISSION_SCHEME_TYPE_NAME,
  PROJECT_ROLE_TYPE,
} from '../../src/constants'

describe('sortListsFilter', () => {
  let filter: Filter
  let permissionSchemeType: ObjectType
  let permissionSchemeInstance: InstanceElement
  let projectRoleInstance: InstanceElement
  let dashboardInstance: InstanceElement
  let automationInstance: InstanceElement
  let workflowInstance: InstanceElement
  let sortedDashboardValues: Values
  let sortedProjectRoleValues: Values
  let sortedPermissionValues: Values
  let sortedAutomationValues: Values
  let sortedWorkflowValues: Values
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
      collaborators: [
        '712020:386ad937-3ff4-437e-ab8e-07d08d3703ed',
        '5d53f3cbc6b9320d9ea5bdc2',
        '63a22fb348b367d78a14c15b',
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
      collaborators: [
        '5d53f3cbc6b9320d9ea5bdc2',
        '63a22fb348b367d78a14c15b',
        '712020:386ad937-3ff4-437e-ab8e-07d08d3703ed',
      ],
    }
    const workflowType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowConfiguration'),
      fields: {
        transitions: {
          refType: new ListType(
            new ObjectType({
              elemID: new ElemID(JIRA, 'WorkflowTransitions'),
              fields: {
                links: {
                  refType: new ListType(
                    new ObjectType({
                      elemID: new ElemID(JIRA, 'WorkflowTransitionLinks'),
                      fields: {
                        fromStatusReference: { refType: BuiltinTypes.NUMBER },
                        toPort: { refType: BuiltinTypes.STRING },
                        fromPort: { refType: BuiltinTypes.NUMBER },
                      },
                    }),
                  ),
                },
              },
            }),
          ),
        },
        notExisting: {
          refType: new ObjectType({
            elemID: new ElemID(JIRA, 'NotExisting'),
            fields: {
              notExistingInner: { refType: new ListType(BuiltinTypes.STRING) },
            },
          }),
        },
      },
    })

    workflowInstance = new InstanceElement('instance', workflowType, {
      transitions: [
        {
          links: [
            {
              fromStatusReference: 2,
              toPort: 'A',
              fromPort: 1,
            },
            {
              fromStatusReference: 1,
              toPort: 'B',
              fromPort: 2,
            },
          ],
        },
      ],
    })
    sortedWorkflowValues = {
      transitions: [
        {
          links: [
            {
              fromStatusReference: 1,
              toPort: 'B',
              fromPort: 2,
            },
            {
              fromStatusReference: 2,
              toPort: 'A',
              fromPort: 1,
            },
          ],
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
    it('should sort the automation projects and collaborators', async () => {
      await filter.onFetch?.([automationInstance])
      expect(automationInstance.value).toEqual(sortedAutomationValues)
    })
    it('should do nothing when field is undefined', async () => {
      delete permissionSchemeInstance.value.permissions
      await filter.onFetch?.([permissionSchemeInstance])
      expect(permissionSchemeInstance.value).toEqual({})
    })
    it('should sort workflow links', async () => {
      await filter.onFetch?.([workflowInstance])
      expect(workflowInstance.value).toEqual(sortedWorkflowValues)
    })
    it('should sort workflows with missing fields', async () => {
      delete workflowInstance.value.transitions[0].links[0].fromStatusReference
      delete workflowInstance.value.transitions[0].links[1].fromPort
      delete sortedWorkflowValues.transitions[0].links[1].fromStatusReference
      delete sortedWorkflowValues.transitions[0].links[0].fromPort

      await filter.onFetch?.([workflowInstance])
      expect(workflowInstance.value).toEqual(sortedWorkflowValues)
    })

    it('should sort inner lists', async () => {
      const type = new ObjectType({
        elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME),
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

    it('should not sort inner lists if type not in supported-type list', async () => {
      const type = new ObjectType({
        elemID: new ElemID(JIRA, 'some_type'),
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
                permission: 'B',
              },
              {
                permission: 'A',
              },
            ],
          },
        ],
      })
    })

    it('should not fail for fields that are not defined in the sport list map', async () => {
      workflowInstance.value.notExisting = { notExistingInner: ['a', 'b'] }
      await filter.onFetch?.([workflowInstance])
      expect(workflowInstance.value.notExisting.notExistingInner).toEqual(['a', 'b'])
    })
  })
})
