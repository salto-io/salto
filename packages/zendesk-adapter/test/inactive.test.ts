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
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../src/config'
import { ZENDESK } from '../src/constants'
import { filterOutInactiveInstancesForType } from '../src/inactive'

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

  describe('onFetch', () => {
    let instanceFilter: (instances: InstanceElement[]) => InstanceElement[]
    beforeEach(async () => {
      jest.clearAllMocks()
    })
    describe('using default config', () => {
      beforeEach(async () => {
        instanceFilter = filterOutInactiveInstancesForType(DEFAULT_CONFIG)
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
      })
    })
    describe('using custom config', () => {
      describe('with omitInactive set to true', () => {
        beforeEach(async () => {
          const config = _.cloneDeep(DEFAULT_CONFIG)
          config[FETCH_CONFIG].omitInactive = {
            default: false,
            customizations: { trigger: true, macro: true, webhook: true },
          }
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
        })
      })
      describe('with omitInactive set to false', () => {
        beforeEach(async () => {
          const config = _.cloneDeep(DEFAULT_CONFIG)
          config[FETCH_CONFIG].omitInactive = {
            customizations: { trigger: false, macro: false, webhook: false },
          }
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
        })
      })
    })
  })
})
