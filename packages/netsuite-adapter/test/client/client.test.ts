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
import { Record } from 'node-suitetalk'
import createClient from './client'
import {
  ATTRIBUTES, ENTITY_CUSTOM_FIELD, FAMILY_TYPE, INTERNAL_ID, RECORD_REF, SCRIPT_ID,
} from '../../src/constants'
import { NetsuiteRecord, NetsuiteReference } from '../../src/client/client'
import { recordInList } from '../utils'

describe('Client', () => {
  const { connection, client } = createClient()
  connection.getCustomizationId = jest.fn().mockReturnValue({
    getCustomizationIdResult: {
      status: {
        [ATTRIBUTES]: {
          isSuccess: 'true',
        },
      },
      totalRecords: 1,
      customizationRefList: {
        customizationRef: [{
          [ATTRIBUTES]: {
            scriptId: 'custentity_myScriptId',
            internalId: '19',
            type: 'entityCustomField',
          },
          name: 'My Entity Custom Field Name',
        }],
      },
    },
  })

  connection.getList = jest.fn().mockReturnValue({
    readResponseList: {
      status: {
        [ATTRIBUTES]: {
          isSuccess: 'true',
        },
      },
      readResponse: [
        {
          status: {
            [ATTRIBUTES]: {
              isSuccess: 'true',
            },
          },
          record: recordInList,
        },
      ],
    },
  })

  describe('list', () => {
    let listResult: NetsuiteRecord[]
    beforeEach(async () => {
      connection.init = jest.fn().mockImplementation(() => Promise.resolve())
      listResult = await client.list([{ type: 'entityCustomField', internalId: '19' }])
    })

    it('should return list records', async () => {
      expect(listResult).toHaveLength(1)
      expect(listResult[0]).toEqual(recordInList)
    })

    it('should call init once', async () => {
      expect(connection.init).toHaveBeenCalledTimes(1)
    })
  })

  describe('listCustomizations', () => {
    let listCustomizationsResult: NetsuiteRecord[]
    beforeEach(async () => {
      connection.init = jest.fn().mockImplementation(() => Promise.resolve())
      listCustomizationsResult = await client.listCustomizations('entityCustomField')
    })

    it('should return list of customization records', async () => {
      expect(listCustomizationsResult).toHaveLength(1)
      expect(listCustomizationsResult[0]).toEqual(recordInList)
    })

    // Todo should make the client to call init only once and then uncomment the below test
    // it('should call init once', async () => {
    //   expect(connection.init).toHaveBeenCalledTimes(1)
    // })
  })

  describe('add', () => {
    let addResult: NetsuiteReference
    const reference = {
      [ATTRIBUTES]: {
        [SCRIPT_ID]: 'custentityscript_id',
        [INTERNAL_ID]: '123',
        type: 'entityCustomField',
        'xsi:type': 'platformCore:CustomizationRef',
      },
    }
    beforeEach(async () => {
      connection.init = jest.fn().mockImplementation(() => Promise.resolve())
      connection.add = jest.fn().mockReturnValue(Promise.resolve({
        writeResponse: {
          baseRef: reference,
        },
      }))
      addResult = await client.add(new Record.Types.Record(FAMILY_TYPE.CUSTOMIZATION,
        ENTITY_CUSTOM_FIELD))
    })

    it('should return list records', async () => {
      expect(addResult).toBeDefined()
      expect(addResult).toEqual(reference)
    })

    it('should call init once', async () => {
      expect(connection.init).toHaveBeenCalledTimes(1)
    })
  })

  describe('delete', () => {
    let deleteResult: NetsuiteReference
    const reference = {
      [ATTRIBUTES]: {
        [INTERNAL_ID]: '123',
        type: 'entityCustomField',
        'xsi:type': 'platformCore:RecordRef',
      },
    }
    beforeEach(async () => {
      connection.init = jest.fn().mockImplementation(() => Promise.resolve())
      connection.delete = jest.fn().mockReturnValue(Promise.resolve({
        writeResponse: {
          baseRef: reference,
        },
      }))
      const recordRef = new Record.Types.Reference(RECORD_REF)
      recordRef.internalId = '123'
      recordRef.type = 'entityCustomField'
      deleteResult = await client.delete(recordRef)
    })

    it('should return list records', async () => {
      expect(deleteResult).toBeDefined()
      expect(deleteResult).toEqual(reference)
    })

    it('should call init once', async () => {
      expect(connection.init).toHaveBeenCalledTimes(1)
    })
  })
})
