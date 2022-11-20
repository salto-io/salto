/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, ElemIdGetter, Field, InstanceElement, ObjectType, OBJECT_NAME, OBJECT_SERVICE_ID, toServiceIdsString } from '@salto-io/adapter-api'
import Bottleneck from 'bottleneck'
import { elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE } from '../../src/constants'
import SdfClient from '../../src/client/sdf_client'
import { getDataElements, getDataTypes } from '../../src/data_elements/data_elements'
import { NetsuiteQuery } from '../../src/query'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { getFieldInstanceTypes } from '../../src/data_elements/custom_fields'
import { othercustomfieldType } from '../../src/autogen/types/standard_types/othercustomfield'

jest.mock('@salto-io/adapter-components', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-components'),
  elements: {
    ...jest.requireActual('@salto-io/adapter-components').elements,
    soap: {
      extractTypes: jest.fn(),
      createClientAsync: jest.fn(),
    },
  },
}))

describe('data_elements', () => {
  const createClientMock = elementUtils.soap.createClientAsync as jest.Mock
  const extractTypesMock = elementUtils.soap.extractTypes as jest.Mock
  const wsdl = {}
  const query = {
    isTypeMatch: () => true,
    isObjectMatch: () => true,
  } as unknown as NetsuiteQuery

  const creds = {
    accountId: 'accountId',
    tokenId: 'tokenId',
    tokenSecret: 'tokenSecret',
    suiteAppTokenId: 'suiteAppTokenId',
    suiteAppTokenSecret: 'suiteAppTokenSecret',
    suiteAppActivationKey: 'suiteAppActivationKey',
  }
  const client = new NetsuiteClient(
    new SdfClient({ credentials: creds, globalLimiter: new Bottleneck() }),
    new SuiteAppClient({ credentials: creds, globalLimiter: new Bottleneck() }),
  )

  const getAllRecordsMock = jest.spyOn(client, 'getAllRecords')

  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(client, 'isSuiteAppConfigured').mockReturnValue(true)
    jest.spyOn(client, 'getNetsuiteWsdl').mockResolvedValue(wsdl as elementUtils.soap.WSDL)
    createClientMock.mockResolvedValue({
      wsdl, addSoapHeader: jest.fn(),
    } as unknown as elementUtils.soap.Client)
  })

  describe('getDataTypes', () => {
    it('should return all the types', async () => {
      const typeA = new ObjectType({ elemID: new ElemID(NETSUITE, 'A') })
      const typeB = new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary'), fields: { A: { refType: typeA }, name: { refType: BuiltinTypes.STRING } } })
      const typeC = new ObjectType({ elemID: new ElemID(NETSUITE, 'accountingPeriod') })

      extractTypesMock.mockResolvedValue([typeA, typeB, typeC])

      const types = await getDataTypes(client)
      expect(types?.map(t => t.elemID.name)).toEqual(['A', 'subsidiary', 'accountingPeriod'])
    })

    it('should do nothing if SuiteApp is not configured', async () => {
      jest.spyOn(client, 'isSuiteAppConfigured').mockReturnValue(false)
      await expect(getDataTypes(client)).resolves.toEqual([])
    })

    it('should return empty list if failed to get wsdl', async () => {
      jest.spyOn(client, 'getNetsuiteWsdl').mockResolvedValue(undefined)
      await expect(getDataTypes(client)).resolves.toEqual([])
    })

    it('should add identifer field if necessary', async () => {
      const subsidiary = new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary') })
      const accountingPeriod = new ObjectType({ elemID: new ElemID(NETSUITE, 'accountingPeriod') })

      extractTypesMock.mockResolvedValue([subsidiary, accountingPeriod])
      await getDataTypes(client)
      expect(accountingPeriod.fields.identifier).toBeDefined()
      expect(subsidiary.fields.identifier).toBeUndefined()
    })
  })

  describe('getDataElements', () => {
    const subsidiaryType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'subsidiary'),
      fields: {
        booleanField: { refType: BuiltinTypes.BOOLEAN },
        numberField: { refType: BuiltinTypes.NUMBER },
      },
    })

    beforeEach(() => {
      extractTypesMock.mockResolvedValue([subsidiaryType])
    })

    it('should return the instances of the types', async () => {
      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'subsidiary') {
          return [{
            name: 'name',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '1',
            },
          }]
        }
        return []
      })

      const elements = await getDataElements(client, query)
      expect(elements[0].elemID.getFullNameParts()).toEqual([NETSUITE, 'subsidiary'])
      expect(elements[1].elemID.getFullNameParts()).toEqual([NETSUITE, 'subsidiary', 'instance', 'name'])
      expect((elements[1] as InstanceElement).value).toEqual({
        name: 'name',
        attributes: {
          'xsi:type': 'listAcct:Subsidiary',
          internalId: '1',
        },
      })
    })

    it('should add identifier if type has more than one identifier fields', async () => {
      const accountingPeriodType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'accountingPeriod'),
        fields: {
          booleanField: { refType: BuiltinTypes.BOOLEAN },
          numberField: { refType: BuiltinTypes.NUMBER },
        },
      })
      extractTypesMock.mockResolvedValue([accountingPeriodType])

      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'accountingPeriod') {
          return [{
            periodName: 'name',
            attributes: {
              'xsi:type': 'listAcct:AccountingPeriod',
              internalId: '1',
            },
            fiscalCalendar: {
              name: 'fiscal',
            },
          }]
        }
        return []
      })

      const elements = await getDataElements(client, query)
      expect((elements[1] as InstanceElement).value.identifier).toEqual('name_fiscal')
    })

    it('should add identifier if type has a parent', async () => {
      const type = new ObjectType({
        elemID: new ElemID(NETSUITE, 'subsidiary'),
        fields: {
          name: { refType: BuiltinTypes.STRING },
        },
      })
      type.fields.parent = new Field(type, 'parent', type)

      extractTypesMock.mockResolvedValue([type])

      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'subsidiary') {
          return [{
            name: 'child',
            attributes: { 'xsi:type': 'listAcct:Subsidiary', internalId: '2' },
            parent: {
              attributes: {
                internalId: '1',
              },
            },
          }, {
            name: 'parent',
            attributes: { 'xsi:type': 'listAcct:Subsidiary', internalId: '1' },
          }, {
            name: 'child_without_parent',
            attributes: { 'xsi:type': 'listAcct:Subsidiary', internalId: '3' },
            parent: {
              attributes: {
                internalId: '4',
              },
            },
          }]
        }
        return []
      })

      const elements = await getDataElements(client, query)
      expect((elements[1] as InstanceElement).value.identifier).toEqual('parent_child')
      expect((elements[2] as InstanceElement).value.identifier).toEqual('parent')
      expect((elements[3] as InstanceElement).value.identifier).toEqual('4_child_without_parent')
    })

    it('should return only requested instances', async () => {
      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'subsidiary') {
          return [{
            name: 'name1',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '1',
            },
          }, {
            name: 'name2',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '2',
            },
          }]
        }
        return []
      })

      const netsuiteQuery = {
        isTypeMatch: (typeName: string) => typeName === 'subsidiary',
        isObjectMatch: ({ instanceId }: { instanceId: string }) => instanceId === 'name1',
      } as unknown as NetsuiteQuery

      const elements = await getDataElements(
        client,
        netsuiteQuery,
      )
      expect(elements[0].elemID.getFullNameParts()).toEqual([NETSUITE, 'subsidiary'])
      expect(elements[1].elemID.getFullNameParts()).toEqual([NETSUITE, 'subsidiary', 'instance', 'name1'])
      expect(elements).toHaveLength(2)
      expect(getAllRecordsMock).not.toHaveBeenCalledWith('account')
    })

    it('should return only types when no instances match', async () => {
      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'subsidiary') {
          return [{
            name: 'name1',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '1',
            },
          }, {
            name: 'name2',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '2',
            },
          }]
        }
        return []
      })

      const netsuiteQuery = {
        isTypeMatch: () => false,
        isObjectMatch: () => false,
      } as unknown as NetsuiteQuery

      const elements = await getDataElements(
        client,
        netsuiteQuery,
      )
      expect(elements[0].elemID.getFullNameParts()).toEqual([NETSUITE, 'subsidiary'])
      expect(elements).toHaveLength(1)
    })

    it('should return empty array if failed to get the types', async () => {
      jest.spyOn(client, 'isSuiteAppConfigured').mockReturnValue(false)
      await expect(getDataElements(
        client,
        query,
      )).resolves.toEqual([])
    })

    it('should throw an error if failed to getAllRecords', async () => {
      getAllRecordsMock.mockRejectedValue(new Error())
      await expect(getDataElements(
        client,
        query,
      )).rejects.toThrow()
    })

    it('should convert date to string', async () => {
      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'subsidiary') {
          return [{
            name: 'name',
            date: new Date(2020, 1, 1),
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '1',
            },
          }]
        }
        return []
      })
      const elements = await getDataElements(client, query)
      expect(typeof (elements[1] as InstanceElement).value.date).toEqual('string')
    })

    it('should convert booleans', async () => {
      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'subsidiary') {
          return [{
            name: 'name1',
            booleanField: 'true',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '1',
            },
          }, {
            name: 'name2',
            booleanField: 'false',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '2',
            },
          }]
        }
        return []
      })
      const elements = await getDataElements(client, query)
      expect((elements[1] as InstanceElement).value.booleanField).toBe(true)
      expect((elements[2] as InstanceElement).value.booleanField).toBe(false)
    })

    it('should convert numbers', async () => {
      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'subsidiary') {
          return [{
            name: 'name',
            numberField: '1234',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '1',
            },
          }]
        }
        return []
      })
      const elements = await getDataElements(client, query)
      expect((elements[1] as InstanceElement).value.numberField).toBe(1234)
    })

    it('should use elemIdGetter', async () => {
      const elemIDGetter: ElemIdGetter = (adapterName, serviceIds, name) => {
        if (adapterName === NETSUITE
          && name === 'name'
          && _.isEqual(serviceIds, {
            name: 'name',
            [OBJECT_SERVICE_ID]: toServiceIdsString({
              [OBJECT_NAME]: 'netsuite.subsidiary',
            }),
          })) {
          return new ElemID(NETSUITE, 'subsidiary', 'instance', 'customName')
        }

        return new ElemID(NETSUITE, 'subsidiary', 'instance', name)
      }

      getAllRecordsMock.mockImplementation(async types => {
        if (types[0] === 'subsidiary') {
          return [{
            name: 'name',
            numberField: '1234',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '1',
            },
          }, {
            name: 'name2',
            numberField: '1234',
            attributes: {
              'xsi:type': 'listAcct:Subsidiary',
              internalId: '2',
            },
          }]
        }
        return []
      })
      const elements = await getDataElements(client, query, elemIDGetter)
      expect(elements[1].elemID).toEqual(new ElemID(NETSUITE, 'subsidiary', 'instance', 'customName'))
      expect(elements[2].elemID).toEqual(new ElemID(NETSUITE, 'subsidiary', 'instance', 'name2'))
    })
  })

  describe('getFieldInstanceTypes', () => {
    it('Should identify field instance with appliesto ', () => {
      const instance = new InstanceElement('name', entitycustomfieldType().type, { appliestocontact: true, appliestocustomer: false, appliestoemployee: true })
      expect(getFieldInstanceTypes(instance)).toEqual(['Contact', 'Employee'])
    })

    it('Should identify othercustomfield instance', () => {
      const instance = new InstanceElement('name', othercustomfieldType().type, { rectype: '-112' })
      expect(getFieldInstanceTypes(instance)).toEqual(['account'])
    })
  })
})
