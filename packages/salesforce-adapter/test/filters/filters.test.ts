/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, ElemID, InstanceElement, getChangeElement } from '@salto-io/adapter-api'
import SalesforceAdapter from '../../src/adapter'
import { FilterWith, FilterCreator } from '../../src/filter'
import { API_NAME, METADATA_TYPE, INSTANCE_FULL_NAME_FIELD } from '../../src/constants'
import mockAdapter from '../adapter'
import { id } from '../../src/filters/utils'

describe('SalesforceAdapter filters', () => {
  const object = new ObjectType({
    elemID: new ElemID('bla', 'test'),
    annotations: { [API_NAME]: 'Bla__c' },
  })

  const instanceToDeploy = new InstanceElement(
    'deployMe',
    new ObjectType({
      elemID: new ElemID('bla', 'Bla__c'),
      annotations: {
        [API_NAME]: 'Bla__c',
        [METADATA_TYPE]: 'ApexClass',
      },
    }),
    {
      [INSTANCE_FULL_NAME_FIELD]: 'deployMe',
    }
  )

  let adapter: SalesforceAdapter

  const createAdapter = (
    filterCreators: FilterCreator[]
  ): SalesforceAdapter => mockAdapter({ adapterParams: { filterCreators } }).adapter

  describe('when filter methods are implemented', () => {
    let filter: FilterWith<'onFetch' | 'onAdd' | 'onUpdate' | 'onRemove' | 'onPreDeploy'>

    beforeEach(() => {
      filter = {
        onFetch: jest.fn().mockImplementationOnce(elements => elements),
        onAdd: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
        onUpdate: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
        onRemove: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
        onPreDeploy: jest.fn(),
      }

      adapter = createAdapter([() => filter])
    })

    it('should call inner aspects upon fetch', async () => {
      await adapter.fetch()
      const { mock } = filter.onFetch as jest.Mock
      expect(mock.calls.length).toBe(1)
    })

    it('should call inner aspects upon add', async () => {
      await adapter.deploy({
        groupID: object.elemID.getFullName(),
        changes: [{ action: 'add', data: { after: object } }],
      })
      const { mock } = filter.onAdd as jest.Mock
      expect(mock.calls.length).toBe(1)
      expect(id(mock.calls[0][0])).toEqual(id(object))
    })

    it('should call inner aspects upon remove', async () => {
      await adapter.deploy({
        groupID: object.elemID.getFullName(),
        changes: [{ action: 'remove', data: { before: object } }],
      })
      const { mock } = filter.onRemove as jest.Mock
      expect(mock.calls.length).toBe(1)
      expect(id(mock.calls[0][0])).toEqual(id(object))
    })

    it('should call preDeploy inner aspects upon add', async () => {
      await adapter.deploy({
        groupID: instanceToDeploy.elemID.getFullName(),
        changes: [{ action: 'add', data: { after: instanceToDeploy } }],
      })
      const { mock } = filter.onPreDeploy as jest.Mock
      expect(mock.calls.length).toBe(1)
      expect(id(mock.calls[0][0])).toEqual(id(instanceToDeploy))
    })

    it('should not modify the returned instance upon preDeploy', async () => {
      filter.onPreDeploy = jest.fn()
        .mockImplementationOnce((inst: InstanceElement) => { inst.value = { bla: 'val' } })
      const deployResult = await adapter.deploy({
        groupID: instanceToDeploy.elemID.getFullName(),
        changes: [{ action: 'add', data: { after: instanceToDeploy } }],
      })

      const changedInstance = getChangeElement(deployResult.appliedChanges[0]) as InstanceElement
      expect(changedInstance.value).toEqual(instanceToDeploy.value)
    })

    it('should call preDeploy inner aspects upon update', async () => {
      await adapter.deploy({
        groupID: instanceToDeploy.elemID.getFullName(),
        changes: [{
          action: 'modify',
          data: { before: instanceToDeploy, after: instanceToDeploy.clone() },
        }],
      })
      const { mock } = filter.onPreDeploy as jest.Mock
      expect(mock.calls.length).toBe(1)
      expect(id(mock.calls[0][0])).toEqual(id(instanceToDeploy))
    })

    it('should call inner aspects upon update', async () => {
      await adapter.deploy({
        groupID: object.elemID.getFullName(),
        changes: [{ action: 'modify', data: { before: object, after: object } }],
      })
      const { mock } = filter.onUpdate as jest.Mock
      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0][0]).toEqual(object)
      expect(id(mock.calls[0][1])).toEqual(id(object))
      expect(mock.calls[0][2]).toHaveLength(1)
      expect(mock.calls[0][2][0].action).toBe('modify')
    })
  })
})
