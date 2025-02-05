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
  ChangeValidator,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ISSUE_TYPE_FIELD, PROJECT_FIELD } from '@atlassianlabs/jql-ast'
import { AUTOMATION_TYPE, ISSUE_TYPE_NAME, JIRA, PROJECT_TYPE } from '../../../src/constants'
import { automationIssueTypeValidator } from '../../../src/change_validators/automation/automations_issue_types'
import { createEmptyType, mockClient } from '../../utils'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('automationIssueTypeValidator', () => {
  let elementsSource: ReadOnlyElementsSource
  let validator: ChangeValidator

  let automationType: ObjectType
  let instance: InstanceElement
  let instance2: InstanceElement
  let instance3: InstanceElement
  let multipleProjectsScopeInstance: InstanceElement
  let globalValidInstance: InstanceElement
  let globalInvalidInstance: InstanceElement
  let invalidSingleProjectScopeInstance: InstanceElement
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
    const { client } = mockClient()
    validator = automationIssueTypeValidator(client)

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
      key: 'TESTPROJECT',
      name: 'testProjectInstance',
      issueTypeScheme: new ReferenceExpression(
        testProjectIssueTypeSchemeInstance.elemID,
        testProjectIssueTypeSchemeInstance,
      ),
    })
    someOtherProjectInstance = new InstanceElement('someOtherProject', projectType, {
      key: 'SOMEOTHERPROJECT',
      name: 'someOtherProjectInstance',
      issueTypeScheme: new ReferenceExpression(
        someOtherProjectInstanceIssueTypeSchemeInstance.elemID,
        someOtherProjectInstanceIssueTypeSchemeInstance,
      ),
    })
    testProjectReference = new ReferenceExpression(
      new ElemID(JIRA, PROJECT_TYPE, 'instance', 'testProject'),
      testProjectInstance,
    )
    someOtherProjectReference = new ReferenceExpression(
      new ElemID(JIRA, PROJECT_TYPE, 'instance', 'someOtherProject'),
      someOtherProjectInstance,
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
                  value: someOtherProjectInstance,
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
    }) // this suppose to be valid, multiple projects scope & project value is "current", issue type from other project
    globalValidInstance = new InstanceElement('globalValidInstance', automationType, {
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
                    new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'someValidIssueTypeFromTestProject'),
                  ),
                },
              },
            ],
          },
        },
      ],
    }) // this suppose to be valid, global automation, component with issue type from project, component with current project, component with current issue type
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
    invalidSingleProjectScopeInstance = new InstanceElement('invalidSingleProjectScopeInstance', automationType, {
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
    }) // this suppose to be invalid, single project scope & project value is "current", issue type not from the project referenced
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
      invalidSingleProjectScopeInstance,
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
    expect(await validator(changes, elementsSource)).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidAfterInstance', 'components', '0'),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: someInvalidIssueType to one of the following issue types: https://ori-salto-test.atlassian.net/plugins/servlet/project-config/TESTPROJECT/issuetypes',
      },
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidAfterInstance', 'components', '0'),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: someInvalidIssueType to one of the following issue types: https://ori-salto-test.atlassian.net/plugins/servlet/project-config/TESTPROJECT/issuetypes',
      },
    ])
  })

  it('should return an error when the issue type is not from the relevant project issue type scheme, and the components are nested', async () => {
    const changes = [
      toChange({ after: invalidTwoComponentsInstance }),
      toChange({ after: invalidNestedComponentsInstance }),
    ]
    // should return in total 4 errors - 2 for invalidTwoComponentsInstance, 2 for invalidNestedComponentsInstance, none for instance2
    expect(await validator(changes, elementsSource)).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidTwoComponentsInstance', 'components', '0'),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: someIssueTypeFromAnotherProject to one of the following issue types: https://ori-salto-test.atlassian.net/plugins/servlet/project-config/TESTPROJECT/issuetypes',
      },
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidTwoComponentsInstance', 'components', '1'),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: someIssueTypeFromAnotherProject to one of the following issue types: https://ori-salto-test.atlassian.net/plugins/servlet/project-config/TESTPROJECT/issuetypes',
      },
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidNestedComponentsInstance', 'components', '0'),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: someInvalidIssueType to one of the following issue types: https://ori-salto-test.atlassian.net/plugins/servlet/project-config/SOMEOTHERPROJECT/issuetypes',
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
        ),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: someIssueTypeFromAnotherProject to one of the following issue types: https://ori-salto-test.atlassian.net/plugins/servlet/project-config/TESTPROJECT/issuetypes',
      },
    ])
  })

  it('should return an error when it is a single project scope, the project value is "current", and the issue type is not from the relevant project issue type scheme', async () => {
    const changes = [toChange({ after: invalidSingleProjectScopeInstance })]
    expect(await validator(changes, elementsSource)).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidSingleProjectScopeInstance', 'components', '0'),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: someInvalidIssueType to one of the following issue types: https://ori-salto-test.atlassian.net/plugins/servlet/project-config/TESTPROJECT/issuetypes',
      },
    ])
  })

  it('should return an error for a global automation, when the issue type is not from the relevant project issue type scheme', async () => {
    const changes = [toChange({ after: globalInvalidInstance })]
    expect(await validator(changes, elementsSource)).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'globalInvalidInstance', 'components', '0'),
        severity: 'Error',
        message: 'Cannot deploy automation due to issue types not aligned with the relevant project issue type scheme.',
        detailedMessage:
          'In order to deploy an automation you must use issue types from the relevant project issue type scheme. To fix it, change this issue type: someInvalidIssueType to one of the following issue types: https://ori-salto-test.atlassian.net/plugins/servlet/project-config/TESTPROJECT/issuetypes',
      },
    ])
  })

  it('should not check when the operation is not jira.issue.create', async () => {
    expect(await validator([toChange({ after: instance3 })])).toEqual([])
  })

  it('should not return an error when the issue type is one of the project issue type scheme', async () => {
    expect(await validator([toChange({ after: instance })])).toEqual([])
  })

  it('should not return an error for a single project scope when the issue type is current', async () => {
    expect(await validator([toChange({ after: instanceIssueTypeCurrentValue })])).toEqual([])
  })

  it('should not return an error for a global automation with issue type from the project referenced, and for "current" issue type or "current" project', async () => {
    expect(await validator([toChange({ after: globalValidInstance })])).toEqual([])
  })

  it('should not return an error for a multiple project scope when the project value is "current" or the issue type is "current"', async () => {
    expect(await validator([toChange({ after: multipleProjectsScopeInstance })])).toEqual([])
  })
})
