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
import { RequestPromise } from 'requestretry'
import { OnFetchFilter } from 'src/filter'
import { Values, InstanceElement } from '@salto-io/adapter-api'
import { useridentifierObjectType } from '../common/mock_types'
import mockClient from '../client'
import filterCreator from '../../src/filters/useridentifier'

describe('useridentifier filter test', () => {
  let filter: OnFetchFilter
  const getOwners = async (): Promise<RequestPromise> => Promise.resolve([
    {
      activeUserId: 12,
      email: 'a@b.com',
    },
    {
      activeUserId: 34,
      email: 'c@d.com',
    },
    {
      activeUserId: 56,
      email: 'e@f.com',
    }]) as unknown as RequestPromise
  let objectInstance: InstanceElement
  let instanceValues: Values
  beforeEach(() => {
    instanceValues = {
      str: '12',
      simple: '12',
      simpleNum: '101',
      stringList: '12,34,56,non@owner.com',
      objField: {
        str: '12',
        simple: '12',
        simpleNum: '101',
        stringList: '12,34,56,non@owner.com',
      },
      listOfObjField: [
        {
          str: '12',
          simple: '12',
          simpleNum: '101',
          stringList: '12,34,56,non@owner.com',
        },
        {
          str: '34',
          simple: '34',
          simpleNum: '101',
          stringList: '34,56,12',
        },
      ],
      listOfListOfObjField: [
        [
          {
            str: '12',
            simple: '12',
            simpleNum: '101',
            stringList: '12,34,56,non@owner.com',
          },
          {
            str: '34',
            simple: '34',
            simpleNum: '101',
            stringList: '34,56,12',
          },
        ],
        [
          {
            str: '34',
            simple: '34',
            simpleNum: '101',
            stringList: '34,56,12',
          },
          {
            str: '12',
            simple: '12',
            simpleNum: '101',
            stringList: '12,34,56,non@owner.com',
          },
        ],
      ],
      listOfListOfListOfObjField: [
        [
          [
            {
              str: '12',
              simple: '12',
              simpleNum: '101',
              stringList: '12,34,56,non@owner.com',
            },
            {
              str: '34',
              simple: '34',
              simpleNum: '101',
              stringList: '34,56,12',
            },
          ],
        ],
      ],
    } as Values
    objectInstance = new InstanceElement(
      'objectInstance',
      useridentifierObjectType,
      instanceValues,
    )
    const { client } = mockClient()
    client.getOwners = jest.fn().mockImplementation(getOwners)
    filter = filterCreator({ client })
    filter.onFetch([objectInstance])
  })

  describe('should convert on top level', () => {
    it('should not effect non-useridentifier field values', () => {
      expect(objectInstance.value.str).toEqual(instanceValues.str)
    })

    it('should convert identifier at base level of object', () => {
      expect(objectInstance.value.simple).toEqual('a@b.com')
    })

    it('should convert unknown-identifier to string at base level of object', () => {
      expect(objectInstance.value.simpleNum).toEqual('101')
    })

    it('should convert to user identifier list when value is string', () => {
      expect(objectInstance.value.stringList).toEqual(['a@b.com', 'c@d.com', 'e@f.com', 'non@owner.com'])
    })
  })

  describe('should convert inside an object', () => {
    it('should not effect non-useridentifier field values inside an object field', () => {
      expect(objectInstance.value.objField.str).toEqual('12')
    })

    it('should convert identifier at base level of object inside an object field', () => {
      expect(objectInstance.value.objField.simple).toEqual('a@b.com')
    })

    it('should convert unknown-identifier to string inside an object field', () => {
      expect(objectInstance.value.objField.simpleNum).toEqual('101')
    })

    it('should convert to user identifier list when value is string inside an object field', () => {
      expect(objectInstance.value.objField.stringList).toEqual(['a@b.com', 'c@d.com', 'e@f.com', 'non@owner.com'])
    })
  })

  describe('should convert inside a list of object fields', () => {
    it('should not effect non-useridentifier field values inside a list of object fields', () => {
      expect(objectInstance.value.listOfObjField[0].str).toEqual('12')
    })

    it('should convert identifier at base level of object inside a list of object fields', () => {
      expect(objectInstance.value.listOfObjField[0].simple).toEqual('a@b.com')
    })

    it('should convert unknown-identifier to string inside a list of object fields', () => {
      expect(objectInstance.value.listOfObjField[0].simpleNum).toEqual('101')
    })

    it('should convert to user identifier list when value is string inside a list of object fields', () => {
      expect(objectInstance.value.listOfObjField[0].stringList).toEqual(['a@b.com', 'c@d.com', 'e@f.com', 'non@owner.com'])
    })
  })

  describe('should convert inside list of list of object fields', () => {
    it('should not effect non-useridentifier field values inside a list of list of object fields', () => {
      expect(objectInstance.value.listOfListOfObjField[0][0].str).toEqual('12')
    })

    it('should convert identifier at base level of object inside a list of list of object fields', () => {
      expect(objectInstance.value.listOfListOfObjField[0][0].simple).toEqual('a@b.com')
    })

    it('should convert unknown-identifier to string inside a list of list of object fields', () => {
      expect(objectInstance.value.listOfListOfObjField[0][0].simpleNum).toEqual('101')
    })

    it('should convert to user identifier list when value is string inside a list of list of object fields', () => {
      expect(objectInstance.value.listOfListOfObjField[0][0].stringList).toEqual(['a@b.com', 'c@d.com', 'e@f.com', 'non@owner.com'])
    })
  })

  describe('should convert inside list of list of list of object fields', () => {
    it('should not effect non-useridentifier field values inside a list of list of list of object fields', () => {
      expect(objectInstance.value.listOfListOfListOfObjField[0][0][0].str).toEqual('12')
    })

    it('should convert identifier at base level of object inside a list of list of list of object fields', () => {
      expect(objectInstance.value.listOfListOfListOfObjField[0][0][0].simple).toEqual('a@b.com')
    })

    it('should convert unknown-identifier to string inside a list of list of of list object fields', () => {
      expect(objectInstance.value.listOfListOfListOfObjField[0][0][0].simpleNum).toEqual('101')
    })

    it('should convert to user identifier list when value is string inside a list of list of list of object fields', () => {
      expect(objectInstance.value.listOfListOfListOfObjField[0][0][0].stringList).toEqual(['a@b.com', 'c@d.com', 'e@f.com', 'non@owner.com'])
    })
  })
})
