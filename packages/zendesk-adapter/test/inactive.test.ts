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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { ValueGeneratedItem } from '@salto-io/adapter-components/src/fetch'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../src/config'
import { ZENDESK } from '../src/constants'
import { filterOutInactiveInstancesForType, filterOutInactiveItemForType } from '../src/inactive'

describe('omit inactive', () => {
  const trigger = new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger') })
  const view = new ObjectType({ elemID: new ElemID(ZENDESK, 'view') })
  const macro = new ObjectType({ elemID: new ElemID(ZENDESK, 'macro') })
  const webhookObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'webhook') })
  const trigger1 = new InstanceElement('trigger1', trigger, { name: 'test', active: true })
  const trigger2 = new InstanceElement('trigger2', trigger, { name: 'test', active: false })
  const view1 = new InstanceElement('view1', view, { name: 'test', active: false })
  const macro1 = new InstanceElement('macro1', macro, { name: 'test', active: false })
  const macro2 = new InstanceElement('macro2', macro, { name: 'test', active: true })
  const webhook1 = new InstanceElement('webhook1', webhookObjType, { name: 'test', status: 'active' })
  const webhook2 = new InstanceElement('webhook2', webhookObjType, { name: 'test', status: 'inactive' })
  const webhook3 = new InstanceElement('webhook3', webhookObjType, { name: 'test' })
  const ticketForm = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_form') })
  const ticketForm1 = new InstanceElement('inst1', ticketForm, { name: 'test', active: false })

  const activeTicketFieldItem = {
    value: {
      id: 123,
      type: 'tagger',
      title: 'macroTest',
      raw_title: 'macroTest',
      active: true,
      required: false,
    },
    typeName: 'ticket_field',
    context: {},
  }

  const activeCustomRoleItem = {
    value: {
      id: 123,
      name: 'testForFailure',
      description: 'testForFailureDescription',
      configuration: {
        chat_access: true,
        end_user_list_access: 'full',
        ticket_tag_editing: false,
      },
      team_member_count: 0,
    },
    typeName: 'custom_role',
    context: {},
  }

  const activeOrganizationFieldItem = {
    value: {
      id: 123,
      type: 'text',
      title: 'fieldTest',
      active: true,
      system: false,
    },
    typeName: 'organization_field',
    context: {},
  }

  const inactiveMacroItem = {
    value: {
      id: 123,
      title: 'test',
      active: false,
      default: false,
      description: null,
    },
    typeName: 'macro',
    context: {},
  }

  const inactiveViewItem = {
    value: {
      id: 123,
      title: 'Pending tickets',
      active: false,
      default: false,
      description: null,
      restriction: null,
      raw_title: 'Pending tickets',
    },
    typeName: 'view',
    context: {},
  }

  const activeWebhookItem = {
    value: {
      id: 'abc',
      name: 'Updated',
      status: 'active',
      subscriptions: ['conditional_ticket_events'],
      endpoint: 'https://example.com/status/200',
      http_method: 'POST',
      request_format: 'json',
    },
    typeName: 'webhook',
    context: {},
  }

  const inactiveWebhookItem = {
    value: {
      id: 'abc',
      name: 'Updated',
      status: 'inactive',
      subscriptions: ['conditional_ticket_events'],
      endpoint: 'https://example.com/status/200',
      http_method: 'POST',
      request_format: 'json',
    },
    typeName: 'webhook',
    context: {},
  }

  const valueGeneratedItems = [
    activeTicketFieldItem,
    activeCustomRoleItem,
    activeOrganizationFieldItem,
    inactiveMacroItem,
    inactiveViewItem,
    activeWebhookItem,
    inactiveWebhookItem,
  ]

  describe('onFetch', () => {
    let instanceFilter: (instances: InstanceElement[]) => InstanceElement[]
    let itemFilter: (item: ValueGeneratedItem) => boolean
    beforeEach(async () => {
      jest.clearAllMocks()
    })
    describe('using default config', () => {
      beforeEach(async () => {
        instanceFilter = filterOutInactiveInstancesForType(DEFAULT_CONFIG)
        itemFilter = filterOutInactiveItemForType(DEFAULT_CONFIG)
      })
      it('should omit inactive instances if omitInactive in typeDefaults is true', async () => {
        expect(instanceFilter([trigger1, trigger2]).map(elem => elem.elemID.getFullName())).toEqual([
          trigger1.elemID.getFullName(),
        ])
        expect(instanceFilter([macro1, macro2]).map(elem => elem.elemID.getFullName())).toEqual([
          macro2.elemID.getFullName(),
        ])
        expect(instanceFilter([view1]).map(elem => elem.elemID.getFullName())).toEqual([])
        expect(instanceFilter([webhook1, webhook2, webhook3]).map(elem => elem.elemID.getFullName())).toEqual([
          webhook1.elemID.getFullName(),
          webhook3.elemID.getFullName(),
        ])
        expect(instanceFilter([view1]).map(elem => elem.elemID.getFullName())).toEqual([])
        expect(valueGeneratedItems.filter(item => itemFilter(item))).toEqual([
          activeTicketFieldItem,
          activeCustomRoleItem,
          activeOrganizationFieldItem,
          activeWebhookItem,
        ])
      })
      it('should not omit instance of types that we need their inactive instances for reorder', async () => {
        expect(instanceFilter([ticketForm1]).map(elem => elem.elemID.getFullName())).toEqual([
          ticketForm1.elemID.getFullName(),
        ])
      })
      it('should omit only the inactive instance if two instances have the same id', async () => {
        const activeInst = new InstanceElement('inst1', trigger, { name: 'test', active: true })
        const inactiveInst = new InstanceElement('inst1', trigger, { name: 'test', active: false })
        expect(instanceFilter([activeInst, inactiveInst]).map(elem => elem.elemID.getFullName())).toEqual([
          activeInst.elemID.getFullName(),
        ])
      })
      it('should not omit instance if it does not have active field', async () => {
        const inst = new InstanceElement('inst1', trigger, { name: 'test' })
        expect(instanceFilter([inst]).map(elem => elem.elemID.getFullName())).toEqual([inst.elemID.getFullName()])
        expect(itemFilter(activeOrganizationFieldItem)).toBeTruthy()
      })
    })
    describe('using custom config', () => {
      describe('with omitInactive set to true', () => {
        beforeEach(async () => {
          const config = _.cloneDeep(DEFAULT_CONFIG)
          config[FETCH_CONFIG].omitInactive = {
            default: false,
            customizations: { trigger: true, macro: true, webhook: true, view: true },
          }
          itemFilter = filterOutInactiveItemForType(config)
          instanceFilter = filterOutInactiveInstancesForType(config)
        })
        it('should omit inactive instances if their customizations is true', async () => {
          expect(instanceFilter([trigger1, trigger2]).map(elem => elem.elemID.getFullName())).toEqual([
            trigger1.elemID.getFullName(),
          ])
          expect(instanceFilter([macro1, macro2]).map(elem => elem.elemID.getFullName())).toEqual([
            macro2.elemID.getFullName(),
          ])
          expect(instanceFilter([webhook1, webhook2, webhook3]).map(elem => elem.elemID.getFullName())).toEqual([
            webhook1.elemID.getFullName(),
            webhook3.elemID.getFullName(),
          ])
          expect(valueGeneratedItems.filter(item => itemFilter(item))).toEqual([
            activeTicketFieldItem,
            activeCustomRoleItem,
            activeOrganizationFieldItem,
            activeWebhookItem,
          ])
        })
      })
      describe('with omitInactive set to false', () => {
        beforeEach(async () => {
          const config = _.cloneDeep(DEFAULT_CONFIG)
          config[FETCH_CONFIG].omitInactive = {
            customizations: { trigger: false, macro: false, webhook: false },
          }
          itemFilter = filterOutInactiveItemForType(config)
          instanceFilter = filterOutInactiveInstancesForType(config)
        })
        it('should omit inactive instances if their customizations is true', async () => {
          expect(instanceFilter([trigger1, trigger2]).map(elem => elem.elemID.getFullName())).toEqual([
            trigger1.elemID.getFullName(),
            trigger2.elemID.getFullName(),
          ])
          expect(instanceFilter([macro1, macro2]).map(elem => elem.elemID.getFullName())).toEqual([
            macro1.elemID.getFullName(),
            macro2.elemID.getFullName(),
          ])
          expect(instanceFilter([webhook1, webhook2, webhook3]).map(elem => elem.elemID.getFullName())).toEqual([
            webhook1.elemID.getFullName(),
            webhook2.elemID.getFullName(),
            webhook3.elemID.getFullName(),
          ])
          expect(valueGeneratedItems.filter(item => itemFilter(item))).toEqual(valueGeneratedItems)
        })
      })
    })
  })
})
