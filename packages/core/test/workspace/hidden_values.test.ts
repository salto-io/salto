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

import {
  BuiltinTypes, CORE_ANNOTATIONS, Element, ElemID, Field, InstanceElement, ListType,
  ObjectType,
} from '@salto-io/adapter-api'
import {
  removeHiddenValues,
} from '../../src/workspace/hidden_values'

describe('hidden_values.ts', () => {
  const anotherTypeID = new ElemID('dummy', 'hiddenType')
  const innerObjectElemID = new ElemID('dummy', 'innerObject')
  const innerObject = new ObjectType(
    {
      elemID: innerObjectElemID,
      fields: {
        num: new Field(innerObjectElemID, 'num', BuiltinTypes.NUMBER),
        stringList: new Field(innerObjectElemID, 'stringList', new ListType(BuiltinTypes.STRING)),
      },
    }
  )

  const typeWithHiddenField = new ObjectType({
    elemID: anotherTypeID,
    fields: {
      reg: new Field(anotherTypeID, 'reg', BuiltinTypes.STRING),
      listOfObjects: new Field(anotherTypeID, 'listOfObjects', new ListType(innerObject)),
      notHidden: new Field(
        anotherTypeID,
        'notHidden',
        BuiltinTypes.STRING,
        { [CORE_ANNOTATIONS.HIDDEN]: false }
      ),
      hidden: new Field(
        anotherTypeID,
        'hidden',
        BuiltinTypes.STRING,
        { [CORE_ANNOTATIONS.HIDDEN]: true }
      ),
    },
    path: ['records', 'hidden'],
  })

  const hiddenInstance = new InstanceElement('instance_elem_id_name', typeWithHiddenField, {
    reg: 'reg',
    listOfObjects: [
      {
        num: 1239,
        stringList: 'test,test2,123',
      },
      {
        num: 23,
        stringList: 'abc,123,de,fg',
      },
      {
        num: 11,
        stringList: 'test@gmail.com,test2,111',
      },
      {
        num: 2,
        stringList: 'test123@gmail.com,test11',
      },
    ],
    notHidden: 'notHidden',
    hidden: 'Hidden',
    val: 'val',
  })


  describe('removeHiddenValues func', () => {
    describe('type', () => {
      const objType = new ObjectType({ elemID: new ElemID('dummyAdapter', 'dummy') })

      let resp: Element
      beforeAll(async () => {
        resp = removeHiddenValues(objType)
      })

      it('should not change type (for now...)', () => {
        expect(resp.isEqual(objType)).toBeTruthy()
      })
    })


    describe('instance', () => {
      const instanceAfterHiddenRemoved = hiddenInstance.clone()
      delete instanceAfterHiddenRemoved.value.hidden

      const clonedHiddenInstance = hiddenInstance.clone()

      let resp: Element
      beforeAll(async () => {
        resp = removeHiddenValues(clonedHiddenInstance)
      })

      it('should remove hidden values ', () => {
        expect(resp.isEqual(instanceAfterHiddenRemoved)).toBeTruthy()
      })

      it('should not done in-place', () => {
        expect(clonedHiddenInstance.isEqual(hiddenInstance)).toBeTruthy()
      })
    })
  })
})
