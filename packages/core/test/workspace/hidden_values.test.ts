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
  addHiddenValuesAndHiddenTypes,
  removeHiddenFieldsValues,
  removeHiddenValuesAndHiddenTypes,
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

  const hiddenType = new ObjectType({
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
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
    path: ['records', 'hidden'],
  })


  const regTypeID = new ElemID('dummy', 'regType')
  const notHiddenType = new ObjectType({
    elemID: regTypeID,
    fields: {
      str: new Field(new ElemID('dummy', 'strField'), 'str', BuiltinTypes.STRING),
      num2: new Field(new ElemID('dummy', 'numField'), 'num2', BuiltinTypes.NUMBER),
    },
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
  })

  const hiddenInstance = new InstanceElement('instance_elem_id_name', hiddenType, {
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


  const instanceWithoutHiddenValues = hiddenInstance.clone()

  // removing all hidden values
  delete instanceWithoutHiddenValues.value.hidden
  delete instanceWithoutHiddenValues.value.listOfObjects[0].hiddenStr
  delete instanceWithoutHiddenValues.value.objField.hiddenStr
  delete instanceWithoutHiddenValues.value.numHidden


  describe('removeHiddenFieldsValues func', () => {
    describe('type', () => {
      const objType = new ObjectType({ elemID: new ElemID('dummyAdapter', 'dummy') })

      let resp: Element
      beforeAll(async () => {
        resp = removeHiddenFieldsValues(objType)
      })

      it('should not change type (for now...)', () => {
        expect(resp.isEqual(objType)).toBeTruthy()
      })
    })


    describe('instance', () => {
      const instanceAfterHiddenRemoved = instanceWithoutHiddenValues.clone()

      const clonedHiddenInstance = hiddenInstance.clone()

      let resp: Element
      beforeAll(async () => {
        resp = removeHiddenFieldsValues(clonedHiddenInstance)
      })

      it('should remove hidden values ', () => {
        expect(resp.isEqual(instanceAfterHiddenRemoved)).toBeTruthy()
      })

      it('should not done in-place', () => {
        expect(clonedHiddenInstance.isEqual(hiddenInstance)).toBeTruthy()
      })
    })
  })

  describe('removeHiddenValuesAndHiddenTypes func', () => {
    const elements = [hiddenType.clone(), notHiddenType.clone(), hiddenInstance.clone()]
    let resp: Element[]
    beforeAll(async () => {
      resp = removeHiddenValuesAndHiddenTypes(elements)
    })

    it('should remove hidden type', () => {
      expect(resp).toHaveLength(elements.length - 1)
      expect(resp).not.toContain(hiddenType)
    })

    it('should not change notHiddenType', () => {
      expect((resp[0] as ObjectType).isEqual(notHiddenType)).toBeTruthy()
    })

    it('should remove all hidden (fields) values in instance', () => {
      const instanceAfterRemoveHidden = resp[1] as InstanceElement

      // checking instance existence
      expect(instanceAfterRemoveHidden.elemID.getFullName())
        .toEqual(hiddenInstance.elemID.getFullName())

      // checking hidden values removal
      expect(instanceAfterRemoveHidden).toEqual(instanceWithoutHiddenValues)
    })
  })

  describe('addHiddenValuesAndHiddenTypes func', () => {
    // workspace elements should not contain hidden values
    const workspaceInstance = instanceWithoutHiddenValues.clone()


    // workspace changes
    workspaceInstance.value.notHidden = 'notHiddenChanged'
    workspaceInstance.value.addedField = 'addedField'
    workspaceInstance.value.listOfObjects[0].num = 12345
    workspaceInstance.value.numHidden = 11111

    // When type is hidden: (workspace) instance will contain an 'empty' type (only with elemID)
    workspaceInstance.type = new ObjectType({
      elemID: anotherTypeID,
    })


    const newWorkspaceInstance = new InstanceElement('instance_elem_id_name', new ObjectType({
      elemID: anotherTypeID,
    }), {
      reg: 'newReg',
      notHidden: 'notHidden2',
    })

    const workspaceElements = [notHiddenType.clone(), workspaceInstance, newWorkspaceInstance]

    // State elements
    const stateInstance = hiddenInstance.clone()
    const stateHiddenType = hiddenType.clone()

    const stateElements = [notHiddenType.clone(), stateInstance, stateHiddenType]

    let resp: Element[]
    let instanceAfterHiddenAddition: InstanceElement
    let newInstanceAfterHiddenAddition: InstanceElement
    let hiddenTypeAddition: ObjectType

    beforeAll(async () => {
      resp = addHiddenValuesAndHiddenTypes(workspaceElements, stateElements)

      instanceAfterHiddenAddition = resp[1] as InstanceElement
      newInstanceAfterHiddenAddition = resp[2] as InstanceElement
      hiddenTypeAddition = resp[3] as ObjectType
    })

    it('should add hidden type to workspace elements list', () => {
      expect(resp).toHaveLength(workspaceElements.length + 1)
      expect(hiddenTypeAddition.isEqual(hiddenType))
        .toBeTruthy()
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
      expect(workspaceInstance.value.listOfObjects)
        .toHaveLength(instanceAfterHiddenAddition.value.listOfObjects.length)
    })

    it('should inject the complete type into instance', () => {
      expect(instanceAfterHiddenAddition.type.isEqual(hiddenType))
        .toBeTruthy()
    })

    it('should inject the complete type into newInstance', () => {
      expect(newInstanceAfterHiddenAddition.type.isEqual(hiddenType))
        .toBeTruthy()
    })

    it('should not done in-place for state elements', () => {
      expect(stateElements).toHaveLength(3)

      expect((stateElements[0] as ObjectType).isEqual(notHiddenType)).toBeTruthy()
      expect((stateElements[1] as InstanceElement).isEqual(hiddenInstance)).toBeTruthy()
      expect((stateElements[2] as ObjectType).isEqual(hiddenType)).toBeTruthy()
    })
  })
})
