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
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import { mergeListsHandler } from '../../src/fix_elements/merge_lists'
import { TICKET_FIELD_CUSTOM_FIELD_OPTION, TICKET_FIELD_TYPE_NAME, ZENDESK } from '../../src/constants'
import ZendeskClient from '../../src/client/client'
import { DEFAULT_CONFIG, DEPLOY_CONFIG, ZendeskConfig } from '../../src/config'

describe('mergeListsHandler', () => {
  let config: ZendeskConfig
  let client: ZendeskClient
  let elementsSource: ReadOnlyElementsSource
  let clonedTicket: InstanceElement
  let fixedTicket: InstanceElement
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) })
  const customFieldOptionType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_CUSTOM_FIELD_OPTION) })

  const ticketFiled1 = new InstanceElement('ticket1', ticketFieldType, {})
  const ticketFiledOption1 = new InstanceElement('ticket1Option1', customFieldOptionType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(ticketFiled1.elemID, ticketFiled1)],
  })
  const ticketFiledOption2 = new InstanceElement('ticket1Option2', customFieldOptionType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(ticketFiled1.elemID, ticketFiled1)],
  })

  beforeEach(() => {
    clonedTicket = ticketFiled1.clone()
    fixedTicket = ticketFiled1.clone()
    fixedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFiledOption1.elemID, ticketFiledOption1),
      new ReferenceExpression(ticketFiledOption2.elemID, ticketFiledOption2),
    ]
    config = {
      ...DEFAULT_CONFIG,
      [DEPLOY_CONFIG]: { fixParentOption: true },
    }
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    elementsSource = elementSource.createInMemoryElementSource([clonedTicket, ticketFiledOption1, ticketFiledOption2])
  })

  it('Should add missing option to the parent list when the parent is in the elements', async () => {
    clonedTicket.value.custom_field_options = [new ReferenceExpression(ticketFiledOption1.elemID, ticketFiledOption1)]
    // should add ticketFiledOption2
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([clonedTicket])
    expect(fixerRes.fixedElements.length).toEqual(1)
    expect(fixerRes.fixedElements[0]).toEqual(fixedTicket)
    expect(fixerRes.errors.length).toEqual(1)
    expect(fixerRes.errors[0]).toEqual({
      elemID: fixerRes.fixedElements[0].elemID,
      severity: 'Warning',
      message: 'custom_field_options were updated',
      detailedMessage: `ticket_field custom_field_options were updated.
  The following options were added at the end of the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.`,
    })
  })

  it('Should add missing option to the parent list when the parent is not in the elements and another option is', async () => {
    clonedTicket.value.custom_field_options = [new ReferenceExpression(ticketFiledOption1.elemID, ticketFiledOption1)]
    // should add ticketFiledOption2
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([ticketFiledOption1])
    expect(fixerRes.fixedElements.length).toEqual(1)
    expect(fixerRes.fixedElements[0]).toEqual(fixedTicket)
    expect(fixerRes.errors.length).toEqual(1)
    expect(fixerRes.errors[0]).toEqual({
      elemID: fixerRes.fixedElements[0].elemID,
      severity: 'Warning',
      message: 'custom_field_options were updated',
      detailedMessage: `ticket_field custom_field_options were updated.
  The following options were added at the end of the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.`,
    })
  })
  it('Should do nothing if options and parent align', async () => {
    clonedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFiledOption1.elemID, ticketFiledOption1),
      new ReferenceExpression(ticketFiledOption2.elemID, ticketFiledOption2),
    ]
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([clonedTicket])
    expect(fixerRes.fixedElements.length).toEqual(0)
    expect(fixerRes.errors.length).toEqual(0)
  })
  it('Should add missing option to the parent list when the both parent and option are in the elements', async () => {
    clonedTicket.value.custom_field_options = [new ReferenceExpression(ticketFiledOption1.elemID, ticketFiledOption1)]
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([clonedTicket, ticketFiledOption1])
    expect(fixerRes.fixedElements.length).toEqual(1)
    expect(fixerRes.fixedElements[0]).toEqual(fixedTicket)
    expect(fixerRes.errors.length).toEqual(1)
    expect(fixerRes.errors[0]).toEqual({
      elemID: fixerRes.fixedElements[0].elemID,
      severity: 'Warning',
      message: 'custom_field_options were updated',
      detailedMessage: `ticket_field custom_field_options were updated.
  The following options were added at the end of the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.`,
    })
  })
  it('Should do nothing if options are not defined', async () => {
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([clonedTicket])
    expect(fixerRes.fixedElements.length).toEqual(0)
    expect(fixerRes.errors.length).toEqual(0)
  })
  it('Should do nothing if parent is not defined', async () => {
    const clonedTicketFiledOption1 = ticketFiledOption1.clone()
    clonedTicketFiledOption1.annotations = {}
    clonedTicket.value.custom_field_options = [
      new ReferenceExpression(clonedTicketFiledOption1.elemID, clonedTicketFiledOption1),
    ]
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([clonedTicketFiledOption1])
    expect(fixerRes.fixedElements.length).toEqual(0)
    expect(fixerRes.errors.length).toEqual(0)
  })
  it('Should do nothing if flag is false', async () => {
    config = { ...DEFAULT_CONFIG, [DEPLOY_CONFIG]: { fixParentOption: false } }
    clonedTicket.value.custom_field_options = [new ReferenceExpression(ticketFiledOption1.elemID, ticketFiledOption1)]
    // should add ticketFiledOption2
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([clonedTicket])
    expect(fixerRes.fixedElements.length).toEqual(0)
    expect(fixerRes.errors.length).toEqual(0)
  })
  it('Should do nothing to options which are not references', async () => {
    fixedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFiledOption1.elemID, ticketFiledOption1),
      1234,
      new ReferenceExpression(ticketFiledOption2.elemID, ticketFiledOption2),
    ]
    clonedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFiledOption1.elemID, ticketFiledOption1),
      1234,
    ]
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([clonedTicket])
    expect(fixerRes.fixedElements.length).toEqual(1)
    expect(fixerRes.fixedElements[0]).toEqual(fixedTicket)
    expect(fixerRes.errors.length).toEqual(1)
    expect(fixerRes.errors[0]).toEqual({
      elemID: fixerRes.fixedElements[0].elemID,
      severity: 'Warning',
      message: 'custom_field_options were updated',
      detailedMessage: `ticket_field custom_field_options were updated.
  The following options were added at the end of the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.`,
    })
  })
})
