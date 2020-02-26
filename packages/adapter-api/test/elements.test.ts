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
import {
  Field,
  InstanceElement,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  ListType,
} from '../src/elements'
import { ElemID } from '../src/element_id'
import {
  isEqualElements,
  isInstanceElement,
  isObjectType,
  isPrimitiveType,
  isType,
  isListType,
} from '../src/utils'

describe('Test elements.ts', () => {
  /**   ElemIDs   * */
  const primID = new ElemID('test', 'prim')

  /**   primitives   * */
  const primStr = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.STRING,
    annotationTypes: {},
    annotations: {},
  })

  const primNum = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.NUMBER,
    annotationTypes: {},
    annotations: {},
  })

  /**   object types   * */
  const otID = new ElemID('test', 'obj')
  const ot = new ObjectType({
    elemID: otID,
    fields: {
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      num_field: new Field(otID, 'num_field', primNum),
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      str_field: new Field(otID, 'str_field', primStr),
    },
    annotationTypes: {},
    annotations: {},
  })

  const lt = new ListType(primStr)

  it('should create a basic primitive type with all params passed to the constructor', () => {
    expect(primStr.elemID).toEqual(primID)
    expect(primStr.primitive).toBe(PrimitiveTypes.STRING)

    expect(primNum.elemID).toEqual(primID)
    expect(primNum.primitive).toBe(PrimitiveTypes.NUMBER)
  })

  it('should create a basic object type with all params passed to the constructor', () => {
    expect(ot.elemID).toEqual(otID)
    expect(ot.fields.num_field.type).toBeInstanceOf(PrimitiveType)
    expect(ot.fields.str_field.type).toBeInstanceOf(PrimitiveType)
  })

  it('Should test getValuesThatNotInPrevOrDifferent func', () => {
    const prevInstance = new InstanceElement('diff', new ObjectType({
      elemID: new ElemID('test', 'diff'),
      fields: {
      },
      annotationTypes: {},
      annotations: {},
    }),
    {
      userPermissions: [
        {
          enabled: false,
          name: 'ConvertLeads',
        },
      ],
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
      ],
      description: 'old unit test instance profile',
    },)

    const newInstance = new InstanceElement('diff', new ObjectType({
      elemID: new ElemID('test', 'diff'),
      fields: {
      },
      annotationTypes: {},
      annotations: {},
    }),
    {
      userPermissions: [
        {
          enabled: false,
          name: 'ConvertLeads',
        },
      ],
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
        {
          editable: false,
          field: 'Account.AccountNumber',
          readable: false,
        },
      ],
      applicationVisibilities: [
        {
          application: 'standard__ServiceConsole',
          default: false,
          visible: true,
        },
      ],
      description: 'new unit test instance profile',
    },)

    expect(newInstance.getValuesThatNotInPrevOrDifferent(prevInstance.value)).toMatchObject({
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
        {
          editable: false,
          field: 'Account.AccountNumber',
          readable: false,
        },
      ],
      applicationVisibilities: [
        {
          application: 'standard__ServiceConsole',
          default: false,
          visible: true,
        },
      ],
      description: 'new unit test instance profile',
    },)
  })

  describe('isEqualElements and type guards', () => {
    const objT = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        str: new Field(new ElemID('test', 'obj'), 'str_field', primStr),
      },
      annotationTypes: {
        anno: primStr,
      },
      annotations: {},
    })

    const strField = new Field(new ElemID('test', 'obj'), 'str_field', primStr)
    const inst = new InstanceElement('inst', objT, { str: 'test' })

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

    it('should identify equal fields', () => {
      expect(isEqualElements(strField, _.cloneDeep(strField))).toBeTruthy()
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
      expect(isListType(lt)).toBeTruthy()
    })

    it('should identify instance elements', () => {
      expect(isInstanceElement(inst)).toBeTruthy()
      expect(isInstanceElement(primStr)).toBeFalsy()
    })
  })

  describe('ElemID', () => {
    const typeId = new ElemID('adapter', 'example')
    const fieldId = typeId.createNestedID('field', 'test')
    const annotationTypeId = typeId.createNestedID('annotation', 'anno')
    const annotationTypesId = typeId.createNestedID('annotation')
    const typeInstId = typeId.createNestedID('instance', 'test')
    const valueId = typeInstId.createNestedID('nested', 'value')
    const configTypeId = new ElemID('adapter')
    const configInstId = configTypeId.createNestedID('instance', ElemID.CONFIG_NAME)

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
    })

    describe('fromFullName', () => {
      it('should create elem ID from its full name', () => {
        [typeId, fieldId, annotationTypesId, annotationTypeId, typeInstId, valueId, configTypeId,
          configInstId]
          .forEach(id => expect(ElemID.fromFullName(id.getFullName())).toEqual(id))
      })
      it('should fail on invalid id type', () => {
        expect(() => ElemID.fromFullName('adapter.type.bla.foo')).toThrow()
      })
    })

    describe('nestingLevel', () => {
      describe('for config, types and instances', () => {
        it('should be zero', () => {
          expect(typeId.nestingLevel).toEqual(0)
          expect(typeInstId.nestingLevel).toEqual(0)
          expect(configTypeId.nestingLevel).toEqual(0)
          expect(configInstId.nestingLevel).toEqual(0)
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
      describe('from nested ID', () => {
        it('should return one nesting level less deep', () => {
          [fieldId, typeInstId, configInstId].forEach(
            parent => expect(parent.createNestedID('test').createParentID()).toEqual(parent)
          )
        })
      })
    })

    describe('createTopLevelParentID', () => {
      describe('from top level element', () => {
        it('should return the same ID and empty path', () => {
          [typeId, typeInstId, configTypeId, configInstId].forEach(id => {
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
  })
})
