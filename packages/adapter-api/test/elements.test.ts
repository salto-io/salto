/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS } from '../src/builtins'
import {
  Field, InstanceElement, ObjectType, PrimitiveType, isObjectType, isInstanceElement,
  PrimitiveTypes, ListType, isPrimitiveType, isType, isListType, isEqualElements, Variable,
  isVariable, isMapType, MapType, isContainerType, createRefToElmWithValue, PlaceholderObjectType,
} from '../src/elements'
import { ElemID, INSTANCE_ANNOTATIONS } from '../src/element_id'
import { TypeReference } from '../src/values'

describe('Test elements.ts', () => {
  /**   ElemIDs   * */
  const primID = new ElemID('test', 'prim')

  /**   primitives   * */
  const primStr = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: {},
    annotations: {},
  })

  const primNum = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.NUMBER,
    annotationRefsOrTypes: {},
    annotations: {},
  })

  /**   object types   * */
  const otID = new ElemID('test', 'obj')
  const ot = new ObjectType({
    elemID: otID,
    fields: {
      // eslint-disable-next-line camelcase
      num_field: { refType: primNum },
      // eslint-disable-next-line camelcase
      str_field: { refType: primStr },
    },
    annotationRefsOrTypes: {},
    annotations: {},
  })

  const lt = new ListType(primStr)
  const mt = new MapType(primStr)

  it('should create a basic primitive type with all params passed to the constructor', () => {
    expect(primStr.elemID).toEqual(primID)
    expect(primStr.primitive).toBe(PrimitiveTypes.STRING)

    expect(primNum.elemID).toEqual(primID)
    expect(primNum.primitive).toBe(PrimitiveTypes.NUMBER)
  })

  it('should clone path when a primitive type is cloned', () => {
    const primToClone = new PrimitiveType({
      elemID: primID,
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {},
      annotations: {},
      path: ['testPath'],
    })
    expect(primToClone.clone().path).toEqual(['testPath'])
  })

  it('should create a basic object type with all params passed to the constructor', async () => {
    expect(ot.elemID).toEqual(otID)
    expect(await ot.fields.num_field.getType()).toBeInstanceOf(PrimitiveType)
    expect(await ot.fields.str_field.getType()).toBeInstanceOf(PrimitiveType)
  })

  describe('isEqualElements and type guards', () => {
    const objT = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: { str: { refType: primStr } },
      annotationRefsOrTypes: {
        anno: primStr,
      },
      annotations: {},
    })

    const strField = new Field(objT, 'str_field', primStr)
    const lstField = new Field(objT, 'list_field', new ListType(primStr))
    const mapField = new Field(objT, 'map_field', new MapType(primStr))
    const inst = new InstanceElement('inst', objT, { str: 'test' })
    const variable = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName'), 3)

    it('should identify equal primitive types', () => {
      expect(isEqualElements(primStr, _.cloneDeep(primStr))).toBeTruthy()
    })

    it('should identify equal object types', () => {
      expect(isEqualElements(ot, _.cloneDeep(ot))).toBeTruthy()
    })

    it('should identify different object types', () => {
      const otDiff = ot.clone()
      expect(isEqualElements(ot, otDiff)).toBeTruthy()

      otDiff.isSettings = true
      expect(isEqualElements(ot, otDiff)).toBeFalsy()
    })

    it('should use the same path when cloning object types', () => {
      const obj = new ObjectType({
        elemID: otID,
        fields: {
          // eslint-disable-next-line camelcase
          num_field: { refType: primNum },
          // eslint-disable-next-line camelcase
          str_field: { refType: primStr },
        },
        annotationRefsOrTypes: {},
        annotations: {},
        path: ['a', 'b', 'c', 'd'],
      })
      const newObj = obj.clone()
      expect(newObj.path).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should identify equal fields', () => {
      expect(isEqualElements(strField, _.cloneDeep(strField))).toBeTruthy()
    })

    it('should identify equal list fields', () => {
      expect(isEqualElements(lstField, _.cloneDeep(lstField))).toBeTruthy()
    })

    it('should identify equal list types', async () => {
      expect(isEqualElements(
        await lstField.getType(),
        _.cloneDeep(await lstField.getType())
      )).toBeTruthy()
    })

    it('should identify not equal for diff list types', () => {
      expect(isEqualElements(new ListType(BuiltinTypes.STRING), new ListType(BuiltinTypes.BOOLEAN)))
        .toBeFalsy()
    })

    it('should identify not equal for diff list types when inner is list', () => {
      expect(isEqualElements(
        new ListType(BuiltinTypes.STRING),
        new ListType(new ListType(BuiltinTypes.STRING))
      )).toBeFalsy()
    })

    it('should identify equal map fields', () => {
      expect(isEqualElements(mapField, _.cloneDeep(mapField))).toBeTruthy()
    })

    it('should identify equal map types', async () => {
      expect(isEqualElements(
        await mapField.getType(),
        _.cloneDeep(await mapField.getType())
      )).toBeTruthy()
    })

    it('should identify not equal for diff map types', () => {
      expect(isEqualElements(new MapType(BuiltinTypes.STRING), new MapType(BuiltinTypes.BOOLEAN)))
        .toBeFalsy()
    })

    it('should identify not equal for diff map types when inner is map', () => {
      expect(isEqualElements(
        new MapType(BuiltinTypes.STRING),
        new MapType(new MapType(BuiltinTypes.STRING))
      )).toBeFalsy()
    })

    it('should identify not equal for map and list', () => {
      expect(isEqualElements(
        new MapType(BuiltinTypes.STRING),
        new ListType(BuiltinTypes.STRING)
      )).toBeFalsy()
    })

    it('should identify equal instance elements', () => {
      expect(isEqualElements(inst, _.cloneDeep(inst))).toBeTruthy()
    })

    it('should identify one undefined as not equal', () => {
      expect(isEqualElements(inst, undefined)).toBeFalsy()
      expect(isEqualElements(undefined, inst)).toBeFalsy()
    })

    it('should identify different elements as false', () => {
      expect(isEqualElements(inst, ot)).toBeFalsy()
    })

    it('should identify different instances with id change', () => {
      const instClone = new InstanceElement(
        'different_name',
        inst.refType,
        inst.value
      )
      expect(isEqualElements(inst, instClone)).toBeFalsy()
    })
    it('should identify different instances with value change', () => {
      const instClone = inst.clone()
      instClone.value.newVal = 1
      expect(isEqualElements(inst, instClone)).toBeFalsy()
    })

    it('should identify different instances with annotation change', () => {
      const instClone = inst.clone()
      instClone.annotations[INSTANCE_ANNOTATIONS.SERVICE_URL] = 'asd'
      expect(isEqualElements(inst, instClone)).toBeFalsy()
    })

    it('should identify equal variable elements', () => {
      expect(isEqualElements(variable, _.cloneDeep(variable))).toBeTruthy()
    })

    it('should identify different variables', () => {
      const otVariable = variable.clone()
      otVariable.value = 8
      expect(isEqualElements(variable, otVariable)).toBeFalsy()
    })

    it('should identify primitive type', () => {
      expect(isPrimitiveType(primStr)).toBeTruthy()
      expect(isPrimitiveType(inst)).toBeFalsy()
    })

    it('should identify types', () => {
      expect(isType(inst)).toBeFalsy()
      expect(isType(primStr)).toBeTruthy()
    })

    it('should identify object types', () => {
      expect(isObjectType(inst)).toBeFalsy()
      expect(isObjectType(ot)).toBeTruthy()
    })

    it('should identify list types', () => {
      expect(isListType(inst)).toBeFalsy()
      expect(isListType(mt)).toBeFalsy()
      expect(isListType(lt)).toBeTruthy()
    })

    it('should identify map types', () => {
      expect(isMapType(inst)).toBeFalsy()
      expect(isMapType(lt)).toBeFalsy()
      expect(isMapType(mt)).toBeTruthy()
    })

    it('should identify container types', () => {
      expect(isContainerType(inst)).toBeFalsy()
      expect(isContainerType(mt)).toBeTruthy()
      expect(isContainerType(lt)).toBeTruthy()
    })

    it('should identify instance elements', () => {
      expect(isInstanceElement(inst)).toBeTruthy()
      expect(isInstanceElement(primStr)).toBeFalsy()
    })

    it('should identify variable elements', () => {
      expect(isVariable(variable)).toBeTruthy()
      expect(isVariable(inst)).toBeFalsy()
    })
  })

  describe('ElemID', () => {
    const typeId = new ElemID('adapter', 'example')
    const fieldId = typeId.createNestedID('field', 'test')
    const fieldIdWithPath = fieldId.createNestedID('nested', 'annotation')
    const annotationTypeId = typeId.createNestedID('annotation', 'anno')
    const annotationTypesId = typeId.createNestedID('annotation')
    const typeInstId = typeId.createNestedID('instance', 'test')
    const valueId = typeInstId.createNestedID('nested', 'value')
    const typeAttrId = typeId.createNestedID('attr', 'anno')
    const configTypeId = new ElemID('adapter')
    const configInstId = configTypeId.createNestedID('instance', ElemID.CONFIG_NAME)
    const variableId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName')
    const listId = new ListType(new TypeReference(typeId)).elemID
    const mapId = new MapType(new TypeReference(typeId)).elemID
    const nestedListId = new ListType(new TypeReference(listId)).elemID

    describe('constructor', () => {
      it('should create a variable when no type is provided but the namespace is var', () => {
        expect(new ElemID(ElemID.VARIABLES_NAMESPACE, 'varName').idType).toEqual('var')
      })
      it('should create a type when no type is provided and the namespace is not var', () => {
        expect(new ElemID('salesforce', 'name').idType).toEqual('type')
      })
    })

    describe('getFullName', () => {
      it('should contain adapter and type name for type ID', () => {
        expect(typeId.getFullName()).toEqual('adapter.example')
      })
      it('should contain type id and field name for field ID', () => {
        expect(fieldId.getFullName()).toEqual(`${typeId.getFullName()}.field.test`)
      })
      it('should contain type id and annotation type name for annotation ID', () => {
        expect(annotationTypeId.getFullName()).toEqual(`${typeId.getFullName()}.annotation.anno`)
      })
      it('should contain type id and annotation for annotation ID', () => {
        expect(annotationTypesId.getFullName()).toEqual(`${typeId.getFullName()}.annotation`)
      })
      it('should contain type id and instance name for instance ID', () => {
        expect(typeInstId.getFullName()).toEqual(`${typeId.getFullName()}.instance.test`)
      })
      it('should contain inst id and value path for value in instance', () => {
        expect(valueId.getFullName()).toEqual(`${typeInstId.getFullName()}.nested.value`)
      })
      it('should contain only adapter for config type', () => {
        expect(configTypeId.getFullName()).toEqual(configTypeId.adapter)
      })
      it('should contain full type and the word instance for config instance', () => {
        expect(configInstId.getFullName()).toEqual(
          `${configTypeId.adapter}.${configTypeId.typeName}.instance`,
        )
      })
      it('should contain namespace and variable name for variable ID', () => {
        expect(variableId.getFullName()).toEqual('var.varName')
      })
    })

    describe('getFieldsElemIDsFullName', () => {
      it('should get full name of fields in objectType', () => {
        expect(ot.getFieldsElemIDsFullName()).toEqual([
          'test.obj.field.num_field',
          'test.obj.field.str_field',
        ])
      })
    })

    describe('isBaseLevel', () => {
      it('should return true for type ID', () => {
        expect(typeId.isBaseID()).toBeTruthy()
      })
      it('should return true for field ID', () => {
        expect(fieldId.isBaseID()).toBeTruthy()
      })
      it('should return false for annotation ID', () => {
        expect(annotationTypeId.isBaseID()).toBeFalsy()
      })
      it('should return true for instance ID', () => {
        expect(typeInstId.isBaseID()).toBeTruthy()
      })
      it('should return false for value ID', () => {
        expect(valueId.isBaseID()).toBeFalsy()
      })
      it('should return true for config type ID', () => {
        expect(configTypeId.isBaseID()).toBeTruthy()
      })
      it('should return true for config instance ID', () => {
        expect(configInstId.isBaseID()).toBeTruthy()
      })
    })

    describe('fromFullName', () => {
      it('should create elem ID from its full name', () => {
        [typeId, fieldId, annotationTypesId, annotationTypeId, typeInstId, valueId, configTypeId,
          configInstId, variableId, listId, mapId, nestedListId]
          .forEach(id => expect(ElemID.fromFullName(id.getFullName())).toEqual(id))
      })
      it('should fail on invalid id type', () => {
        expect(() => ElemID.fromFullName('adapter.type.bla.foo')).toThrow()
      })
    })

    describe('getTypeOrContainerTypeID', () => {
      const elemID = new ElemID('adapter', 'typeName')
      const newObjectType = new ObjectType({ elemID })
      it('Should return the ElemID if non-container type', () => {
        expect(ElemID.getTypeOrContainerTypeID(newObjectType.elemID).isEqual(elemID)).toBeTruthy()
      })

      it('Should return the innerType elemID for ListType elemID', () => {
        const listType = new ListType(newObjectType)
        expect(ElemID.getTypeOrContainerTypeID(listType.elemID).isEqual(elemID)).toBeTruthy()
      })

      it('Should return the innerType elemID for MapType elemID', () => {
        const mapType = new MapType(newObjectType)
        expect(ElemID.getTypeOrContainerTypeID(mapType.elemID).isEqual(elemID)).toBeTruthy()
      })

      it('Should return the deepInnerType elemID for list of map elemID', () => {
        const listOfMapType = new ListType(new MapType(newObjectType))
        expect(ElemID.getTypeOrContainerTypeID(listOfMapType.elemID).isEqual(elemID))
          .toBeTruthy()
      })

      it('Should throw an error if <> structure is illegal in the elemID', () => {
        const invalidElemID = new ElemID('', '<invalid>>')
        expect(() => ElemID.getTypeOrContainerTypeID(invalidElemID)).toThrow()
      })
    })

    describe('getContainerPrefixAndInnerType', () => {
      it('should return undefined for a non container element ID', () => {
        const id = new ElemID('salto', 'typeId')
        expect(id.getContainerPrefixAndInnerType()).toBeUndefined()
      })
      describe('with container ID', () => {
        const mapOfString = new MapType(BuiltinTypes.STRING)
        const listOfMapType = new ListType(mapOfString)
        describe('with nested list type', () => {
          it('should return container type and inner type name', () => {
            const containerInfo = listOfMapType.elemID.getContainerPrefixAndInnerType()
            expect(containerInfo).toBeDefined()
            expect(containerInfo?.prefix).toEqual('List')
            expect(containerInfo?.innerTypeName).toEqual(
              listOfMapType.refInnerType.elemID.getFullName()
            )
          })
        })
        describe('with map type', () => {
          it('should return container type and inner type name', () => {
            const containerInfo = mapOfString.elemID.getContainerPrefixAndInnerType()
            expect(containerInfo).toBeDefined()
            expect(containerInfo?.prefix).toEqual('Map')
            expect(containerInfo?.innerTypeName).toEqual(
              mapOfString.refInnerType.elemID.getFullName()
            )
          })
        })
      })
    })
    describe('getRelativePath', () => {
      it('should return the correct relative path - top level and nested', () => {
        const nested = ['a', 'b']
        const elemID = new ElemID('adapter', 'typeName', 'instance', 'test')
        const nestedID = elemID.createNestedID(...nested)
        expect(elemID.getRelativePath(nestedID)).toEqual(nested)
      })
      it('should return the correct relative path - both nested', () => {
        const nested = ['b', 'c']
        const elemID = new ElemID('adapter', 'typeName', 'instance', 'test', 'a')
        const nestedID = elemID.createNestedID(...nested)
        expect(elemID.getRelativePath(nestedID)).toEqual(nested)
      })
      it('should return the correct relative path - both nested in field', () => {
        const nested = ['b', 'c']
        const elemID = new ElemID('adapter', 'typeName', 'field', 'test', 'a')
        const nestedID = elemID.createNestedID(...nested)
        expect(elemID.getRelativePath(nestedID)).toEqual(nested)
      })
      it('should return the correct relative path - field', () => {
        const elemID = new ElemID('adapter', 'typeName')
        const nestedID = new ElemID('adapter', 'typeName', 'field', 'f1')
        expect(elemID.getRelativePath(nestedID)).toEqual(['field', 'f1'])
      })
      it('should return the correct relative path - annotation', () => {
        const elemID = new ElemID('adapter', 'typeName')
        const nestedID = new ElemID('adapter', 'typeName', 'annotation', 'f1')
        expect(elemID.getRelativePath(nestedID)).toEqual(['annotation', 'f1'])
      })
      it('should return the correct relative path - attr', () => {
        const elemID = new ElemID('adapter', 'typeName')
        const nestedID = new ElemID('adapter', 'typeName', 'attr', 'f1')
        expect(elemID.getRelativePath(nestedID)).toEqual(['attr', 'f1'])
      })
      it('should return the empty result if they are the same elemIDs', () => {
        const elemID = new ElemID('adapter', 'typeName', 'instance', 'test')
        const nestedID = new ElemID('adapter', 'typeName', 'instance', 'test')
        expect(elemID.getRelativePath(nestedID)).toEqual([])
      })
      it('should throw exception if the other elemID is not a child of the elemID', () => {
        const elemID = new ElemID('adapter', 'typeName', 'instance', 'test')
        const nestedID = new ElemID('adapter', 'typeName', 'instance', 'tes1')
        expect(() => elemID.getRelativePath(nestedID)).toThrow()
      })
    })

    describe('nestingLevel', () => {
      describe('for config, types, instances and variables', () => {
        it('should be zero', () => {
          expect(typeId.nestingLevel).toEqual(0)
          expect(typeInstId.nestingLevel).toEqual(0)
          expect(configTypeId.nestingLevel).toEqual(0)
          expect(configInstId.nestingLevel).toEqual(0)
          expect(variableId.nestingLevel).toEqual(0)
        })
      })
      describe('for nested ids', () => {
        it('should match the number of name parts', () => {
          expect(fieldId.nestingLevel).toEqual(1)
          expect(fieldId.createNestedID('a', 'b').nestingLevel).toEqual(3)
          expect(annotationTypesId.nestingLevel).toEqual(1)
          expect(annotationTypeId.nestingLevel).toEqual(2)
        })
        it('should match path length in instance values', () => {
          expect(valueId.nestingLevel).toEqual(2)
        })
      })
    })

    describe('isConfig', () => {
      it('should return true for config type ID', () => {
        expect(configTypeId.isConfig()).toBeTruthy()
      })

      it('should return true for config instance ID', () => {
        expect(configInstId.isConfig()).toBeTruthy()
      })

      it('should return false for other IDs', () => {
        expect(typeId.isConfig()).toBeFalsy()
      })
    })

    describe('isEqual', () => {
      it('should return true for equal IDs', () => {
        expect(configTypeId.isEqual(configTypeId)).toBeTruthy()
      })
      it('should return false for different IDs', () => {
        expect(typeId.isEqual(fieldId)).toBeFalsy()
      })
    })

    describe('isParentOf', () => {
      it('should return true if the checked ID is nested under the current ID', () => {
        expect(typeId.isParentOf(fieldId)).toBeTruthy()
        expect(typeId.isParentOf(fieldIdWithPath)).toBeTruthy()
        expect(typeId.isParentOf(annotationTypeId)).toBeTruthy()
        expect(typeId.isParentOf(typeAttrId)).toBeTruthy()
        expect(typeId.isParentOf(typeAttrId.createNestedID('more', 'nesting'))).toBeTruthy()
        expect(fieldId.isParentOf(fieldIdWithPath)).toBeTruthy()
        expect(typeInstId.isParentOf(valueId)).toBeTruthy()
        expect(typeInstId.isParentOf(valueId.createNestedID('super', 'duper', 'nested'))).toBeTruthy()
        expect(valueId.isParentOf(valueId.createNestedID('nested', 'value'))).toBeTruthy()
      })
      it('should return false if the checked ID is not nested under the current ID', () => {
        expect(typeId.isParentOf(typeInstId)).toBeFalsy()
        expect(typeId.isParentOf(typeId)).toBeFalsy()
        expect(typeId.isParentOf(variableId)).toBeFalsy()
        expect(fieldId.isParentOf(typeId)).toBeFalsy()
        expect(fieldId.isParentOf(valueId)).toBeFalsy()
        expect(typeInstId.isParentOf(variableId)).toBeFalsy()
        expect(typeInstId.isParentOf(fieldId)).toBeFalsy()
        expect(valueId.isParentOf(fieldId)).toBeFalsy()
      })
    })

    describe('createNestedID', () => {
      describe('from type ID', () => {
        it('should create nested ID with the correct id type', () => {
          const fieldID = typeId.createNestedID('field', 'name')
          expect(fieldID).toEqual(new ElemID('adapter', 'example', 'field', 'name'))
          expect(fieldID.idType).toEqual('field')
        })
        it('should fail if given an invalid id type', () => {
          expect(() => typeId.createNestedID('bla')).toThrow()
        })
      })
      describe('from field ID', () => {
        let nestedId: ElemID
        beforeEach(() => {
          nestedId = fieldId.createNestedID('nested')
        })
        it('should keep the original id type', () => {
          expect(nestedId.idType).toEqual(fieldId.idType)
        })
        it('should have the new name', () => {
          expect(nestedId.name).toEqual('nested')
        })
      })
      describe('from annotation ID', () => {
        let nestedId: ElemID
        beforeEach(() => {
          nestedId = annotationTypeId.createNestedID('nested')
        })
        it('should keep the original id type', () => {
          expect(nestedId.idType).toEqual(annotationTypeId.idType)
        })
        it('should have the new name', () => {
          expect(nestedId.name).toEqual('nested')
        })
      })
      describe('from variable ID', () => {
        // We don't support object variables for now
        it('should always fail', () => {
          expect(() => variableId.createNestedID('nested')).toThrow(/.*var\.varName\.nested[^.].*/)
        })
      })
    })

    describe('createParentID', () => {
      describe('from type ID', () => {
        it('should return the adapter ID', () => {
          expect(typeId.createParentID()).toEqual(new ElemID(typeId.adapter))
        })
      })
      describe('from instance ID', () => {
        it('should return the adapter ID', () => {
          expect(typeInstId.createParentID()).toEqual(new ElemID(typeInstId.adapter))
        })
      })
      describe('from config instance ID', () => {
        it('should return the adapter ID', () => {
          expect(configInstId.createParentID()).toEqual(new ElemID(typeInstId.adapter))
        })
      })
      describe('from field ID', () => {
        it('should return the type ID', () => {
          expect(fieldId.createParentID()).toEqual(new ElemID(fieldId.adapter, fieldId.typeName))
        })
      })
      describe('from annotation types ID', () => {
        it('should return the type ID', () => {
          expect(annotationTypesId.createParentID()).toEqual(typeId)
        })
      })
      describe('from annotation type ID', () => {
        it('should return the type ID', () => {
          expect(annotationTypeId.createParentID()).toEqual(annotationTypesId)
        })
      })
      describe('from variable ID', () => {
        it('should return the namespace ID', () => {
          expect(variableId.createParentID()).toEqual(new ElemID(variableId.adapter))
        })
      })
      describe('from nested ID', () => {
        it('should return one nesting level less deep', () => {
          [fieldId, typeInstId, configInstId].forEach(
            parent => expect(parent.createNestedID('test').createParentID()).toEqual(parent)
          )
        })
      })
      describe('numLevels argument', () => {
        it('should fail when passed as non positive', () => {
          expect(() => fieldId.createParentID(0)).toThrow()
          expect(() => fieldId.createParentID(-1)).toThrow()
        })
        it('should go up the correct number of levels', () => {
          [fieldId, typeInstId, configInstId].forEach(
            parent => expect(parent.createNestedID('test', 'foo').createParentID(2)).toEqual(parent)
          )
          expect(fieldId.createNestedID('asd').createParentID(2)).toEqual(typeId)
          expect(typeAttrId.createNestedID('asd').createParentID(2)).toEqual(typeId)
          expect(annotationTypeId.createParentID(2)).toEqual(typeId)
        })
      })
    })

    describe('createTopLevelParentID', () => {
      describe('from top level element', () => {
        it('should return the same ID and empty path', () => {
          [typeId, typeInstId, configTypeId, configInstId, variableId].forEach(id => {
            const { parent, path } = id.createTopLevelParentID()
            expect(parent).toEqual(id)
            expect(path).toHaveLength(0)
          })
        })
      })
      describe('from field id', () => {
        let parent: ElemID
        let path: ReadonlyArray<string>
        beforeAll(() => {
          ({ parent, path } = fieldId.createTopLevelParentID())
        })

        it('should return the type', () => {
          expect(parent).toEqual(new ElemID(fieldId.adapter, fieldId.typeName))
        })
        it('should return the field name as the path', () => {
          expect(path).toEqual([fieldId.name])
        })
      })
      describe('from annotation types id', () => {
        let parent: ElemID
        let path: ReadonlyArray<string>
        beforeAll(() => {
          ({ parent, path } = annotationTypesId.createTopLevelParentID())
        })

        it('should return the type', () => {
          expect(parent).toEqual(new ElemID(annotationTypesId.adapter, annotationTypesId.typeName))
        })
        it('should return empty path', () => {
          expect(path).toEqual([])
        })
      })
      describe('from annotation type id', () => {
        let parent: ElemID
        let path: ReadonlyArray<string>
        beforeAll(() => {
          ({ parent, path } = annotationTypeId.createTopLevelParentID())
        })

        it('should return the type', () => {
          expect(parent).toEqual(new ElemID(annotationTypeId.adapter, annotationTypeId.typeName))
        })
        it('should return the annotation name as the path', () => {
          expect(path).toEqual([annotationTypeId.name])
        })
      })
      describe('from value id', () => {
        let parent: ElemID
        let path: ReadonlyArray<string>
        beforeAll(() => {
          ({ parent, path } = valueId.createTopLevelParentID())
        })

        it('should return the instance', () => {
          expect(parent).toEqual(typeInstId)
        })
        it('should return the nesting path in the instance', () => {
          expect(path).toEqual(['nested', 'value'])
        })
      })
    })
    describe('createBaseID', () => {
      describe('from field id', () => {
        describe('without annotations', () => {
          let parent: ElemID
          let path: ReadonlyArray<string>
          beforeAll(() => {
            ({ parent, path } = fieldId.createBaseID())
          })

          it('should return the field', () => {
            expect(parent).toEqual(fieldId)
          })
          it('should return the field name as the path', () => {
            expect(path).toEqual([])
          })
        })
        describe('with nested annotations', () => {
          let parent: ElemID
          let path: ReadonlyArray<string>
          beforeAll(() => {
            ({ parent, path } = fieldIdWithPath.createBaseID())
          })

          it('should return the field', () => {
            expect(parent).toEqual(fieldId)
          })
          it('should return the field name as the path', () => {
            expect(path).toEqual(['nested', 'annotation'])
          })
        })
      })
      describe('from annotation types id', () => {
        describe('without path', () => {
          let parent: ElemID
          let path: ReadonlyArray<string>
          beforeAll(() => {
            ({ parent, path } = annotationTypesId.createBaseID())
          })

          it('should return the type', () => {
            expect(parent).toEqual(
              new ElemID(annotationTypesId.adapter, annotationTypesId.typeName)
            )
          })
          it('should return empty path', () => {
            expect(path).toEqual([])
          })
        })
      })
      describe('from annotation type id', () => {
        let parent: ElemID
        let path: ReadonlyArray<string>
        beforeAll(() => {
          ({ parent, path } = annotationTypeId.createBaseID())
        })

        it('should return the type', () => {
          expect(parent).toEqual(new ElemID(annotationTypeId.adapter, annotationTypeId.typeName))
        })
        it('should return the annotation name as the path', () => {
          expect(path).toEqual([annotationTypeId.name])
        })
      })
      describe('from instace id', () => {
        describe('without path', () => {
          let parent: ElemID
          let path: ReadonlyArray<string>
          beforeAll(() => {
            ({ parent, path } = typeInstId.createBaseID())
          })

          it('should return the instance', () => {
            expect(parent).toEqual(typeInstId)
          })
          it('should return the nesting path in the instance', () => {
            expect(path).toEqual([])
          })
        })
        describe('with path', () => {
          let parent: ElemID
          let path: ReadonlyArray<string>
          beforeAll(() => {
            ({ parent, path } = valueId.createBaseID())
          })

          it('should return the instance', () => {
            expect(parent).toEqual(typeInstId)
          })
          it('should return the nesting path in the instance', () => {
            expect(path).toEqual(['nested', 'value'])
          })
        })
      })
    })
    describe('isAttrID', () => {
      it('should identify non-instance element annotation IDs', () => {
        const objectAnno = new ElemID('salto', 'obj', 'attr', 'something')
        const nonAnno = new ElemID('salto', 'obj', 'field', 'ok')
        expect(objectAnno.isAttrID()).toBeTruthy()
        expect(nonAnno.isAttrID()).toBeFalsy()
      })
      it('should identify instance annotation IDs', () => {
        const instAnno = new ElemID(
          'salto',
          'obj',
          'instance',
          'inst',
          CORE_ANNOTATIONS.GENERATED_DEPENDENCIES
        )

        const nonAnno = new ElemID(
          'salto',
          'obj',
          'instance',
          'inst',
          'whatevsman'
        )

        expect(instAnno.isAttrID()).toBeTruthy()
        expect(nonAnno.isAttrID()).toBeFalsy()
      })
    })
    describe('isAnnotationTypeID', () => {
      it('should identify annotation type IDs', () => {
        const objectAnnoType = new ElemID('salto', 'obj', 'annotation', 'something')
        const nonAnnoType = new ElemID('salto', 'obj', 'attr', 'ok')
        expect(objectAnnoType.isAnnotationTypeID()).toBeTruthy()
        expect(nonAnnoType.isAnnotationTypeID()).toBeFalsy()
      })
    })

    describe('replaceParentId', () => {
      it('should replace the id of the parent with the new id', () => {
        expect(new ElemID('salto', 'obj', 'instance', 'inst1', 'a')
          .replaceParentId(new ElemID('salto', 'obj', 'instance', 'inst2')).getFullName())
          .toBe('salto.obj.instance.inst2.a')
      })

      it('should return the new id if the two arrays are of the same size', () => {
        expect(new ElemID('salto', 'obj', 'instance', 'inst1')
          .replaceParentId(new ElemID('salto', 'obj', 'instance', 'inst2')).getFullName())
          .toBe('salto.obj.instance.inst2')
      })

      it('should return the new id the new id is longer than the current one', () => {
        expect(new ElemID('salto', 'obj', 'instance', 'inst1')
          .replaceParentId(new ElemID('salto', 'obj', 'instance', 'inst2', 'a')).getFullName())
          .toBe('salto.obj.instance.inst2.a')
      })

      it('should work with config elements', () => {
        expect(new ElemID('salto', 'obj', 'instance', ElemID.CONFIG_NAME, 'a')
          .replaceParentId(new ElemID('salto', 'obj', 'instance', ElemID.CONFIG_NAME)).getFullName())
          .toBe('salto.obj.instance._config.a')
      })

      it('should work with config element in the current id', () => {
        expect(new ElemID('salto', 'obj', 'instance', ElemID.CONFIG_NAME, 'a')
          .replaceParentId(new ElemID('salto', 'obj', 'instance', 'inst2')).getFullName())
          .toBe('salto.obj.instance.inst2.a')
      })

      it('should work with config element in the new id', () => {
        expect(new ElemID('salto', 'obj', 'instance', 'inst1', 'a')
          .replaceParentId(new ElemID('salto', 'obj', 'instance', ElemID.CONFIG_NAME)).getFullName())
          .toBe('salto.obj.instance._config.a')
      })
    })
  })

  describe('ListType', () => {
    let lstType: ListType
    beforeEach(() => {
      lstType = lt.clone()
    })
    describe('test setInnerType', () => {
      it('should set new innerType with correct elemID', () => {
        const newInnerType = primStr.clone()
        newInnerType.annotate({ testAnnotation: 'value' })
        lstType.setRefInnerType(newInnerType)
        expect(lstType.annotations).toEqual({ testAnnotation: 'value' })
      })
      // TODO: Add tests for references
      it('should throw error if new innerType has wrong elemID', () => {
        expect(() => { lstType.setRefInnerType(ot) }).toThrow()
      })
    })
  })

  describe('MapType', () => {
    let mapType: MapType
    beforeEach(() => {
      mapType = mt.clone()
    })
    describe('test setInnerType', () => {
      it('should set new innerType with correct elemID', () => {
        const newInnerType = primStr.clone()
        newInnerType.annotate({ testAnnotation: 'value' })
        mapType.setRefInnerType(newInnerType)
        expect(mapType.annotations).toEqual({ testAnnotation: 'value' })
      })
      // TODO: Add tests for references
      it('should throw error if new innerType has wrong elemID', () => {
        expect(() => { mapType.setRefInnerType(ot) }).toThrow()
      })
    })
  })

  describe('createRefToElmWithValue', () => {
    it('Should create a reference with elemID equal to the elements elemID and value equal to the element', () => {
      const obj = new ObjectType({ elemID: new ElemID('a', 'elemID') })
      const objRef = createRefToElmWithValue(obj)
      expect(objRef.elemID).toEqual(obj.elemID)
      expect(objRef.type).toEqual(obj)
    })
  })

  describe('getType', () => {
    it('Should return placeholder type if type is not ObjectType', async () => {
      const instance = new InstanceElement('instance', BuiltinTypes.STRING as unknown as ObjectType)
      expect(await instance.getType()).toBeInstanceOf(PlaceholderObjectType)
    })
  })
})
