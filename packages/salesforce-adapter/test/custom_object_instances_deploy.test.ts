/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BulkLoadOperation } from 'jsforce-types'
import { SalesforceRecord } from '../src/client/types'
import { CrudFn, retryFlow, deleteInstances } from '../src/custom_object_instances_deploy'
import { instancesToCreateRecords } from '../src/transformers/transformer'
import mockClient from './client'

describe('Custom Object Deploy', () => {
  describe('retry mechanism', () => {
    const { client } = mockClient()
    const inst1 = new InstanceElement('inst1', new ObjectType({ elemID: new ElemID('', 'test') }))
    const inst2 = new InstanceElement('inst2', new ObjectType({ elemID: new ElemID('', 'test') }))
    const instanceElements = [inst1, inst2]
    const retries = 3
    const clientBulkOpSpy = jest.spyOn(client, 'bulkLoadOperation')
    const clientOp: CrudFn = async ({ typeName, instances, client: sfClient }) => {
      const results = await sfClient.bulkLoadOperation(
        typeName,
        'insert',
        await instancesToCreateRecords(instances)
      )
      return instances.map((instance, index) =>
        ({ instance, result: results[index] }))
    }

    beforeEach(() => {
      clientBulkOpSpy.mockReset()
    })

    it('should not retry on only successes', async () => {
      clientBulkOpSpy.mockResolvedValue(
        [
          {
            id: '1',
            success: true,
          },
          {
            id: '2',
            success: true,
          },
        ]
      )
      const res = await retryFlow(clientOp, { typeName: 'typtyp', instances: instanceElements, client }, retries)
      expect(res).toEqual({ successInstances: [inst1, inst2], errorMessages: [] })
      expect(clientBulkOpSpy).toHaveBeenCalledTimes(1)
    })

    it('should not retry on non-recoverable error(s)', async () => {
      clientBulkOpSpy.mockResolvedValue(
        [
          {
            id: '1',
            success: true,
          },
          {
            id: '2',
            success: false,
            errors: ['err555'],
          },
        ]
      )
      const res = await retryFlow(clientOp, { typeName: 'typtyp', instances: instanceElements, client }, retries)
      expect(res).toEqual({ successInstances: [inst1], errorMessages: ['inst2:\n    \terr555'] })
      expect(clientBulkOpSpy).toHaveBeenCalledTimes(1)
    })

    it('should not retry on partially recoverable error(s)', async () => {
      clientBulkOpSpy.mockResolvedValue(
        [
          {
            id: '1',
            success: true,
          },
          {
            id: '2',
            success: false,
            errors: ['err1', 'bla bla bla'],
          },
        ]
      )
      const res = await retryFlow(clientOp, { typeName: 'typtyp', instances: instanceElements, client }, retries)
      expect(res).toEqual({ successInstances: [inst1], errorMessages: ['inst2:\n    \terr1\n\tbla bla bla'] })
      expect(clientBulkOpSpy).toHaveBeenCalledTimes(1)
    })

    it('should retry on recoverable error(s), fail on unrecoverable', async () => {
      clientBulkOpSpy.mockImplementation(
        async (_1: string,
          _2: BulkLoadOperation,
          records: SalesforceRecord[]) => {
          if (records.length > 1) {
            return [
              {
                id: '1',
                success: true,
              },
              {
                id: '2',
                success: false,
                errors: ['err1'],
              },
            ]
          }
          return [{
            id: '2',
            success: false,
            errors: ['err1 bla bla bla'],
          }]
        }

      )
      const res = await retryFlow(clientOp, { typeName: 'typtyp', instances: instanceElements, client }, retries)
      expect(res).toEqual({ successInstances: [inst1], errorMessages: ['inst2:\n    \terr1 bla bla bla'] })
      expect(clientBulkOpSpy).toHaveBeenCalledTimes(4)
    })

    it('should retry on recoverable error(s), succeed second time', async () => {
      clientBulkOpSpy.mockImplementation(
        async (_1: string,
          _2: BulkLoadOperation,
          records: SalesforceRecord[]) => {
          if (records.length > 1) {
            return [
              {
                id: '1',
                success: true,
              },
              {
                id: '2',
                success: false,
                errors: ['err1'],
              },
            ]
          }
          return [{
            id: '2',
            success: true,
          }]
        }

      )
      const res = await retryFlow(clientOp, { typeName: 'typtyp', instances: instanceElements, client }, retries)
      expect(res).toEqual({ successInstances: [inst1, inst2], errorMessages: [] })
      expect(clientBulkOpSpy).toHaveBeenCalledTimes(2)
    })

    it('should retry1 on recoverable error(s), failed because of max-retries', async () => {
      clientBulkOpSpy.mockImplementation(
        async (_1: string,
          _2: BulkLoadOperation,
          records: SalesforceRecord[]) => {
          if (records.length > 1) {
            return [
              {
                id: '1',
                success: true,
              },
              {
                id: '2',
                success: false,
                errors: ['err1'],
              },
            ]
          }
          return [{
            id: '2',
            success: false,
            errors: ['err1'],
          }]
        }
      )
      const res = await retryFlow(clientOp, { typeName: 'typtyp', instances: instanceElements, client }, retries)
      expect(res).toEqual({ successInstances: [inst1], errorMessages: ['inst2:\n    \terr1'] })
      expect(clientBulkOpSpy).toHaveBeenCalledTimes(4)
    })
  })
  describe('silence delete spurious errors', () => {
    const { client } = mockClient()
    const clientBulkOpSpy = jest.spyOn(client, 'bulkLoadOperation')
    const typeName = 'fakeType'
    const instances = [new InstanceElement('inst1', new ObjectType({ elemID: new ElemID('', typeName) }))]

    beforeEach(() => {
      clientBulkOpSpy.mockReset()
    })
    it('should remove "already deleted" errors, but not other errors', async () => {
      clientBulkOpSpy.mockResolvedValue([
        { id: '', errors: ['error1', 'ENTITY_IS_DELETED:entity is deleted:--', 'error2'] },
      ])
      const result = await deleteInstances({ typeName, instances, client })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({ errors: ['error1', 'error2'] })
    })
    it('should mark success if no other errors left', async () => {
      clientBulkOpSpy.mockResolvedValue([
        { id: '', success: false, errors: ['ENTITY_IS_DELETED:entity is deleted:--'] },
      ])
      const result = await deleteInstances({ typeName, instances, client })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({ success: true, errors: [] })
    })
    it('should not mark success if other errors exist', async () => {
      clientBulkOpSpy.mockResolvedValue([
        { id: '', errors: ['error1'] },
      ])
      const result = await deleteInstances({ typeName, instances, client })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({ success: false, errors: ['error1'] })
    })
    it('should not mark success if no errors were removed', async () => {
      clientBulkOpSpy.mockResolvedValue([
        { id: '', success: false, errors: [] },
      ])
      const result = await deleteInstances({ typeName, instances, client })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({ success: false, errors: [] })
    })
    it('should keep the result success if it was success beforehand', async () => {
      clientBulkOpSpy.mockResolvedValue([
        { id: '', success: true, errors: ['error'] },
      ])
      const result = await deleteInstances({ typeName, instances, client })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({ success: true, errors: ['error'] })
    })
  })
})
