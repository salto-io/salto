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
  addHiddenValues,
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
        hiddenStr: new Field(
          innerObjectElemID,
          'hiddenStr',
          BuiltinTypes.STRING,
          { [CORE_ANNOTATIONS.HIDDEN]: true }
        ),
      },
    }
  )

  const typeWithHiddenField = new ObjectType({
    elemID: anotherTypeID,
    fields: {
      reg: new Field(anotherTypeID, 'reg', BuiltinTypes.STRING),
      listOfObjects: new Field(
        anotherTypeID,
        'listOfObjects',
        new ListType(innerObject),
        { [CORE_ANNOTATIONS.HIDDEN]: true }
      ),
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
      objField: new Field(
        anotherTypeID,
        'objField',
        innerObject,
        { [CORE_ANNOTATIONS.HIDDEN]: true }
      ),
      numHidden: new Field(
        anotherTypeID,
        'numHidden',
        BuiltinTypes.NUMBER,
        { [CORE_ANNOTATIONS.HIDDEN]: true }
      ),
      addedField: new Field(anotherTypeID, 'addedField', BuiltinTypes.STRING),
    },
    path: ['records', 'hidden'],
  })

  const hiddenInstance = new InstanceElement('instance_elem_id_name', typeWithHiddenField, {
    reg: 'reg',
    listOfObjects: [
      {
        num: 1239,
        stringList: 'test,test2,123',
        hiddenStr: 'testing',
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
    numHidden: 123,
    objField: {
      num: 1212,
      stringList: 'test1,tes2,3',
      hiddenStr: 'hiddenString',
    },
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
      delete instanceAfterHiddenRemoved.value.listOfObjects[0].hiddenStr
      delete instanceAfterHiddenRemoved.value.objField.hiddenStr
      delete instanceAfterHiddenRemoved.value.numHidden

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

  describe('addHiddenValues func', () => {
    describe('instances', () => {
      const workspaceInstance = hiddenInstance.clone()

      // workspace elements should not contain hidden values
      delete workspaceInstance.value.hidden
      delete workspaceInstance.value.listOfObjects[0].hiddenStr
      delete workspaceInstance.value.objField.hiddenStr

      // workspace changes
      workspaceInstance.value.notHidden = 'notHiddenChanged'
      workspaceInstance.value.addedField = 'addedField'
      workspaceInstance.value.listOfObjects[0].num = 12345
      workspaceInstance.value.numHidden = 11111


      const stateInstance = hiddenInstance.clone()

      let resp: Element[]
      let instanceAfterHiddenAddition: InstanceElement
      beforeAll(async () => {
        resp = addHiddenValues([workspaceInstance], [stateInstance])
        instanceAfterHiddenAddition = resp[0] as InstanceElement
      })

      it('should add hidden values from state elements', () => {
        expect(instanceAfterHiddenAddition.value.hidden).toEqual(stateInstance.value.hidden)
        expect(instanceAfterHiddenAddition.value.listOfObjects[0].hiddenStr)
          .toEqual(stateInstance.value.listOfObjects[0].hiddenStr)
        expect(instanceAfterHiddenAddition.value.objField.hiddenStr)
          .toEqual(stateInstance.value.objField.hiddenStr)
      })

      it('should ignore hidden values from workspace element', () => {
        expect(instanceAfterHiddenAddition.value.numHidden)
          .toEqual(stateInstance.value.numHidden)
      })

      it('should not change workspace (not hidden) element values', () => {
        expect(workspaceInstance.value.notHidden)
          .toEqual(instanceAfterHiddenAddition.value.notHidden)
        expect(workspaceInstance.value.reg)
          .toEqual(instanceAfterHiddenAddition.value.reg)
        expect(workspaceInstance.value.listOfObjects[0].num)
          .toEqual(instanceAfterHiddenAddition.value.listOfObjects[0].num)
      })

      it('should not done in-place', () => {
        expect(stateInstance.isEqual(hiddenInstance)).toBeTruthy()
      })
    })
  })
})
