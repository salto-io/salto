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
import { ObjectType, ElemID, Field, ListType, Values, InstanceElement, BuiltinTypes } from '@salto-io/adapter-api'
import { HUBSPOT } from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import mockClient from '../client'
import filterCreator from '../../src/filters/useridentifier'

describe('useridentifier filter test', () => {
  let filter: OnFetchFilter
  const objectElemID = new ElemID(HUBSPOT, 'object')
  const innerObjectElemID = new ElemID(HUBSPOT, 'innerObject')
  const simpleField = (parentElemID: ElemID): Field =>
    new Field(
      parentElemID, 'simple',
      Types.userIdentifierType, {
        name: 'simple',
        _readOnly: false,
      },
    )
  const stringListField = (parentElemID: ElemID): Field =>
    new Field(
      parentElemID, 'stringList',
      new ListType(Types.userIdentifierType), {
        name: 'stringList',
        _readOnly: false,
      },
    )
  const stringArrayField = (parentElemID: ElemID): Field =>
    new Field(
      parentElemID, 'stringArray',
      new ListType(Types.userIdentifierType), {
        name: 'stringArray',
        _readOnly: false,
      },
    )
  const strField = (parentElemID: ElemID): Field =>
    new Field(
      parentElemID, 'str', BuiltinTypes.STRING, {
        name: 'str',
      }
    )
  const innerObject = new ObjectType(
    {
      elemID: innerObjectElemID,
      fields: {
        str: strField(innerObjectElemID),
        simple: simpleField(innerObjectElemID),
        stringList: stringListField(innerObjectElemID),
        stringArray: stringArrayField(innerObjectElemID),
      },
    }
  )
  const objectType = new ObjectType(
    {
      elemID: objectElemID,
      fields: {
        str: strField(objectElemID),
        simple: simpleField(objectElemID),
        stringList: stringListField(objectElemID),
        stringArray: stringArrayField(objectElemID),
        objField: new Field(
          objectElemID, 'objField', innerObject, {
            name: 'objField',
            _readOnly: false,
          },
        ),
        listOfObjField: new Field(
          objectElemID, 'listOfObjField',
          new ListType(innerObject), {
            name: 'listOfObjField',
            _readOnly: false,
          },
        ),
      },
    }
  )
  const getOwnerById = (id: number | string): RequestPromise => {
    switch (id) {
      case '12':
        return 'a@b.com' as unknown as RequestPromise
      case '34':
        return 'c@d.com' as unknown as RequestPromise
      case '56':
        return 'e@f.com' as unknown as RequestPromise
      default:
        return '' as unknown as RequestPromise
    }
  }
  let objectInstance: InstanceElement
  let instanceValues: Values
  beforeEach(() => {
    instanceValues = {
      str: '12',
      simple: '12',
      stringList: '12,34,56',
      stringArray: ['12', '34', '56'],
      objField: {
        str: '12',
        simple: '12',
        stringList: '12,34,56',
        stringArray: ['12', '34', '56'],
      },
      listOfObjField: [
        {
          str: '12',
          simple: '12',
          stringList: '12,34,56',
          stringArray: ['12', '34', '56'],
        },
        {
          str: '34',
          simple: '34',
          stringList: '34,56,12',
          stringArray: ['34', '56', '12'],
        },
      ],
    } as Values
    objectInstance = new InstanceElement(
      'objectInstance',
      objectType,
      instanceValues,
    )
    const { client } = mockClient()
    client.getOwnerById = jest.fn().mockImplementation(getOwnerById)
    filter = filterCreator({ client })
    filter.onFetch([objectInstance])
  })

  it('should not effect non-useridentifier field values', () => {
    expect(objectInstance.value.str).toEqual(instanceValues.str)
  })

  it('should convert identifier at base level of object', () => {
    expect(objectInstance.value.simple).toEqual('a@b.com')
  })

  it('should convert to user identifier list when value is an array', () => {
    expect(objectInstance.value.stringArray).toEqual(['a@b.com', 'c@d.com', 'e@f.com'])
  })

  it('should convert to user identifier list when value is string', () => {
    expect(objectInstance.value.stringList).toEqual(['a@b.com', 'c@d.com', 'e@f.com'])
  })

  it('should not effect non-useridentifier field values inside an object field', () => {
    expect(objectInstance.value.objField.str).toEqual('12')
  })

  it('should convert identifier at base level of object inside an object field', () => {
    expect(objectInstance.value.objField.simple).toEqual('a@b.com')
  })

  it('should convert to user identifier list when value is an array inside an object field', () => {
    expect(objectInstance.value.objField.stringArray).toEqual(['a@b.com', 'c@d.com', 'e@f.com'])
  })

  it('should convert to user identifier list when value is string inside an object field', () => {
    expect(objectInstance.value.objField.stringList).toEqual(['a@b.com', 'c@d.com', 'e@f.com'])
  })

  it('should not effect non-useridentifier field values inside a list of object fields', () => {
    expect(objectInstance.value.listOfObjField[0].str).toEqual('12')
  })

  it('should convert identifier at base level of object inside a list of object fields', () => {
    expect(objectInstance.value.listOfObjField[0].simple).toEqual('a@b.com')
  })

  it('should convert to user identifier list when value is an array inside a list of object fields', () => {
    expect(objectInstance.value.listOfObjField[0].stringArray).toEqual(['a@b.com', 'c@d.com', 'e@f.com'])
  })

  it('should convert to user identifier list when value is string inside a list of object fields', () => {
    expect(objectInstance.value.listOfObjField[0].stringList).toEqual(['a@b.com', 'c@d.com', 'e@f.com'])
  })
})
