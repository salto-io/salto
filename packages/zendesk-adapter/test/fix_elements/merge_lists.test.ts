/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { DEFAULT_CONFIG, FIX_ELEMENTS_CONFIG, OldZendeskConfig } from '../../src/config'

describe('mergeListsHandler', () => {
  let config: OldZendeskConfig
  let client: ZendeskClient
  let elementsSource: ReadOnlyElementsSource
  let clonedTicket: InstanceElement
  let fixedTicket: InstanceElement
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) })
  const customFieldOptionType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_CUSTOM_FIELD_OPTION) })

  const ticketField1 = new InstanceElement('ticket1', ticketFieldType, {})
  const ticketFieldOption1 = new InstanceElement('ticket1Option1', customFieldOptionType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(ticketField1.elemID, ticketField1)],
  })
  const ticketFieldOption2 = new InstanceElement('ticket1Option2', customFieldOptionType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(ticketField1.elemID, ticketField1)],
  })

  beforeEach(() => {
    clonedTicket = ticketField1.clone()
    fixedTicket = ticketField1.clone()
    fixedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
      new ReferenceExpression(ticketFieldOption2.elemID),
    ]
    config = {
      ...DEFAULT_CONFIG,
      [FIX_ELEMENTS_CONFIG]: { ...DEFAULT_CONFIG[FIX_ELEMENTS_CONFIG], mergeLists: true },
    } as OldZendeskConfig
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    elementsSource = elementSource.createInMemoryElementSource([clonedTicket, ticketFieldOption1, ticketFieldOption2])
  })

  it('Should add missing option to the parent list when the parent is in the elements', async () => {
    clonedTicket.value.custom_field_options = [new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1)]
    // should add ticketFieldOption2
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
      message: 'The list of custom field options was automatically updated',
      detailedMessage:
        '\nThe following custom field options were added at the end of the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.',
    })
  })
  it('Should remove options from the parent list when it does not appear in the elementsSource', async () => {
    clonedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
      new ReferenceExpression(ticketFieldOption2.elemID, ticketFieldOption2),
    ]
    fixedTicket.value.custom_field_options = [new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1)]
    elementsSource = elementSource.createInMemoryElementSource([clonedTicket, ticketFieldOption1])
    // should remove ticketFieldOption2
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
      message: 'The list of custom field options was automatically updated',
      detailedMessage:
        '\nThe following custom field options were removed from the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.',
    })
  })

  it('Should add missing option to the parent list when the parent is not in the elements and another option is', async () => {
    clonedTicket.value.custom_field_options = [new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1)]
    // should add ticketFieldOption2
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([ticketFieldOption1])
    expect(fixerRes.fixedElements.length).toEqual(1)
    expect(fixerRes.fixedElements[0]).toEqual(fixedTicket)
    expect(fixerRes.errors.length).toEqual(1)
    expect(fixerRes.errors[0]).toEqual({
      elemID: fixerRes.fixedElements[0].elemID,
      severity: 'Warning',
      message: 'The list of custom field options was automatically updated',
      detailedMessage:
        '\nThe following custom field options were added at the end of the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.',
    })
  })
  it('Should do nothing if options and parent align', async () => {
    clonedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
      new ReferenceExpression(ticketFieldOption2.elemID, ticketFieldOption2),
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
    clonedTicket.value.custom_field_options = [new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1)]
    const fixerRes = await mergeListsHandler({
      elementsSource,
      config,
      client,
    })([clonedTicket, ticketFieldOption1])
    expect(fixerRes.fixedElements.length).toEqual(1)
    expect(fixerRes.fixedElements[0]).toEqual(fixedTicket)
    expect(fixerRes.errors.length).toEqual(1)
    expect(fixerRes.errors[0]).toEqual({
      elemID: fixerRes.fixedElements[0].elemID,
      severity: 'Warning',
      message: 'The list of custom field options was automatically updated',
      detailedMessage:
        '\nThe following custom field options were added at the end of the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.',
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
    const clonedTicketFiledOption1 = ticketFieldOption1.clone()
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
  it('Should do nothing to options which are not references', async () => {
    fixedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
      1234,
      new ReferenceExpression(ticketFieldOption2.elemID),
    ]
    clonedTicket.value.custom_field_options = [
      new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
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
      message: 'The list of custom field options was automatically updated',
      detailedMessage:
        '\nThe following custom field options were added at the end of the list: zendesk.ticket_field__custom_field_options.instance.ticket1Option2.',
    })
  })
})
