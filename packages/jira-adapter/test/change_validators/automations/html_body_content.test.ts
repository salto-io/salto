/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, InstanceElement, toChange, StaticFile, ElemID } from '@salto-io/adapter-api'
import { AUTOMATION_TYPE } from '../../../src/constants'
import { htmlBodyContentValidator } from '../../../src/change_validators/automation/html_body_content'
import { createEmptyType } from '../../utils'

export const HTML_BODY_TEST = '<html><body><h1>Test</h1></body></html>'

describe('htmlBodyContentAutomationValidator', () => {
  let automationType: ObjectType
  let instance: InstanceElement
  let invalidAfterInstance: InstanceElement
  let invalidAfterInstance2: InstanceElement
  let invalidAfterInstance3: InstanceElement
  let invalidAfterInstance4: InstanceElement
  let invalidAfterInstance5: InstanceElement

  const HTMLcontent = Buffer.from(HTML_BODY_TEST)

  beforeEach(() => {
    automationType = createEmptyType(AUTOMATION_TYPE)
    instance = new InstanceElement('instance', automationType, {
      name: '1',
      components: {
        component: 'ACTION',
        type: 'jira.issue.outgoing.email',
        value: {
          body: new StaticFile({
            filepath: 'test_path1.html',
            content: HTMLcontent,
          }),
          mimeType: 'text/html',
        },
      },
    })
    invalidAfterInstance = new InstanceElement('invalidAfterInstance', automationType, {
      name: '2',
      components: {
        component: 'ACTION',
        type: 'jira.issue.outgoing.email',
        value: {
          body: new StaticFile({
            filepath: 'test_path2.html',
            content: HTMLcontent,
          }),
          mimeType: 'text',
        },
      },
    })
    invalidAfterInstance2 = new InstanceElement('invalidAfterInstance2', automationType, {
      name: '3',
      components: [
        {
          component: 'CONDITION',
          type: 'jira.user.condition',
          value: { conditions: [] },
        },
        {
          component: 'ACTION',
          type: 'jira.issue.outgoing.email',
          value: { body: 'test', mimeType: 'text/html' },
        },
      ],
    })
    invalidAfterInstance3 = new InstanceElement('invalidAfterInstance3', automationType, {
      name: '4',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.outgoing.email',
          value: { body: 'test', mimeType: 'text/html' },
        },
        {
          component: 'CONDITION',
          type: 'jira.user.condition',
          value: { conditions: [] },
        },
      ],
    })
    invalidAfterInstance4 = new InstanceElement('invalidAfterInstance4', automationType, {
      name: '5',
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.outgoing.email',
          value: { body: 'test', mimeType: 'text/html' },
        },
        {
          component: 'ACTION',
          type: 'jira.issue.outgoing.email',
          value: {
            body: new StaticFile({
              filepath: 'test_path3.html',
              content: HTMLcontent,
            }),
            mimeType: 'text',
          },
        },
        {
          component: 'ACTION',
          type: 'jira.issue.outgoing.email',
          value: {
            body: new StaticFile({
              filepath: 'test_path3.html',
              content: HTMLcontent,
            }),
            mimeType: 'text/html',
          },
        },
      ],
    })
    invalidAfterInstance5 = new InstanceElement('invalidAfterInstance5', automationType, {
      name: '6',
      components: {
        component: 'CONDITION',
        type: 'jira.condition.container.block',
        children: {
          component: 'ACTION',
          type: 'jira.issue.outgoing.email',
          value: {
            body: 'test',
            mimeType: 'text/html',
          },
        },
      },
    })
  })

  it('should return an error when mimeType is wrong', async () => {
    expect(await htmlBodyContentValidator([toChange({ before: instance, after: invalidAfterInstance })])).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidAfterInstance.components'),
        severity: 'Error',
        message: 'A mimeType of an automation action is incorrect.',
        detailedMessage:
          "The action in component: jira.Automation.instance.invalidAfterInstance.components has an invalid mimeType. To resolve this, change the mimeType to 'text/html'.",
      },
    ])
  })

  it('should return an error when the body is not a static file', async () => {
    expect(await htmlBodyContentValidator([toChange({ after: invalidAfterInstance2 })])).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidAfterInstance2.components.1'),
        severity: 'Error',
        message: 'A content of an automation action is not valid.',
        detailedMessage:
          'The body content of this action component: jira.Automation.instance.invalidAfterInstance2.components.1 is invalid. It appears that this component with mimeType "text/html" was modified to an unexpected body content type. To resolve this, revert the file to its original static file format.',
      },
    ])
  })

  it('should return both errors when the body&mimetype is not valid', async () => {
    const changes = [toChange({ after: invalidAfterInstance3 }), toChange({ after: instance })]
    expect(await htmlBodyContentValidator(changes)).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidAfterInstance3.components.0'),
        severity: 'Error',
        message: 'A content of an automation action is not valid.',
        detailedMessage:
          'The body content of this action component: jira.Automation.instance.invalidAfterInstance3.components.0 is invalid. It appears that this component with mimeType "text/html" was modified to an unexpected body content type. To resolve this, revert the file to its original static file format.',
      },
    ])
  })

  it('should return errors for an instance with more than one invalid body html content components', async () => {
    expect(await htmlBodyContentValidator([toChange({ after: invalidAfterInstance4 })])).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidAfterInstance4.components.0'),
        severity: 'Error',
        message: 'A content of an automation action is not valid.',
        detailedMessage:
          'The body content of this action component: jira.Automation.instance.invalidAfterInstance4.components.0 is invalid. It appears that this component with mimeType "text/html" was modified to an unexpected body content type. To resolve this, revert the file to its original static file format.',
      },
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidAfterInstance4.components.1'),
        severity: 'Error',
        message: 'A mimeType of an automation action is incorrect.',
        detailedMessage:
          "The action in component: jira.Automation.instance.invalidAfterInstance4.components.1 has an invalid mimeType. To resolve this, change the mimeType to 'text/html'.",
      },
    ])
  })

  it('should return an error when the component is a children of another component', async () => {
    expect(await htmlBodyContentValidator([toChange({ after: invalidAfterInstance5 })])).toEqual([
      {
        elemID: new ElemID('jira', 'Automation', 'instance', 'invalidAfterInstance5.components.children'),
        severity: 'Error',
        message: 'A content of an automation action is not valid.',
        detailedMessage:
          'The body content of this action component: jira.Automation.instance.invalidAfterInstance5.components.children is invalid. It appears that this component with mimeType "text/html" was modified to an unexpected body content type. To resolve this, revert the file to its original static file format.',
      },
    ])
  })

  it('should not return an error when mimeType is text/html and body is static file', async () => {
    expect(await htmlBodyContentValidator([toChange({ after: instance })])).toEqual([])
  })
})
