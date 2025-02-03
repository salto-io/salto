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
import { ISSUE_TYPE_FIELD, PROJECT_FIELD } from '@atlassianlabs/jql-ast'
import { AUTOMATION_TYPE, ISSUE_TYPE_NAME, JIRA, PROJECT_TYPE } from '../../../src/constants'
import { automationIssueTypeValidator } from '../../../src/change_validators/automation/automations_issue_types'
import { createEmptyType } from '../../utils'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('automationIssueTypeValidator', () => {
  let elementsSource: ReadOnlyElementsSource

  let automationType: ObjectType
  let instance: InstanceElement
  let instance2: InstanceElement
  let instance3: InstanceElement
  let multipleProjectsScopeInstance: InstanceElement
  let globalValidInstance: InstanceElement
  let globalInvalidInstance: InstanceElement
  let invalidInstance: InstanceElement
  let invalidTwoComponentsInstance: InstanceElement
  let invalidNestedComponentsInstance: InstanceElement
  let invalidAfterInstance: InstanceElement
  let instanceIssueTypeCurrentValue: InstanceElement

  let projectType: ObjectType
  let testProjectInstance: InstanceElement
  let someOtherProjectInstance: InstanceElement
  let testProjectReference: ReferenceExpression
  let someOtherProjectReference: ReferenceExpression

  let issueTypeSchemeType: ObjectType
  let testProjectIssueTypeSchemeInstance: InstanceElement
  let someOtherProjectInstanceIssueTypeSchemeInstance: InstanceElement

  beforeEach(() => {
    issueTypeSchemeType = createEmptyType('IssueTypeScheme')
    const testProjectIssueTypesReference = [
      new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someValidIssueTypeFromTestProject')),
      new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'moreIssueType')),
    ]
    const someOtherProjectIssueTypesReference = [
      new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someIssueTypeFromAnotherProject')),
      new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'moreAndMoreIssueType')),
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
    testProjectInstance = new InstanceElement('testProject', projectType, {
      name: 'testProjectInstance',
      issueTypeScheme: new ReferenceExpression(
        testProjectIssueTypeSchemeInstance.elemID,
        testProjectIssueTypeSchemeInstance,
      ),
    })
    someOtherProjectInstance = new InstanceElement('someOtherProject', projectType, {
      name: 'someOtherProjectInstance',
      issueTypeScheme: new ReferenceExpression(
        someOtherProjectInstanceIssueTypeSchemeInstance.elemID,
        someOtherProjectInstanceIssueTypeSchemeInstance,
      ),
    })
    testProjectReference = new ReferenceExpression(
      new ElemID(JIRA, PROJECT_TYPE, 'instance', 'testProject'),
      new ReferenceExpression(testProjectInstance.elemID, testProjectInstance),
    )
    someOtherProjectReference = new ReferenceExpression(
      new ElemID(JIRA, PROJECT_TYPE, 'instance', 'someOtherProject'),
      new ReferenceExpression(someOtherProjectInstance.elemID, someOtherProjectInstance),
    )

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
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someValidIssueTypeFromTestProject'),
                  ),
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectReference,
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
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someValidIssueTypeFromTestProject'),
                  ),
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: someOtherProjectReference,
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
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someIssueTypeFromAnotherProject'),
                  ),
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectReference,
        },
        {
          projectId: someOtherProjectReference,
        },
      ],
    }) // this suppose to be valid, not a 'issue.create' action
    multipleProjectsScopeInstance = new InstanceElement('multipleProjectsScopeInstance', automationType, {
      name: '4',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.condition',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: 'current',
                  type: 'COPY',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'notFromProjectsIssueType'),
                  ),
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectReference,
        },
        {
          projectId: someOtherProjectReference,
        },
      ],
    }) // this suppose to be valid, multiple projects scope & project value is "current", issue type from other project
    globalValidInstance = new InstanceElement('globalInstance', automationType, {
      name: '4',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someValidIssueTypeFromTestProject'),
                  ),
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
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: 'current',
                  type: 'COPY',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'COPY',
                  value: 'current',
                },
              },
            ],
          },
        },
      ],
    }) // this suppose to be valid, global automation, component with issue type from project, component with current project & issue type
    globalInvalidInstance = new InstanceElement('globalInvalidInstance', automationType, {
      name: '4',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someInvalidIssueType')),
                },
              },
            ],
          },
        },
      ],
    }) // this suppose to be valid, global automation, issue type from other project
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
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'COPY',
                  value: 'current',
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectReference,
        },
        {
          projectId: someOtherProjectReference,
        },
      ],
    }) // this suppose to be valid, single project scope, current issue type
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
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_FIELD, 'instance', 'someInvalidIssueType'),
                  ),
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectReference,
        },
      ],
    }) // this suppose to be invalid, issue type not from the project referenced
    invalidInstance = new InstanceElement('invalidInstance', automationType, {
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
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: 'current',
                  type: 'COPY',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_FIELD, 'instance', 'someInvalidIssueType'),
                  ),
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectReference,
        },
      ],
    }) // this suppose to be invalid, single projects scope & project value is "current", issue type not from the project referenced
    invalidTwoComponentsInstance = new InstanceElement('invalidTwoComponentsInstance', automationType, {
      name: 'invalidTwoComponentsInstance',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someIssueTypeFromAnotherProject'),
                  ),
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
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: testProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someIssueTypeFromAnotherProject'),
                  ),
                },
              },
            ],
          },
        },
      ],
      projects: [
        {
          projectId: testProjectReference,
        },
        {
          projectId: someOtherProjectReference,
        },
      ],
    }) // this suppose to be invalid, two 'issue.create' components with issue type from another project from 'projects'
    invalidNestedComponentsInstance = new InstanceElement('invalidNestedComponentsInstance', automationType, {
      name: 'invalidNestedComponentsInstance',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project')),
                },
                fieldType: PROJECT_FIELD,
                type: 'SET',
                value: {
                  value: someOtherProjectReference,
                  type: 'ID',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: new ReferenceExpression(
                    new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                  ),
                },
                fieldType: ISSUE_TYPE_FIELD,
                type: 'SET',
                value: {
                  type: 'ID',
                  value: new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someInvalidIssueType')),
                },
              },
            ],
          },
        },
        {
          component: 'CONDITION',
          type: 'jira.condition.container.block',
          children: [
            {
              component: 'CONDITION',
              type: 'jira.condition.if.block',
              children: [
                {
                  component: 'ACTION',
                  type: 'jira.issue.create',
                  value: {
                    operations: [
                      {
                        field: {
                          type: 'ID',
                          value: new ReferenceExpression(
                            new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project'),
                          ),
                        },
                        fieldType: PROJECT_FIELD,
                        type: 'SET',
                        value: {
                          value: testProjectReference,
                          type: 'ID',
                        },
                      },
                      {
                        field: {
                          type: 'ID',
                          value: new ReferenceExpression(
                            new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                          ),
                        },
                        fieldType: ISSUE_TYPE_FIELD,
                        type: 'SET',
                        value: {
                          type: 'ID',
                          value: new ReferenceExpression(
                            new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'moreIssueType'),
                          ),
                        },
                      },
                    ],
                  },
                },
              ],
            },
            {
              component: 'CONDITION',
              type: 'jira.condition.else.block',
              children: [
                {
                  component: 'ACTION',
                  type: 'jira.issue.create',
                  value: {
                    operations: [
                      {
                        field: {
                          type: 'ID',
                          value: new ReferenceExpression(
                            new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project'),
                          ),
                        },
                        fieldType: PROJECT_FIELD,
                        type: 'SET',
                        value: {
                          value: testProjectReference,
                          type: 'ID',
                        },
                      },
                      {
                        field: {
                          type: 'ID',
                          value: new ReferenceExpression(
                            new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Issue_Type__issuetype@suu'),
                          ),
                        },
                        fieldType: ISSUE_TYPE_FIELD,
                        type: 'SET',
                        value: {
                          type: 'ID',
                          value: new ReferenceExpression(
                            new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someIssueTypeFromAnotherProject'),
                          ),
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
      projects: [
        {
          projectId: testProjectReference,
        },
        {
          projectId: someOtherProjectReference,
        },
      ],
    }) // this suppose to be invalid, nested 'issue.create' components with issue type not from the project

    elementsSource = buildElementsSourceFromElements([
      instance,
      instance2,
      instance3,
      multipleProjectsScopeInstance,
      instanceIssueTypeCurrentValue,
      invalidInstance,
      invalidAfterInstance,
      invalidTwoComponentsInstance,
      invalidNestedComponentsInstance,
      globalValidInstance,
      globalInvalidInstance,
      testProjectInstance,
      someOtherProjectInstance,
      testProjectIssueTypeSchemeInstance,
      someOtherProjectInstanceIssueTypeSchemeInstance,
    ])
  })

  it('should return an error when the issue type is not from the relevant project issue type scheme', async () => {
    const changes = [
      toChange({ after: invalidAfterInstance }),
      toChange({ before: instance, after: invalidAfterInstance }),
      toChange({ after: instance2 }), // valid
    ]
    // should return in 2 errors for invalidAfterInstance, none for instance2
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
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: someInvalidIssueType',
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
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: someInvalidIssueType',
      },
    ])
  })

  it('should return an error when the issue type is not from the relevant project issue type scheme, and the components are nested', async () => {
    const changes = [
      toChange({ after: invalidTwoComponentsInstance }),
      toChange({ after: invalidNestedComponentsInstance }),
    ]
    // should return in total 4 errors - 2 for invalidInstance, 2 for invalidNestedComponentsInstance, none for instance2
    expect(await automationIssueTypeValidator(changes, elementsSource)).toEqual([
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'invalidTwoComponentsInstance',
          'components',
          '0',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: someIssueTypeFromAnotherProject',
      },
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'invalidTwoComponentsInstance',
          'components',
          '1',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: someIssueTypeFromAnotherProject',
      },
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'invalidNestedComponentsInstance',
          'components',
          '0',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: someInvalidIssueType',
      },
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'invalidNestedComponentsInstance',
          'components',
          '1',
          'children',
          '1',
          'children',
          '0',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: someIssueTypeFromAnotherProject',
      },
    ])
  })

  it('should return an error when the issue type is not from the relevant project issue type scheme, and the project value is "current"', async () => {
    const changes = [toChange({ after: invalidInstance })]
    expect(await automationIssueTypeValidator(changes, elementsSource)).toEqual([
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
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: someInvalidIssueType',
      },
    ])
  })

  it('should return an error for a global automation, when the issue type is not from the relevant project issue type scheme', async () => {
    const changes = [toChange({ after: globalInvalidInstance })]
    expect(await automationIssueTypeValidator(changes, elementsSource)).toEqual([
      {
        elemID: new ElemID(
          'jira',
          'Automation',
          'instance',
          'globalInvalidInstance',
          'components',
          '0',
          'value',
          'operations',
          '1',
        ),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project type issue scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue scheme. To fix it, change this issue type: someInvalidIssueType',
      },
    ])
  })

  it('should not check when the operation is not jira.issue.create', async () => {
    expect(await automationIssueTypeValidator([toChange({ after: instance3 })])).toEqual([])
  })

  it('should not return an error when the issue type is one of the project issue type scheme', async () => {
    expect(await automationIssueTypeValidator([toChange({ after: instance })])).toEqual([])
  })

  it('should not return an error for a single project scope when the issue type is current', async () => {
    expect(await automationIssueTypeValidator([toChange({ after: instanceIssueTypeCurrentValue })])).toEqual([])
  })

  it('should not return an error for a global automation with issue type from the project referenced, and for "current" issue type and project', async () => {
    expect(await automationIssueTypeValidator([toChange({ after: globalValidInstance })])).toEqual([])
  })

  it('should not return an error for a multiple project scope when the project value is "current"', async () => {
    expect(await automationIssueTypeValidator([toChange({ after: multipleProjectsScopeInstance })])).toEqual([])
  })
})
