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
import { BulkLoadOperation } from '@salto-io/jsforce-types'
import { SalesforceRecord } from '../src/client/types'
import {
  CrudFn,
  retryFlow,
  deleteInstances,
} from '../src/custom_object_instances_deploy'
import { instancesToCreateRecords } from '../src/transformers/transformer'
import mockClient from './client'

describe('Custom Object Deploy', () => {
  const groupId = 'test_group_id'
  describe('retry mechanism', () => {
    const { client } = mockClient()
    const inst1 = new InstanceElement(
      'inst1',
      new ObjectType({ elemID: new ElemID('', 'test') }),
    )
    const inst2 = new InstanceElement(
      'inst2',
      new ObjectType({ elemID: new ElemID('', 'test') }),
    )
    const instanceElements = [inst1, inst2]
    const retries = 3
    const clientBulkOpSpy = jest.spyOn(client, 'bulkLoadOperation')
    const clientOp: CrudFn = async ({
      typeName,
      instances,
      client: sfClient,
    }) => {
      const results = await sfClient.bulkLoadOperation(
        typeName,
        'insert',
        await instancesToCreateRecords(instances),
      )
      return instances.map((instance, index) => ({
        instance,
        result: results[index],
      }))
    }

    beforeEach(() => {
      clientBulkOpSpy.mockReset()
    })

    it('should not retry on only successes', async () => {
      clientBulkOpSpy.mockResolvedValue([
        {
          id: '1',
          success: true,
        },
        {
          id: '2',
          success: true,
        },
      ])
      const res = await retryFlow(
        clientOp,
        { typeName: 'typtyp', instances: instanceElements, client, groupId },
        retries,
      )
      expect(res).toEqual({
        successInstances: [inst1, inst2],
        errorInstances: [],
      })
      expect(clientBulkOpSpy).toHaveBeenCalledTimes(1)
    })

    it('should not retry on non-recoverable error(s)', async () => {
      clientBulkOpSpy.mockResolvedValue([
        {
          id: '1',
          success: true,
        },
        {
          id: '2',
          success: false,
          errors: ['err555'],
        },
      ])
      const res = await retryFlow(
        clientOp,
        { typeName: 'typtyp', instances: instanceElements, client, groupId },
        retries,
      )
      expect(res).toEqual(
        expect.objectContaining({
          errorInstances: [
            expect.objectContaining({
              elemID: inst2.elemID,
              message: expect.stringContaining('err555'),
              severity: 'Error',
            }),
          ],
          successInstances: [
            expect.objectContaining({
              elemID: inst1.elemID,
            }),
          ],
        }),
      )

      expect(clientBulkOpSpy).toHaveBeenCalledTimes(1)
    })

    it('should not retry on partially recoverable error(s)', async () => {
      clientBulkOpSpy.mockResolvedValue([
        {
          id: '1',
          success: true,
        },
        {
          id: '2',
          success: false,
          errors: ['err1', 'bla bla bla'],
        },
      ])
      const res = await retryFlow(
        clientOp,
        { typeName: 'typtyp', instances: instanceElements, client, groupId },
        retries,
      )
      expect(res).toEqual(
        expect.objectContaining({
          errorInstances: [
            expect.objectContaining({
              elemID: inst2.elemID,
              message: expect.stringContaining('err1'),
              severity: 'Error',
            }),
            expect.objectContaining({
              elemID: inst2.elemID,
              message: expect.stringContaining('bla bla bla'),
              severity: 'Error',
            }),
          ],
          successInstances: [
            expect.objectContaining({
              elemID: inst1.elemID,
            }),
          ],
        }),
      )

      expect(clientBulkOpSpy).toHaveBeenCalledTimes(1)
    })

    it('should retry on recoverable error(s), fail on unrecoverable', async () => {
      clientBulkOpSpy.mockImplementation(
        async (
          _1: string,
          _2: BulkLoadOperation,
          records: SalesforceRecord[],
        ) => {
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
          return [
            {
              id: '2',
              success: false,
              errors: ['err1 bla bla bla'],
            },
          ]
        },
      )
      const res = await retryFlow(
        clientOp,
        { typeName: 'typtyp', instances: instanceElements, client, groupId },
        retries,
      )
      expect(res).toEqual(
        expect.objectContaining({
          errorInstances: [
            expect.objectContaining({
              elemID: inst2.elemID,
              message: expect.stringContaining('err1 bla bla bla'),
              severity: 'Error',
            }),
          ],
          successInstances: [
            expect.objectContaining({
              elemID: inst1.elemID,
            }),
          ],
        }),
      )

      expect(clientBulkOpSpy).toHaveBeenCalledTimes(4)
    })

    it('should retry on recoverable error(s), succeed second time', async () => {
      let clientCallCount = 0
      clientBulkOpSpy.mockImplementation(
        async (
          _1: string,
          _2: BulkLoadOperation,
          records: SalesforceRecord[],
        ) => {
          clientCallCount += 1
          return records.map((_record, idx) => ({
            id: (clientCallCount + idx).toString(),
            success: idx === 0,
          }))
        },
      )
      const inst3 = new InstanceElement(
        'inst3',
        new ObjectType({ elemID: new ElemID('', 'test') }),
      )
      const testInstances = instanceElements
        .map((instance) => instance.clone())
        .concat([inst3])
      const res = await retryFlow(
        clientOp,
        { typeName: 'typtyp', instances: testInstances, client, groupId },
        retries,
      )
      expect(res).toEqual({
        successInstances: [inst1, inst2, inst3],
        errorInstances: [],
      })
      expect(clientBulkOpSpy).toHaveBeenCalledTimes(3)
    })

    it('should retry on recoverable error(s), failed because of max-retries', async () => {
      clientBulkOpSpy.mockImplementation(
        async (
          _1: string,
          _2: BulkLoadOperation,
          records: SalesforceRecord[],
        ) => {
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
          return [
            {
              id: '2',
              success: false,
              errors: ['err1'],
            },
          ]
        },
      )
      const res = await retryFlow(
        clientOp,
        { typeName: 'typtyp', instances: instanceElements, client, groupId },
        retries,
      )
      expect(res).toEqual(
        expect.objectContaining({
          errorInstances: [
            expect.objectContaining({
              elemID: inst2.elemID,
              message: expect.stringContaining('err1'),
              severity: 'Error',
            }),
          ],
          successInstances: [
            expect.objectContaining({
              elemID: inst1.elemID,
            }),
          ],
        }),
      )

      expect(clientBulkOpSpy).toHaveBeenCalledTimes(4)
    })
  })
  describe('silence delete spurious errors', () => {
    const { client } = mockClient()
    const clientBulkOpSpy = jest.spyOn(client, 'bulkLoadOperation')
    const typeName = 'fakeType'
    const instances = [
      new InstanceElement(
        'inst1',
        new ObjectType({ elemID: new ElemID('', typeName) }),
      ),
    ]

    beforeEach(() => {
      clientBulkOpSpy.mockReset()
    })
    it('should remove "already deleted" errors, but not other errors', async () => {
      clientBulkOpSpy.mockResolvedValue([
        {
          id: '',
          errors: [
            'error1',
            'ENTITY_IS_DELETED:entity is deleted:--',
            'error2',
          ],
        },
      ])
      const result = await deleteInstances({
        typeName,
        instances,
        client,
        groupId,
      })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({ errors: ['error1', 'error2'] })
    })
    it('should mark success if no other errors left', async () => {
      clientBulkOpSpy.mockResolvedValue([
        {
          id: '',
          success: false,
          errors: ['ENTITY_IS_DELETED:entity is deleted:--'],
        },
      ])
      const result = await deleteInstances({
        typeName,
        instances,
        client,
        groupId,
      })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({ success: true, errors: [] })
    })
    it('should not mark success if other errors exist', async () => {
      clientBulkOpSpy.mockResolvedValue([{ id: '', errors: ['error1'] }])
      const result = await deleteInstances({
        typeName,
        instances,
        client,
        groupId,
      })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({
        success: false,
        errors: ['error1'],
      })
    })
    it('should not mark success if no errors were removed', async () => {
      clientBulkOpSpy.mockResolvedValue([
        { id: '', success: false, errors: [] },
      ])
      const result = await deleteInstances({
        typeName,
        instances,
        client,
        groupId,
      })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({ success: false, errors: [] })
    })
    it('should keep the result success if it was success beforehand', async () => {
      clientBulkOpSpy.mockResolvedValue([
        { id: '', success: true, errors: ['error'] },
      ])
      const result = await deleteInstances({
        typeName,
        instances,
        client,
        groupId,
      })
      expect(result).toHaveLength(1)
      expect(result[0].result).toMatchObject({
        success: true,
        errors: ['error'],
      })
    })
  })
})
