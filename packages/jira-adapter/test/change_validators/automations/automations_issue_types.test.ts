/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  InstanceElement,
  toChange,
  ReadOnlyElementsSource,
  ElemID,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE } from '../../../src/constants'
import { automationIssueTypeValidator } from '../../../src/change_validators/automation/automations_issue_types'
import { createEmptyType } from '../../utils'

describe('automationIssueTypeValidator', () => {
  let elementsSource: ReadOnlyElementsSource

  let automationType: ObjectType
  let instance: InstanceElement
  let instance2: InstanceElement
  let instance3: InstanceElement
  let invalidInstance: InstanceElement
  let invalidAfterInstance: InstanceElement
  let instanceIssueTypeCurrentValue: InstanceElement

  let projectType: ObjectType
  let testProjectInstance: InstanceElement
  let someOtherProjectInstance: InstanceElement

  let issueTypeSchemeType: ObjectType
  let testProjectIssueTypeSchemeInstance: InstanceElement
  let someOtherProjectInstanceIssueTypeSchemeInstance: InstanceElement

  beforeEach(() => {
    issueTypeSchemeType = createEmptyType('IssueTypeScheme')
    const testProjectIssueTypesReference = [
      new ReferenceExpression(new ElemID('jira', 'IssueType', 'instance', 'someValidIssueTypeFromTestProject')),
      new ReferenceExpression(new ElemID('jira', 'IssueType', 'instance', 'moreIssueType')),
    ]
    const someOtherProjectIssueTypesReference = [
      new ReferenceExpression(new ElemID('jira', 'IssueType', 'instance', 'someIssueTypeFromAnotherProject')),
      new ReferenceExpression(new ElemID('jira', 'IssueType', 'instance', 'moreAndMoreIssueType')),
    ]
    testProjectIssueTypeSchemeInstance = new InstanceElement(
      'testProjectIssueTypeSchemeInstance',
      issueTypeSchemeType,
      {
        issueTypeIds: testProjectIssueTypesReference,
      },
    )
    someOtherProjectInstanceIssueTypeSchemeInstance = new InstanceElement(
      'someOtherProjectInstanceIssueTypeSchemeInstance',
      issueTypeSchemeType,
      {
        issueTypeIds: someOtherProjectIssueTypesReference,
      },
    )

    projectType = createEmptyType('Project')
    testProjectInstance = new InstanceElement('testProjectInstance', projectType, {
      name: 'testProjectInstance',
      issueTypeScheme: new ReferenceExpression(
        testProjectIssueTypeSchemeInstance.elemID,
        testProjectIssueTypeSchemeInstance,
      ),
    })
    someOtherProjectInstance = new InstanceElement('someOtherProjectInstance', projectType, {
      name: 'someOtherProjectInstance',
      issueTypeScheme: new ReferenceExpression(
        someOtherProjectInstanceIssueTypeSchemeInstance.elemID,
        someOtherProjectInstanceIssueTypeSchemeInstance,
      ),
    })

    automationType = createEmptyType(AUTOMATION_TYPE)
    instance = new InstanceElement('instance', automationType, {
      name: '1',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Project__project',
                },
                fieldType: 'project',
                type: 'SET',
                value: {
                  value: testProjectInstance,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Issue_Type__issuetype@suu',
                },
                fieldType: 'issuetype',
                type: 'SET',
                value: {
                  type: 'ID',
                  value: { elemID: new ElemID('jira.IssueType.instance.someValidIssueTypeFromTestProject') },
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectInstance,
        },
      ],
    }) // this suppose to be valid, issue type from project & this is the project under 'projects'
    instance2 = new InstanceElement('instance2', automationType, {
      name: '2',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Project__project',
                },
                fieldType: 'project',
                type: 'SET',
                value: {
                  value: testProjectInstance,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Issue_Type__issuetype@suu',
                },
                fieldType: 'issuetype',
                type: 'SET',
                value: {
                  type: 'ID',
                  value: { elemID: new ElemID('jira.IssueType.instance.someValidIssueTypeFromTestProject') },
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: someOtherProjectInstance,
        },
      ],
    }) // this suppose to be valid, issue type from project & this is not a project under 'projects'
    instance3 = new InstanceElement('instance3', automationType, {
      name: '3',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.condition',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Project__project',
                },
                fieldType: 'project',
                type: 'SET',
                value: {
                  value: testProjectInstance,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Issue_Type__issuetype@suu',
                },
                fieldType: 'issuetype',
                type: 'SET',
                value: {
                  type: 'ID',
                  value: { elemID: new ElemID('jira.IssueType.instance.someIssueTypeFromAnotherProject') },
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectInstance,
        },
        {
          projectId: someOtherProjectInstance,
        },
      ],
    }) // this suppose to be valid, not a 'issue.create' action
    invalidInstance = new InstanceElement('invalidInstance', automationType, {
      name: 'invalidInstance',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Project__project',
                },
                fieldType: 'project',
                type: 'SET',
                value: {
                  value: testProjectInstance,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Issue_Type__issuetype@suu',
                },
                fieldType: 'issuetype',
                type: 'SET',
                value: {
                  type: 'ID',
                  value: { elemID: new ElemID('jira.IssueType.instance.someIssueTypeFromAnotherProject') },
                },
              },
            ],
          },
        },
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Project__project',
                },
                fieldType: 'project',
                type: 'SET',
                value: {
                  value: testProjectInstance,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Issue_Type__issuetype@suu',
                },
                fieldType: 'issuetype',
                type: 'SET',
                value: {
                  type: 'ID',
                  value: { elemID: new ElemID('jira.IssueType.instance.someIssueTypeFromAnotherProject') },
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectInstance,
        },
        {
          projectId: someOtherProjectInstance,
        },
      ],
    }) // this suppose to be invalid, issue type from another project
    instanceIssueTypeCurrentValue = new InstanceElement('instanceIssueTypeCurrentValue', automationType, {
      name: '1',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Project__project',
                },
                fieldType: 'project',
                type: 'SET',
                value: {
                  value: testProjectInstance,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Issue_Type__issuetype@suu',
                },
                fieldType: 'issuetype',
                type: 'SET',
                value: {
                  type: 'ID',
                  value: 'current',
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectInstance,
        },
        {
          projectId: someOtherProjectInstance,
        },
      ],
    }) // this suppose to be valid, current issue type
    invalidAfterInstance = new InstanceElement('invalidAfterInstance', automationType, {
      name: '1',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Project__project',
                },
                fieldType: 'project',
                type: 'SET',
                value: {
                  value: testProjectInstance,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: 'jira.Field.instance.Issue_Type__issuetype@suu',
                },
                fieldType: 'issuetype',
                type: 'SET',
                value: {
                  type: 'ID',
                  value: { elemID: new ElemID('jira.IssueType.instance.someInvalidIssueType') },
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectInstance,
        },
      ],
    }) // this suppose to be invalid, issue type not from the project referred

    elementsSource = buildElementsSourceFromElements([
      instance,
      instance2,
      instance3,
      invalidInstance,
      instanceIssueTypeCurrentValue,
      invalidAfterInstance,
      testProjectInstance,
      someOtherProjectInstance,
      testProjectIssueTypeSchemeInstance,
      someOtherProjectInstanceIssueTypeSchemeInstance,
    ])
  })

  it('should return an error when the issue type is not from the project issue type scheme', async () => {
    const changes = [
      toChange({ after: invalidAfterInstance }),
      toChange({ before: instance, after: invalidAfterInstance }),
      toChange({ after: invalidInstance }),
      toChange({ after: instance2 }),
    ]
    expect(await automationIssueTypeValidator(changes, elementsSource)).toEqual([
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'invalidAfterInstance',
          'components',
          '0',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message:
          'Cannot deploy automation due to issue types not aligned with the automation project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the automation project issue scheme. To fix it, change this issue type: jira.IssueType.instance.someInvalidIssueType',
      },
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'invalidAfterInstance',
          'components',
          '0',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message:
          'Cannot deploy automation due to issue types not aligned with the automation project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the automation project issue scheme. To fix it, change this issue type: jira.IssueType.instance.someInvalidIssueType',
      },
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'invalidInstance',
          'components',
          '0',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message:
          'Cannot deploy automation due to issue types not aligned with the automation project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the automation project issue scheme. To fix it, change this issue type: jira.IssueType.instance.someIssueTypeFromAnotherProject',
      },
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'invalidInstance',
          'components',
          '1',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message:
          'Cannot deploy automation due to issue types not aligned with the automation project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the automation project issue scheme. To fix it, change this issue type: jira.IssueType.instance.someIssueTypeFromAnotherProject',
      },
    ])
  })

  it('should not check when the operation is not jira.issue.create', async () => {
    expect(await automationIssueTypeValidator([toChange({ after: instance3 })])).toEqual([])
  })

  it('should not return an error when the issue type is one of the project issue type scheme', async () => {
    expect(await automationIssueTypeValidator([toChange({ after: instance })])).toEqual([])
  })

  it('should not return an error when the issue type is current', async () => {
    expect(await automationIssueTypeValidator([toChange({ after: instanceIssueTypeCurrentValue })])).toEqual([])
  })
})
