/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  PrimitiveType,
  PrimitiveTypes,
  InstanceElement,
  Field,
  BuiltinTypes,
  ListType,
  getChangeData,
  DetailedChangeWithBaseChange,
  toChange,
} from '@salto-io/adapter-api'
import { toDetailedChangeFromBaseChange } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { AdditionDiff, ModificationDiff, RemovalDiff } from '@salto-io/dag/dist'
import { createMockNaclFileSource } from '../../common/nacl_file_source'
import { projectChange } from '../../../src/workspace/nacl_files/multi_env/projections'

describe('projections', () => {
  const nestedElemID = new ElemID('salto', 'nested')
  const nestedObj = new ObjectType({
    elemID: nestedElemID,
    fields: {
      simple1: { refType: BuiltinTypes.STRING },
      simple2: { refType: BuiltinTypes.STRING },
    },
  })
  const annotationsObject = {
    simple1: BuiltinTypes.STRING,
    list1: BuiltinTypes.STRING,
    nested1: nestedObj,
    simple2: BuiltinTypes.STRING,
    list2: BuiltinTypes.STRING,
    nested2: nestedObj,
  }
  const primitiveType = new PrimitiveType({
    elemID: new ElemID('salto', 'string'),
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: annotationsObject,
    annotations: {
      simple1: 'PRIMITIVE_1',
      list1: ['PRIMITIVE_LIST_1'],
      nested1: {
        simple1: 'PRIMITIVE_NESTED_1',
        simple2: 'PRIMITIVE_NESTED_2',
      },
      simple2: 'PRIMITIVE_1',
      list2: ['PRIMITIVE_LIST_1'],
      nested2: {
        simple1: 'PRIMITIVE_NESTED_1',
        simple2: 'PRIMITIVE_NESTED_2',
      },
    },
  })
  const objectTypeElemID = new ElemID('salto', 'object')
  const objectType = new ObjectType({
    elemID: objectTypeElemID,
    annotationRefsOrTypes: annotationsObject,
    annotations: {
      simple1: 'OBJECT_1',
      list1: ['OBJECT_LIST_1'],
      nested1: {
        simple1: 'OBJECT_NESTED_1',
        simple2: 'OBJECT_NESTED_2',
      },
      simple2: 'OBJECT_1',
      list2: ['OBJECT_LIST_1'],
      nested2: {
        simple1: 'OBJECT_NESTED_1',
        simple2: 'OBJECT_NESTED_2',
      },
    },
    fields: _.mapValues(annotationsObject, (type, name) => ({
      refType: name.includes('list') ? new ListType(type) : type,
    })),
  })
  const fieldParent = new ObjectType({
    elemID: new ElemID('salto', 'parent'),
    fields: {
      field: {
        refType: objectType,
        annotations: {
          simple1: 'FIELD_1',
          list1: ['FIELD_LIST_1'],
          nested1: {
            simple1: 'FIELD_NESTED_1',
            simple2: 'FIELD_NESTED_2',
          },
          simple2: 'FIELD_1',
          list2: ['FIELD_LIST_1'],
          nested2: {
            simple1: 'FIELD_NESTED_1',
            simple2: 'FIELD_NESTED_2',
          },
        },
      },
    },
  })
  const { field } = fieldParent.fields
  const instance = new InstanceElement('instance', objectType, {
    simple1: 'INSTANCE_1',
    list1: ['INSTANCE_LIST_1'],
    nested1: {
      simple1: 'INSTANCE_NESTED_1',
      simple2: 'INSTANCE_NESTED_2',
    },
    simple2: 'INSTANCE_1',
    list2: ['INSTANCE_LIST_1'],
    nested2: {
      simple1: 'INSTANCE_NESTED_1',
      simple2: 'INSTANCE_NESTED_2',
    },
  })

  const partialPrimitiveType = new PrimitiveType({
    elemID: new ElemID('salto', 'string'),
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: annotationsObject,
    annotations: {
      simple1: 'PRIMITIVE_1',
      list1: ['PRIMITIVE_LIST_1'],
      nested1: {
        simple1: 'PRIMITIVE_NESTED_1',
      },
    },
  })
  const partialObjectType = new ObjectType({
    elemID: objectTypeElemID,
    annotationRefsOrTypes: annotationsObject,
    annotations: {
      simple1: 'OBJECT_1',
      list1: ['OBJECT_LIST_1'],
      nested1: {
        simple1: 'OBJECT_NESTED_1',
      },
    },
    fields: _.mapValues(annotationsObject, (type, name) => ({
      refType: name.includes('list') ? new ListType(type) : type,
    })),
  })
  const partialFieldObject = new ObjectType({
    elemID: new ElemID('salto', 'parent'),
    fields: {
      field: {
        refType: objectType,
        annotations: {
          simple1: 'FIELD_1',
          list1: ['FIELD_LIST_1'],
          nested1: {
            simple1: 'FIELD_NESTED_1',
          },
        },
      },
    },
  })
  const partialField = partialFieldObject.fields.field
  const partialInstance = new InstanceElement('instance', objectType, {
    simple1: 'INSTANCE_1',
    list1: ['INSTANCE_LIST_1'],
    nested1: {
      simple1: 'INSTANCE_NESTED_1',
    },
  })

  const partialElements = [partialPrimitiveType, partialObjectType, partialInstance, partialFieldObject]
  const source = createMockNaclFileSource(partialElements)

  describe('project instances', () => {
    const newInstance = new InstanceElement('newInstance', objectType, {
      simple1: 'INSTANCE_1',
      list1: ['INSTANCE_LIST_1'],
      nested1: {
        simple1: 'INSTANCE_NESTED_1',
      },
    })

    const newPartialInstance = new InstanceElement(
      'instance',
      objectType,
      _.omit(instance.value, _.keys(partialInstance.value)),
    )

    const modifiedInstance = instance.clone()
    modifiedInstance.value = _.cloneDeepWith(instance.value, v => (_.isString(v) ? 'MODIFIED' : undefined))

    it('should project an add change for a missing instances', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ after: newInstance }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('add')
      const { data } = projected[0] as unknown as AdditionDiff<InstanceElement>
      expect(data.after).toBeInstanceOf(InstanceElement)
      expect(data.after).toEqual(newInstance)
    })

    it('should project an add change for a non existing fragment for instances', async () => {
      const change: DetailedChangeWithBaseChange = {
        action: 'add',
        data: { after: newPartialInstance.value.nested2 },
        baseChange: toChange({ before: newPartialInstance, after: newPartialInstance }),
        id: newPartialInstance.elemID.createNestedID('nested2'),
      }
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('add')
      const changeData = getChangeData(projected[0])
      expect(changeData).toEqual(newPartialInstance.value.nested2)
    })
    it('should not project an add change for an existing fragment for instances', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ after: instance }))
      await expect(projectChange(change, source)).rejects.toThrow()
    })
    it('should project a modify change for an existing fragment for instances', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ before: instance, after: modifiedInstance }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('modify')
      const { data } = projected[0] as unknown as ModificationDiff<InstanceElement>
      expect(data.before.value).toEqual(partialInstance.value)
      expect(data.after.value).toEqual({
        simple1: 'MODIFIED',
        list1: ['MODIFIED'],
        nested1: {
          simple1: 'MODIFIED',
        },
      })
    })
    it('should project a remove change for an existing fragment for instances', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ before: instance }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('remove')
      const { data } = projected[0] as unknown as RemovalDiff<InstanceElement>
      expect(data.before.value).toEqual(partialInstance.value)
    })
  })

  describe('project object types', () => {
    const newObjectType = new ObjectType({
      elemID: new ElemID('salto', 'new_object'),
      annotationRefsOrTypes: _.clone(objectType.annotationRefTypes),
      annotations: _.clone(objectType.annotations),
    })

    const modifiedObject = new ObjectType({
      elemID: objectType.elemID,
      fields: objectType.fields,
      annotations: _.cloneDeepWith(objectType.annotations, v => (_.isString(v) ? 'MODIFIED' : undefined)),
      annotationRefsOrTypes: objectType.annotationRefTypes,
    })

    it('should project an add change for a missing object type', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ after: newObjectType }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('add')
      const { data } = projected[0] as unknown as AdditionDiff<ObjectType>
      expect(data.after).toBeInstanceOf(ObjectType)
      expect(data.after).toEqual(newObjectType)
    })

    it('should project an add change for a non existing fragment for object types', async () => {
      const change: DetailedChangeWithBaseChange = {
        action: 'add',
        data: { after: objectType.annotations.nested2 },
        baseChange: toChange({ before: objectType, after: objectType }),
        id: objectType.elemID.createNestedID('attr', 'nested2'),
      }
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('add')
      const changeData = getChangeData(projected[0])
      expect(changeData).toEqual(objectType.annotations.nested2)
    })
    it('should not project an add change for an existing fragment for object types', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ after: objectType }))
      await expect(projectChange(change, source)).rejects.toThrow()
    })
    it('should project a modify change for an existing fragment for object types', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ before: objectType, after: modifiedObject }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('modify')
      const { data } = projected[0] as unknown as ModificationDiff<ObjectType>
      expect(data.before).toEqual(partialObjectType)
      expect(data.after.annotations).toEqual({
        simple1: 'MODIFIED',
        list1: ['MODIFIED'],
        nested1: {
          simple1: 'MODIFIED',
        },
      })
    })
    it('should project a remove change for an existing fragment for object types', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ before: objectType }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('remove')
      const { data } = projected[0] as unknown as RemovalDiff<ObjectType>
      expect(data.before).toEqual(partialObjectType)
    })
  })
  describe('project primitive types', () => {
    const newPrimitiveType = new PrimitiveType({
      elemID: new ElemID('salto', 'new_object'),
      annotationRefsOrTypes: _.clone(primitiveType.annotationRefTypes),
      annotations: _.clone(primitiveType.annotations),
      primitive: primitiveType.primitive,
    })

    const modifiedPrimitive = new PrimitiveType({
      elemID: primitiveType.elemID,
      annotations: _.cloneDeepWith(primitiveType.annotations, v => (_.isString(v) ? 'MODIFIED' : undefined)),
      annotationRefsOrTypes: primitiveType.annotationRefTypes,
      primitive: primitiveType.primitive,
    })

    it('should project an add change for a missing primitive type', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ after: newPrimitiveType }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('add')
      const { data } = projected[0] as unknown as AdditionDiff<PrimitiveType>
      expect(data.after).toBeInstanceOf(PrimitiveType)
      expect(data.after).toEqual(newPrimitiveType)
    })

    it('should project an add change for a non existing fragment for primitive types', async () => {
      const change: DetailedChangeWithBaseChange = {
        action: 'add',
        data: { after: primitiveType.annotations.nested2 },
        baseChange: toChange({ before: primitiveType, after: primitiveType }),
        id: primitiveType.elemID.createNestedID('attr', 'nested2'),
      }
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('add')
      const changeData = getChangeData(projected[0])
      expect(changeData).toEqual(primitiveType.annotations.nested2)
    })
    it('should not project an add change for an existing fragment for primitive types', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ after: primitiveType }))
      await expect(projectChange(change, source)).rejects.toThrow()
    })
    it('should project a modify change for an existing fragment for primitive types', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ before: primitiveType, after: modifiedPrimitive }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('modify')
      const { data } = projected[0] as unknown as ModificationDiff<PrimitiveType>
      expect(data.before).toEqual(partialPrimitiveType)
      expect(data.after.annotations).toEqual({
        simple1: 'MODIFIED',
        list1: ['MODIFIED'],
        nested1: {
          simple1: 'MODIFIED',
        },
      })
    })
    it('should project a remove change for an existing fragment for primitive types', async () => {
      const change = toDetailedChangeFromBaseChange(toChange({ before: primitiveType }))
      const projected = await projectChange(change, source)
      expect(projected).toHaveLength(1)
      expect(projected[0].action).toBe('remove')
      const { data } = projected[0] as unknown as RemovalDiff<PrimitiveType>
      expect(data.before).toEqual(partialPrimitiveType)
    })
  })
  describe('project fields', () => {
    describe('project fields', () => {
      let newField: Field
      let newPartialField: Field
      let modifiedField: Field
      const parentObj = new ObjectType({ elemID: new ElemID('salto', 'new_parent') })

      beforeAll(async () => {
        newField = new Field(parentObj, 'new_field', await field.getType(), _.clone(field.annotations))

        newPartialField = new Field(
          field.parent,
          'newName',
          await field.getType(),
          _.omit(field.annotations, _.keys(partialField.annotations)),
        )

        modifiedField = new Field(
          field.parent,
          field.name,
          await field.getType(),
          _.cloneDeepWith(field.annotations, v => (_.isString(v) ? 'MODIFIED' : undefined)),
        )
      })

      it('should project an add change for a missing field', async () => {
        const change = toDetailedChangeFromBaseChange(toChange({ after: newField }))
        const projected = await projectChange(change, source)
        expect(projected).toHaveLength(1)
        expect(projected[0].action).toBe('add')
        const { data } = projected[0] as unknown as AdditionDiff<Field>
        expect(data.after).toBeInstanceOf(Field)
        expect(data.after).toEqual(newField)
      })

      it('should project an add change for a non existing fragment for fields', async () => {
        const change = toDetailedChangeFromBaseChange(toChange({ after: newPartialField }))
        const projected = await projectChange(change, source)
        expect(projected).toHaveLength(1)
        expect(projected[0].action).toBe('add')
        const { data } = projected[0] as unknown as AdditionDiff<Field>
        expect(data.after).toBeInstanceOf(Field)
        expect(data.after).toEqual(newPartialField)
      })
      it('should not project an add change for an existing fragment for fields', async () => {
        const change = toDetailedChangeFromBaseChange(toChange({ after: field }))
        await expect(projectChange(change, source)).rejects.toThrow()
      })
      it('should project a modify change for an existing fragment for fields', async () => {
        const change = toDetailedChangeFromBaseChange(toChange({ before: field, after: modifiedField }))
        const projected = await projectChange(change, source)
        expect(projected).toHaveLength(1)
        expect(projected[0].action).toBe('modify')
        const { data } = projected[0] as unknown as ModificationDiff<Field>
        expect(data.before).toEqual(partialField)
        expect(data.after.annotations).toEqual({
          simple1: 'MODIFIED',
          list1: ['MODIFIED'],
          nested1: {
            simple1: 'MODIFIED',
          },
        })
      })
      it('should project a remove change for an existing fragment for fields', async () => {
        const change = toDetailedChangeFromBaseChange(toChange({ before: field }))
        const projected = await projectChange(change, source)
        expect(projected).toHaveLength(1)
        expect(projected[0].action).toBe('remove')
        const { data } = projected[0] as unknown as RemovalDiff<Field>
        expect(data.before).toEqual(partialField)
      })
    })
  })
})
