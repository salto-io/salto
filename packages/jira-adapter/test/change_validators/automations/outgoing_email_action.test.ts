/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, InstanceElement, toChange, StaticFile } from '@salto-io/adapter-api'
import { AUTOMATION_TYPE, JIRA } from '../../../src/constants'
import { outgoingEmailActionContentValidator } from '../../../src/change_validators/automation/outgoing_email_action'

export const HTML_BODY_TEST = '<html><body><h1>Test</h1></body></html>'

describe('outgoingEmailAutomationValidator', () => {
  let automationType: ObjectType
  let instance: InstanceElement
  let invalidAfterInstance: InstanceElement
  let invalidAfterInstance2: InstanceElement
  let invalidAfterInstance3: InstanceElement
  const HTMLcontent = Buffer.from(HTML_BODY_TEST)

  beforeEach(() => {
    automationType = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
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
      components: {
        component: 'ACTION',
        type: 'jira.issue.outgoing.email',
        value: { body: 'test', mimeType: 'text/html' },
      },
    })
    invalidAfterInstance3 = new InstanceElement('invalidAfterInstance3', automationType, {
      name: '4',
      components: {
        component: 'ACTION',
        type: 'jira.issue.outgoing.email',
        value: { body: 'test', mimeType: 'text' },
      },
    })
  })

  it('should return an error when mimeType is wrong', async () => {
    expect(
      await outgoingEmailActionContentValidator([toChange({ before: instance, after: invalidAfterInstance })]),
    ).toEqual([
      {
        elemID: invalidAfterInstance.elemID,
        severity: 'Error',
        message: 'A mimeType of an outgoing email automation action is incorrect.',
        detailedMessage:
          "The outgoing email action of this component: jira.Automation.instance.invalidAfterInstance.components.0 has an invalid mimeType. To resolve it, change its mimeType to 'text/html'.",
      },
    ])
  })

  it('should return an error when the body is not a static file', async () => {
    expect(await outgoingEmailActionContentValidator([toChange({ after: invalidAfterInstance2 })])).toEqual([
      {
        elemID: invalidAfterInstance2.elemID,
        severity: 'Error',
        message: 'A content of an outgoing email automation action is not valid.',
        detailedMessage:
          'The outgoing email action of this component: jira.Automation.instance.invalidAfterInstance2.components.0 has an invalid body content. To resolve it, change it to its previous content.',
      },
    ])
  })

  it('should return both errors when the body&mimetype is not valid', async () => {
    expect(await outgoingEmailActionContentValidator([toChange({ after: invalidAfterInstance3 })])).toEqual([
      {
        elemID: invalidAfterInstance3.elemID,
        severity: 'Error',
        message: 'A mimeType of an outgoing email automation action is incorrect.',
        detailedMessage:
          "The outgoing email action of this component: jira.Automation.instance.invalidAfterInstance3.components.0 has an invalid mimeType. To resolve it, change its mimeType to 'text/html'.",
      },
      {
        elemID: invalidAfterInstance3.elemID,
        severity: 'Error',
        message: 'A content of an outgoing email automation action is not valid.',
        detailedMessage:
          'The outgoing email action of this component: jira.Automation.instance.invalidAfterInstance3.components.0 has an invalid body content. To resolve it, change it to its previous content.',
      },
    ])
  })

  it('should not return an error when mimeType is text/html and body is static file', async () => {
    expect(await outgoingEmailActionContentValidator([toChange({ after: instance })])).toEqual([])
  })
})
