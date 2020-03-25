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
import _ from 'lodash'
import { InstanceElement, ObjectType, ElemID, BuiltinTypes, Field, ReferenceExpression, ListType } from '@salto-io/adapter-api'
import { INSTANCE_FULL_NAME_FIELD, SALESFORCE, METADATA_TYPE, CUSTOM_OBJECT, API_NAME, CUSTOM_FIELD } from '../../src/constants'
import { replaceInstances, groupByAPIName } from '../../src/filters/instance_references'

describe('instance_reference filter', () => {
  // Definitions
  const parentObjFullName = 'parentFullName'
  const parentObjFieldName = 'parentObj'
  const otherRefObjName = 'otherRefObj'
  const nestedId = new ElemID(SALESFORCE, 'nested')
  const objTypeID = new ElemID(SALESFORCE, 'obj')
  const nestedType = new ObjectType({
    elemID: nestedId,
    fields: {
      parentObj: new Field(objTypeID, parentObjFieldName, BuiltinTypes.STRING),
      otherRefObj: new Field(objTypeID, otherRefObjName, BuiltinTypes.STRING),
    },
  })
  const objType = new ObjectType({
    annotations: { [METADATA_TYPE]: 'obj' },
    elemID: objTypeID,
    fields: {
      reg: new Field(objTypeID, 'reg', BuiltinTypes.STRING),
      parentObj: new Field(objTypeID, parentObjFieldName, BuiltinTypes.STRING),
      otherRefObj: new Field(objTypeID, otherRefObjName, BuiltinTypes.STRING),
      parentObjNested: new Field(objTypeID, 'parentObjNested', nestedType, {}),
      parentObjArr: new Field(
        objTypeID, parentObjFieldName, new ListType(BuiltinTypes.STRING), {},
      ),
    },
  })

  // Instances
  const parentInstance = new InstanceElement('parentInstance', objType, {
    [INSTANCE_FULL_NAME_FIELD]: parentObjFullName,
    reg: 'orig',
    parentObjNested: {
      nestedInst: 'InstRef',
    },
    parentObjArr: ['arrValue'],
  })

  const referrerInstance = new InstanceElement('referrerInstance', objType, {
    [INSTANCE_FULL_NAME_FIELD]: 'referrerInstance',
    parentObj: parentObjFullName,
    otherRefObj: parentObjFullName,
    reg: 'someRegularValue',
    parentObjNested: {
      parentObj: parentObjFullName,
    },
    parentObjArr: [parentObjFullName],
  })

  const instanceWithoutReferences = new InstanceElement('instanceWithoutReferences', objType, {
    [INSTANCE_FULL_NAME_FIELD]: 'noChangesInstance',
    reg: 'somevalue',
    parentObj: 'someParent',
  })

  const elements = [
    parentInstance,
    referrerInstance,
    instanceWithoutReferences,
  ]

  const fieldToTypeMap = new Map<string, string>(
    [
      [new ElemID(SALESFORCE, objTypeID.typeName, 'field', parentObjFieldName).getFullName(), objTypeID.typeName],
      [new ElemID(SALESFORCE, objTypeID.typeName, 'field', otherRefObjName).getFullName(), 'nonExistingType'],
    ]
  )

  // Run the filter
  const elementsToFilter = _.cloneDeep(elements)
  replaceInstances(elementsToFilter, fieldToTypeMap)
  const parentInstanceFiltered = elementsToFilter[0]
  const referrerInstanceFiltered = elementsToFilter[1]
  const instanceWithoutReferencesFiltered = elementsToFilter[2]

  // Test the results
  describe('replace values', () => {
    it('should replace regular values to references', () => {
      expect(referrerInstanceFiltered.value.parentObj).toBeInstanceOf(ReferenceExpression)
      expect(referrerInstanceFiltered.value.parentObj.elemId.typeName).toEqual(objTypeID.typeName)
    })

    it('should replace nested objects to references', () => {
      expect(referrerInstanceFiltered.value.parentObjNested.parentObj)
        .toBeInstanceOf(ReferenceExpression)
    })

    it('should replace objects in arrays to references', () => {
      expect(_.head(referrerInstanceFiltered.value.parentObjArr))
        .toBeInstanceOf(ReferenceExpression)
    })

    it('should not change an instance without any references defined in the mapping', () => {
      expect(instanceWithoutReferencesFiltered).toStrictEqual(instanceWithoutReferences)
      expect(parentInstanceFiltered).toStrictEqual(parentInstance)
    })

    it('should not replace regular values', () => {
      expect(referrerInstanceFiltered.value.reg).toEqual(referrerInstance.value.reg)
      expect(parentInstanceFiltered.value.reg).toEqual(parentInstance.value.reg)
    })

    it('should not replace a ref that is defined in the map but with non existing type', () => {
      expect(referrerInstanceFiltered.value.otherRefObj).toEqual(parentObjFullName)
    })
  })

  const apiToTypesToElemIDs = groupByAPIName(elements)
  describe('building api name => type names => elemIDs map', () => {
    it('should have all defined apinames', () => {
      expect(_.keys(apiToTypesToElemIDs).length).toEqual(3)
      expect(_.keys(apiToTypesToElemIDs))
        .toContain(parentInstance.value[INSTANCE_FULL_NAME_FIELD])
      expect(_.keys(apiToTypesToElemIDs))
        .toContain(referrerInstance.value[INSTANCE_FULL_NAME_FIELD])
      expect(_.keys(apiToTypesToElemIDs))
        .toContain(instanceWithoutReferences.value[INSTANCE_FULL_NAME_FIELD])
    })

    it('should have obj type in every api name that point to ElemID', () => {
      _.keys(apiToTypesToElemIDs).forEach(apiName => {
        expect(_.keys(apiToTypesToElemIDs[apiName])).toContain(objTypeID.typeName)
        expect(apiToTypesToElemIDs[apiName][objTypeID.typeName]).toBeInstanceOf(ElemID)
      })
    })
  })

  describe('reference CustomObject', () => {
    const targetElemID = new ElemID(SALESFORCE, 'Target')
    const fieldName = 'Field'
    const targetCustomObject = new ObjectType({
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
        [API_NAME]: 'Target',
      },
      elemID: targetElemID,
      fields: {
        [fieldName]: new Field(targetElemID, fieldName, BuiltinTypes.STRING,
          { [API_NAME]: 'Target.Field' }),
      },
    })

    const srcId = new ElemID(SALESFORCE, 'src')
    const srcObj = 'srcObj'
    const srcField = 'srcField'
    const srcType = new ObjectType({
      annotations: { [METADATA_TYPE]: 'src' },
      elemID: srcId,
      fields: {
        [srcObj]: new Field(srcId, srcObj, BuiltinTypes.STRING),
        [srcField]: new Field(srcId, srcField, BuiltinTypes.STRING),
      },
    })

    const srcInstance = new InstanceElement('srcInstace', srcType, {
      [INSTANCE_FULL_NAME_FIELD]: `${srcType.annotations[METADATA_TYPE]}.srcInstance`,
      [srcObj]: 'Target',
      [srcField]: 'Target.Field',
    })

    const fieldToTypeMapForCustom = new Map<string, string>(
      [
        [new ElemID(SALESFORCE, srcType.elemID.typeName, 'field', srcObj).getFullName(), CUSTOM_OBJECT],
        [new ElemID(SALESFORCE, srcType.elemID.typeName, 'field', srcField).getFullName(), CUSTOM_FIELD],
      ]
    )

    const post = _.cloneDeep([targetCustomObject, srcType, srcInstance])
    replaceInstances(post, fieldToTypeMapForCustom)

    const srcPostReplace = post[2] as InstanceElement

    it('should find reference to CustomObject', () => {
      expect(srcPostReplace.value[srcObj]).toBeInstanceOf(ReferenceExpression)
    })

    it('should find reference to CustomField', () => {
      expect(srcPostReplace.value[srcField]).toBeInstanceOf(ReferenceExpression)
    })
  })
})
