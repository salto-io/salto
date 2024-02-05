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
import fetchCriteria from '../src/fetch_criteria'
import { ZENDESK } from '../src/constants'

describe('fetch_criteria', () => {
  describe('name', () => {
    it('should match element name', () => {
      const instance = new InstanceElement(
        'instance',
        new ObjectType({ elemID: new ElemID('adapter', 'type') }),
        {
          name: 'name',
        }
      )

      expect(fetchCriteria.name({ instance, value: '.ame' })).toBeTruthy()
      expect(fetchCriteria.name({ instance, value: 'ame' })).toBeFalsy()
    })
  })
  describe('active', () => {
    const macro = new ObjectType({ elemID: new ElemID(ZENDESK, 'macro') })
    const webhookObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'webhook') })
    const ticketForm = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_form') })
    const ticketForm1 = new InstanceElement('inst1', ticketForm, { name: 'test', active: false })
    const macro1 = new InstanceElement('macro1', macro, { name: 'test', active: false })
    const macro2 = new InstanceElement('macro2', macro, { name: 'test', active: true })
    const webhook1 = new InstanceElement('webhook1', webhookObjType, { name: 'test', status: 'active' })
    const webhook2 = new InstanceElement('webhook2', webhookObjType, { name: 'test', status: 'inactive' })
    describe('webhook', () => {
      it('should return true for active webhooks', () => {
        expect(fetchCriteria.active({ instance: webhook1, value: true })).toBeTruthy()
      })
      it('should return false for inactive webhooks', () => {
        expect(fetchCriteria.active({ instance: webhook2, value: true })).toBeFalsy()
      })
    })
    describe('ticket_form', () => {
      it('should always return true for ticket_form', () => {
        expect(fetchCriteria.active({ instance: ticketForm1, value: true })).toBeTruthy()
        expect(fetchCriteria.active({ instance: ticketForm1, value: false })).toBeTruthy()
      })
    })
    describe('other', () => {
      it('should return true for active instances', () => {
        expect(fetchCriteria.active({ instance: macro2, value: true })).toBeTruthy()
      })
      it('should return false for inactive instances', () => {
        expect(fetchCriteria.active({ instance: macro1, value: true })).toBeFalsy()
      })
    })
  })
})
