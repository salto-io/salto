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
  BuiltinTypes, CORE_ANNOTATIONS, Element, ElemID, InstanceElement, ListType,
  ObjectType, PrimitiveType, PrimitiveTypes,
} from '@salto-io/adapter-api'
// eslint-disable-next-line no-restricted-imports
import {
  LABEL, METADATA_TYPE,
} from '@salto-io/salesforce-adapter/dist/src/constants'
import {
  addHiddenValuesAndHiddenTypes,
  removeHiddenValuesForInstance,
} from '../../src/workspace/hidden_values'

describe('hidden_values.ts', () => {
  const anotherTypeID = new ElemID('dummy', 'hiddenType')
  const innerObjectElemID = new ElemID('dummy', 'innerObject')
  const innerObject = new ObjectType(
    {
      elemID: innerObjectElemID,
      fields: {
        num: { type: BuiltinTypes.NUMBER },
        stringList: { type: new ListType(BuiltinTypes.STRING) },
        hiddenStr: {
          type: BuiltinTypes.STRING,
          annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
        },
      },
    }
  )

  const hiddenType = new ObjectType({
    elemID: anotherTypeID,
    fields: {
      reg: { type: BuiltinTypes.STRING },
      listOfObjects: {
        type: new ListType(innerObject),
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
      },
      notHidden: {
        type: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
      },
      hidden: {
        type: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      objField: {
        type: innerObject,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
      },
      numHidden: {
        type: BuiltinTypes.NUMBER,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      hiddenList: {
        type: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      hiddenObj: {
        type: innerObject,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      addedField: { type: BuiltinTypes.STRING },
    },
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
    path: ['records', 'hidden'],
  })


  const regTypeID = new ElemID('dummy', 'regType')
  const notHiddenType = new ObjectType({
    elemID: regTypeID,
    fields: {
      str: { type: BuiltinTypes.STRING },
      num2: { type: BuiltinTypes.NUMBER },
    },
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
  })

  const primType = new PrimitiveType({
    elemID: new ElemID('dummy', 'PrimType'),
    primitive: PrimitiveTypes.STRING,
  })

  const hiddenPrimType = new PrimitiveType({
    elemID: new ElemID('dummy', 'hiddenPrimType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
      [LABEL]: 'hiddenPrimType',
    },
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
        hiddenStr: 'test1',
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
    hiddenList: ['a', 'b', ''],
    hiddenObj: {
      num: 111,
      stringList: 'asd,foo',
      hiddenStr: 'hid',
    },
  })


  const instanceWithoutHiddenValues = hiddenInstance.clone()

  // removing all hidden values
  delete instanceWithoutHiddenValues.value.hidden
  delete instanceWithoutHiddenValues.value.listOfObjects[0].hiddenStr
  delete instanceWithoutHiddenValues.value.listOfObjects[2].hiddenStr
  delete instanceWithoutHiddenValues.value.objField.hiddenStr
  delete instanceWithoutHiddenValues.value.numHidden
  delete instanceWithoutHiddenValues.value.hiddenList
  delete instanceWithoutHiddenValues.value.hiddenObj


  describe('removeHiddenValuesForInstance func', () => {
    describe('instance', () => {
      const instanceAfterHiddenRemoved = instanceWithoutHiddenValues.clone()

      const clonedHiddenInstance = hiddenInstance.clone()

      let resp: Element
      beforeAll(async () => {
        resp = removeHiddenValuesForInstance(clonedHiddenInstance)
      })

      it('should remove hidden values ', () => {
        expect(resp.isEqual(instanceAfterHiddenRemoved)).toBeTruthy()
      })

      it('should not done in-place', () => {
        expect(clonedHiddenInstance.isEqual(hiddenInstance)).toBeTruthy()
      })
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
    const hiddenTypePlaceholder = new ObjectType({
      elemID: anotherTypeID,
    })
    workspaceInstance.type = hiddenTypePlaceholder

    const newWorkspaceInstance = new InstanceElement(
      'new_instance_elem_id',
      hiddenTypePlaceholder,
      {
        reg: 'newReg',
        notHidden: 'notHidden2',
      },
    )

    const newWorkspaceSubType = new ObjectType({
      elemID: new ElemID('dummy', 'newType'),
      fields: {
        innerHiddenType: { type: new ObjectType(
          { elemID: new ElemID('dummy', 'hiddenPrimType') }
        ) },
        num2: { type: BuiltinTypes.NUMBER },
      },
      annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
    })

    const newWorkspaceCustomObject = new ObjectType({
      elemID: new ElemID('dummy', 'newTypeA'),
      fields: {
        innerHiddenTypeObj: { type: newWorkspaceSubType },
        str2: { type: BuiltinTypes.STRING },
      },
      annotations: {
        [METADATA_TYPE]: 'CustomObject',
        [CORE_ANNOTATIONS.HIDDEN]: false,
      },
    })

    const newNormalInstance = new InstanceElement('instance_non_hidden_type', newWorkspaceSubType, {})

    const workspaceElements = [
      primType.clone(),
      notHiddenType.clone(),
      workspaceInstance,
      newWorkspaceInstance,
      newWorkspaceSubType,
      newWorkspaceCustomObject,
      newNormalInstance,
    ]

    // State elements
    const stateInstance = hiddenInstance.clone()

    const stateElements = [
      primType.clone(),
      notHiddenType.clone(),
      stateInstance,
      hiddenType.clone(),
      hiddenPrimType.clone(),
    ]

    let resp: Element[]
    let instanceAfterHiddenAddition: InstanceElement
    let newInstanceAfterHiddenAddition: InstanceElement
    let hiddenTypeAddition: ObjectType
    let hiddenPrimTypeAddition: PrimitiveType
    let newSubType: ObjectType
    let newCustomObject: ObjectType
    let normalInstance: InstanceElement

    const clonedNewWorkspaceSubType = newWorkspaceSubType.clone()

    beforeAll(async () => {
      resp = addHiddenValuesAndHiddenTypes(workspaceElements, stateElements)

      instanceAfterHiddenAddition = resp[2] as InstanceElement
      newInstanceAfterHiddenAddition = resp[3] as InstanceElement
      newSubType = resp[4] as ObjectType
      newCustomObject = resp[5] as ObjectType
      normalInstance = resp[6] as InstanceElement
      hiddenTypeAddition = resp[7] as ObjectType
      hiddenPrimTypeAddition = resp[8] as PrimitiveType
    })

    it('should add hidden type to workspace elements list', () => {
      expect(resp).toHaveLength(workspaceElements.length + 2)
      expect(hiddenTypeAddition.isEqual(hiddenType))
        .toBeTruthy()
      expect(hiddenPrimTypeAddition.isEqual(hiddenPrimType))
        .toBeTruthy()
    })

    it('should add hidden values from state elements', () => {
      expect(instanceAfterHiddenAddition.value.hidden).toEqual(stateInstance.value.hidden)
      expect(instanceAfterHiddenAddition.value.listOfObjects[0].hiddenStr)
        .toEqual(stateInstance.value.listOfObjects[0].hiddenStr)
      expect(instanceAfterHiddenAddition.value.listOfObjects[2].hiddenStr)
        .toEqual(stateInstance.value.listOfObjects[2].hiddenStr)
      expect(instanceAfterHiddenAddition.value.objField.hiddenStr)
        .toEqual(stateInstance.value.objField.hiddenStr)
      expect(instanceAfterHiddenAddition.value.hiddenList)
        .toEqual(stateInstance.value.hiddenList)
      expect(instanceAfterHiddenAddition.value.hiddenObj)
        .toEqual(stateInstance.value.hiddenObj)
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
      expect(stateElements).toHaveLength(5)

      expect((stateElements[0] as PrimitiveType).isEqual(primType)).toBeTruthy()
      expect((stateElements[1] as ObjectType).isEqual(notHiddenType)).toBeTruthy()
      expect((stateElements[2] as InstanceElement).isEqual(hiddenInstance)).toBeTruthy()
      expect((stateElements[3] as ObjectType).isEqual(hiddenType)).toBeTruthy()
      expect((stateElements[4] as PrimitiveType).isEqual(hiddenPrimType)).toBeTruthy()
    })

    it('should change new type fields (type)', () => {
      expect(newSubType).not.toEqual(clonedNewWorkspaceSubType)

      expect(newSubType.fields.innerHiddenType.type).toEqual(hiddenPrimType)
    })

    it('should replace all the inner hidden types', () => {
      expect(
        (newCustomObject.fields.innerHiddenTypeObj.type as ObjectType).fields.innerHiddenType.type
      )
        .toEqual(hiddenPrimType)
    })

    it('should not change new instances', () => {
      expect(normalInstance).toEqual(newNormalInstance)
    })
  })
})
