/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import {
  createServiceIDs,
  serviceIDKeyCreator,
  createElemIDFunc,
  getElemPath,
  getNameMapping,
} from '../../../src/fetch/element/id_utils'

describe('id utils', () => {
  const typeID = new ElemID('myAdapter', 'myType')
  describe('createServiceIDs', () => {
    it('should calculate the service id for a given object and definition', () => {
      expect(
        createServiceIDs({
          entry: { a: 'A', b: 'B', c: 'C' },
          serviceIDFields: ['a', 'b'],
          typeID,
        }),
      ).toEqual({
        a: 'A',
        b: 'B',
        object_service_id: 'object_name,myAdapter.myType',
      })
    })
    it('should not crash on non-primitive service id values', () => {
      const entry = { a: { x: ['A', 'B'], b: 'B' } }
      expect(
        createServiceIDs({
          entry,
          serviceIDFields: ['a', 'b'],
          typeID,
        }),
      ).toEqual({
        ...entry,
        object_service_id: 'object_name,myAdapter.myType',
      })
    })
    it('should not crash on missing fields', () => {
      expect(
        createServiceIDs({
          entry: { a: 'A' },
          serviceIDFields: ['a', 'b'],
          typeID,
        }),
      ).toEqual({
        a: 'A',
        object_service_id: 'object_name,myAdapter.myType',
      })
    })
  })

  describe('serviceIDKeyCreator', () => {
    it('should create a stable serialization', () => {
      expect(serviceIDKeyCreator({ serviceIDFields: ['a', 'b'], typeID })({ a: 'A', c: 'C', b: 'B' })).toEqual(
        '{"a":"A","b":"B","object_service_id":"object_name,myAdapter.myType"}',
      )
      expect(serviceIDKeyCreator({ serviceIDFields: ['a', 'b'], typeID })({ b: 'B', a: 'A', c: 'C' })).toEqual(
        '{"a":"A","b":"B","object_service_id":"object_name,myAdapter.myType"}',
      )
      expect(serviceIDKeyCreator({ serviceIDFields: ['b', 'a'], typeID })({ b: 'B', a: 'A', c: 'C' })).toEqual(
        '{"a":"A","b":"B","object_service_id":"object_name,myAdapter.myType"}',
      )
    })
  })

  describe('createElemIDFunc', () => {
    it('should calculate a nacl-cased elem name for a given object and definition', () => {
      expect(
        createElemIDFunc({
          elemIDDef: {
            parts: [{ fieldName: 'a' }],
          },
          typeID,
          customNameMappingFunctions: {},
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('A')
      const func2 = createElemIDFunc({
        elemIDDef: {
          parts: [
            { fieldName: 'a' },
            // isReference is not relevant here
            { fieldName: 'c', condition: val => val.d !== undefined, isReference: true },
          ],
          delimiter: '-',
        },
        typeID,
        customNameMappingFunctions: {},
      })
      expect(func2({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' })).toEqual('A')
      expect(func2({ entry: { a: 'A', c: 'C', d: 123 }, defaultName: 'unnamed' })).toEqual('A_C@b')
      expect(func2({ entry: { a: 'A ', c: 'C', d: 123 }, defaultName: 'unnamed' })).toEqual('A__C@sb')
    })
    it('should call getElemIdFunc when service id fields are defined', () => {
      expect(
        createElemIDFunc({
          elemIDDef: {
            parts: [{ fieldName: 'a' }],
          },
          typeID,
          getElemIdFunc: () => new ElemID('a', 'b', 'instance', 'NAME'),
          serviceIDDef: ['a'],
          customNameMappingFunctions: {},
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('NAME')
    })
    it('should fallback to default name if constructed name is empty', () => {
      expect(
        createElemIDFunc({
          elemIDDef: {},
          typeID,
          customNameMappingFunctions: {},
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('unnamed')
      expect(
        createElemIDFunc({
          elemIDDef: { parts: [{ fieldName: 'nonexistent' }] },
          typeID,
          customNameMappingFunctions: {},
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual('unnamed')
    })
    it('should avoid double nacl-case when extending parent or isReference is true', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }, { fieldName: 'refField', isReference: true }],
          extendsParent: true,
        },
        typeID,
        customNameMappingFunctions: {},
      })
      const parent = new InstanceElement('parent_name@s', new ObjectType({ elemID: typeID }))
      const refInst = new InstanceElement('refInst_name@s', new ObjectType({ elemID: typeID }))
      expect(
        func({
          entry: { a: 'A', b: 'B', refField: new ReferenceExpression(refInst.elemID, refInst) },
          defaultName: 'unnamed',
          parent,
        }),
      ).toEqual('parent_name__A_refInst_name@suuus')
      expect(
        func({
          entry: { a: 'A A', b: 'B', refField: new ReferenceExpression(refInst.elemID, refInst) },
          defaultName: 'unnamed',
          parent,
        }),
      ).toEqual('parent_name__A_A_refInst_name@suusus')
    })
    it('should not avoid double nacl-case when use useOldFormat is true', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }, { fieldName: 'refField', isReference: true }],
          extendsParent: true,
          useOldFormat: true,
        },
        typeID,
        customNameMappingFunctions: {},
      })
      const parent = new InstanceElement('parent_name@s', new ObjectType({ elemID: typeID }))
      const refInst = new InstanceElement('refInst_name@s', new ObjectType({ elemID: typeID }))
      expect(
        func({
          entry: { a: 'A', b: 'B', refField: new ReferenceExpression(refInst.elemID, refInst) },
          defaultName: 'unnamed',
          parent,
        }),
      ).toEqual('parent_name_s__A_refInst_name_s@umuuuum')
      expect(
        func({
          entry: { a: 'A A', b: 'B', refField: new ReferenceExpression(refInst.elemID, refInst) },
          defaultName: 'unnamed',
          parent,
        }),
      ).toEqual('parent_name_s__A_A_refInst_name_s@umuusuum')
    })
    it('should avoid extra delimiter when extending parent and no parts', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          extendsParent: true,
        },
        typeID,
        customNameMappingFunctions: {},
      })
      const parent = new InstanceElement('parent:b', new ObjectType({ elemID: typeID }))
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed', parent })).toEqual('parent_b@f')
    })
    it('should set name to _config for singleton', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }],
        },
        singleton: true,
        typeID,
        customNameMappingFunctions: {},
      })
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' })).toEqual(ElemID.CONFIG_NAME)
    })
    it('should use custom function when provided', () => {
      const func = createElemIDFunc({
        elemIDDef: {
          parts: [{ fieldName: 'a' }, { custom: () => () => 'CUSTOM', fieldName: 'ignore' }],
        },
        typeID,
        customNameMappingFunctions: {},
      })
      expect(func({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' })).toEqual('A_CUSTOM')
    })
  })

  describe('getElemPath', () => {
    it('should calculate a nacl-cased elem name for a given object and definition', () => {
      expect(
        getElemPath({
          def: {
            pathParts: [
              {
                parts: [{ fieldName: 'a', mapping: 'customTest' }],
              },
            ],
          },
          typeID,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
            customNameMappingFunctions: {},
          }),
          customNameMappingFunctions: {
            customTest: () => 'thisIsACuteCustomName',
          },
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'myType', 'thisIsACuteCustomName'])
    })
    it('should calculate correct path when extendParent is true', () => {
      const parent = new InstanceElement('parent_name@s', new ObjectType({ elemID: typeID }))
      expect(
        getElemPath({
          def: {
            pathParts: [
              {
                parts: [{ fieldName: 'a', mapping: 'customTest' }],
                extendsParent: true,
              },
            ],
          },
          typeID,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
            customNameMappingFunctions: {},
          }),
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed', parent }),
      ).toEqual(['myAdapter', 'Records', 'myType', 'parent_name__A'])
    })
    it('should set path to settings folder if singleton', () => {
      expect(
        getElemPath({
          def: {
            pathParts: [{ parts: [{ fieldName: 'a' }] }],
          },
          typeID,
          singleton: true,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
            customNameMappingFunctions: {},
          }),
          customNameMappingFunctions: {},
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'Settings', 'myType'])
    })
    it('it should create self folder if createSelfFolder is true', () => {
      expect(
        getElemPath({
          def: {
            pathParts: [{ parts: [{ fieldName: 'a' }] }],
          },
          typeID,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
          }),
          createSelfFolder: true,
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'myType', 'A', 'A'])
    })
    it('it should nest under path if nested path provided and ignore the current instance type name', () => {
      expect(
        getElemPath({
          def: {
            pathParts: [{ parts: [{ fieldName: 'a' }] }],
          },
          typeID,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
          }),
          nestUnderPath: ['ParentType', 'FieldName'],
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'ParentType', 'FieldName', 'A'])
    })
    it('it should work with both nestUnderPath and createSelfFolder', () => {
      expect(
        getElemPath({
          def: {
            pathParts: [{ parts: [{ fieldName: 'a' }] }],
          },
          typeID,
          elemIDCreator: createElemIDFunc({
            elemIDDef: {
              parts: [{ fieldName: 'a' }],
            },
            typeID,
          }),
          nestUnderPath: ['ParentType', 'FieldName'],
          createSelfFolder: true,
        })({ entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }),
      ).toEqual(['myAdapter', 'Records', 'ParentType', 'FieldName', 'A', 'A'])
    })
    describe('with baseDir provided', () => {
      const args = { entry: { a: 'A', b: 'B', c: 'C' }, defaultName: 'unnamed' }
      it('should nest instance path under baseDir', () => {
        expect(
          getElemPath({
            def: {
              pathParts: [{ parts: [{ fieldName: 'a' }] }],
              baseDir: ['Base', 'Dir'],
            },
            typeID,
            elemIDCreator: createElemIDFunc({
              elemIDDef: {
                parts: [{ fieldName: 'a' }],
              },
              typeID,
            }),
          })(args),
        ).toEqual(['myAdapter', 'Records', 'Base', 'Dir', 'myType', 'A'])
      })
      it('should nest instance path under baseDir for singletons', () => {
        expect(
          getElemPath({
            def: {
              baseDir: ['Base', 'Dir'],
            },
            typeID,
            elemIDCreator: createElemIDFunc({
              elemIDDef: {
                parts: [{ fieldName: 'a' }],
              },
              typeID,
            }),
            singleton: true,
          })(args),
        ).toEqual(['myAdapter', 'Records', 'Base', 'Dir', 'Settings', 'myType'])
      })
      it('should ignore baseDir if provided with nestUnderPath, as types with nestUnderPath should already include the baseDir', () => {
        expect(
          getElemPath({
            def: {
              pathParts: [{ parts: [{ fieldName: 'a' }] }],
              baseDir: ['Base', 'Dir'],
            },
            typeID,
            elemIDCreator: createElemIDFunc({
              elemIDDef: {
                parts: [{ fieldName: 'a' }],
              },
              typeID,
            }),
            nestUnderPath: ['Base', 'Dir', 'ParentType', 'ParentName'],
          })(args),
        ).toEqual(['myAdapter', 'Records', 'Base', 'Dir', 'ParentType', 'ParentName', 'A'])
      })
    })
  })

  describe('getNameMapping', () => {
    describe('when mapping is not defined', () => {
      it('should return the name as is', () => {
        expect(
          getNameMapping({
            name: 'name',
            nameMapping: undefined,
            customNameMappingFunctions: {},
          }),
        ).toEqual('name')
      })
    })

    describe('when mapping is defined', () => {
      describe('when mapping is lowercase', () => {
        it('should return the name in lowercase', () => {
          expect(
            getNameMapping({
              name: 'NAME',
              nameMapping: 'lowercase',
              customNameMappingFunctions: {},
            }),
          ).toEqual('name')
        })
      })

      describe('when mapping is uppercase', () => {
        it('should return the name in uppercase', () => {
          expect(
            getNameMapping({
              name: 'name',
              nameMapping: 'uppercase',
              customNameMappingFunctions: {},
            }),
          ).toEqual('NAME')
        })
      })

      describe('when mapping is a custom function', () => {
        it('should return the name after applying the custom function', () => {
          expect(
            getNameMapping({
              name: 'name',
              nameMapping: 'test',
              customNameMappingFunctions: {
                test: () => 'test',
              },
            }),
          ).toEqual('test')
        })
      })
    })
  })
})
