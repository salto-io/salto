/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, ElemIdGetter, ObjectType } from '@salto-io/adapter-api'
import { NetsuiteQuery, CustomRecordsQuery } from '../src/config/query'
import NetsuiteClient from '../src/client/client'
import { getCustomRecords } from '../src/custom_records/custom_records'
import { NETSUITE } from '../src/constants'

describe('custom records', () => {
  describe('getCustomRecords', () => {
    const client: Pick<NetsuiteClient, 'isSuiteAppConfigured' | 'getCustomRecords' | 'runSuiteQL'> = {
      isSuiteAppConfigured: () => true,
      getCustomRecords: async () => ({
        customRecords: [
          {
            type: 'custrecord1',
            records: [
              {
                scriptId: 'val_111',
                attributes: {
                  internalId: '1',
                },
              },
              {
                attributes: {
                  internalId: '2',
                },
              },
              {
                attributes: {
                  internalId: '3',
                },
              },
              {
                attributes: {
                  internalId: '4',
                },
              },
            ],
          },
          {
            type: 'custrecord2',
            records: [],
          },
        ],
        largeTypesError: [],
      }),
      runSuiteQL: async _query => [
        { id: '1', scriptid: 'val_1' },
        { id: '2', scriptid: 'val_2' },
        { id: '3', scriptid: 'val_3' },
      ],
    }
    const query: CustomRecordsQuery = {
      isCustomRecordTypeMatch: () => true,
      areAllCustomRecordsMatch: () => true,
      isCustomRecordMatch: () => true,
    }
    const elemIdGetter: ElemIdGetter = (adapter, _serviceIds, name) => new ElemID(adapter, 'type', 'instance', name)
    const customRecordTypes = [
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'custrecord1'),
        annotations: {
          metadataType: 'customrecordtype',
          scriptid: 'custrecord1',
        },
      }),
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'custrecord2'),
        annotations: {
          metadataType: 'customrecordtype',
          scriptid: 'custrecord2',
        },
      }),
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'custrecord3'),
        annotations: {
          metadataType: 'customrecordtype',
          scriptid: 'custrecord3',
        },
      }),
    ]
    it('should return elements', async () => {
      const { elements: instances } = await getCustomRecords(
        client as unknown as NetsuiteClient,
        customRecordTypes,
        query as unknown as NetsuiteQuery,
        elemIdGetter,
      )
      expect(instances.length).toEqual(3)
      expect(instances.map(({ elemID }) => elemID.getFullName())).toEqual([
        'netsuite.custrecord1.instance.val_111',
        'netsuite.custrecord1.instance.val_2',
        'netsuite.custrecord1.instance.val_3',
      ])
      expect(instances.map(inst => inst.value)).toEqual([
        {
          scriptid: 'val_111',
          attributes: {
            internalId: '1',
          },
        },
        {
          scriptid: 'val_2',
          attributes: {
            internalId: '2',
          },
        },
        {
          scriptid: 'val_3',
          attributes: {
            internalId: '3',
          },
        },
      ])
    })
  })
})
