/* eslint @typescript-eslint/camelcase: 0 */
import { InstanceElement, ObjectType, ElemID, BuiltinTypes, ReferenceExpression, Field, PrimitiveType, PrimitiveTypes, CORE_ANNOTATIONS } from 'adapter-api'
import _ from 'lodash'
import { INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, API_NAME, CUSTOM_OBJECT } from '../../src/constants'
import mockClient from '../client'
import { Filter } from '../../src/filter'
import serviceIdReferenceFilter from '../../src/filters/service_id_references'

describe('service_id_references filter', () => {
  const refType = new ObjectType(
    {
      elemID: new ElemID('salesforce', 'ref'),
      annotationTypes: {
        [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
        [API_NAME]: 'Ref',
      },
      fields: {},
    }
  )
  const metaType = new ObjectType(
    {
      elemID: new ElemID('salesforce', 'meta'),
      annotationTypes: {
        [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
      annotations: {
        [METADATA_TYPE]: 'Meta',
      },
      fields: {},
    }
  )
  const instanceRef = new InstanceElement(
    'inst_ref',
    refType,
    {
      [INSTANCE_FULL_NAME_FIELD]: 'InstRef',
    }
  )
  const refAnno = {
    [CORE_ANNOTATIONS.VALUES]: [
      'InstRef',
      'Meta',
      'Ref',
    ],
  }
  const annoStringType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'anno_str'),
    annotations: refAnno,
    primitive: PrimitiveTypes.STRING,
  })
  const nestedId = new ElemID('salesforce', 'nested')
  const nestedType = new ObjectType({
    elemID: nestedId,
    fields: {
      nested_inst: new Field(nestedId, 'nested_inst', BuiltinTypes.STRING, refAnno),
    },
    annotationTypes: {
      flat_inst: annoStringType,
    },
  })
  const ObjTypeId = new ElemID('salesforce', 'obj')
  const objType = new ObjectType({
    elemID: ObjTypeId,
    annotationTypes: {
      [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
      [API_NAME]: BuiltinTypes.SERVICE_ID,
      reg: BuiltinTypes.STRING,
      hering: BuiltinTypes.STRING,
      flat_inst: annoStringType,
      flat_type: annoStringType,
      flat_meta: annoStringType,
      nested: nestedType,
      arr: annoStringType,
      nestedArr: nestedType,
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'Obj',
      [CORE_ANNOTATIONS.VALUES]: [
        'InstRef',
      ],
      reg: 'orig',
      hering: 'InstRef',
      flat_inst: 'InstRef',
      flat_type: 'Ref',
      flat_meta: 'Meta',
      nested: {
        nested_inst: 'InstRef',
      },
      arr: ['InstRef', 'notRef'],
      nestedArr: [{
        nested_inst: 'InstRef',
      }],
    },
    fields: {
      reg: new Field(ObjTypeId, 'reg', BuiltinTypes.STRING),
      hering: new Field(ObjTypeId, 'hering', BuiltinTypes.STRING),
      flat_inst: new Field(ObjTypeId, 'flat_inst', BuiltinTypes.STRING, refAnno),
      flat_type: new Field(ObjTypeId, 'flat_type', BuiltinTypes.STRING, refAnno),
      flat_meta: new Field(ObjTypeId, 'flat_meta', BuiltinTypes.STRING, refAnno),
      nested: new Field(ObjTypeId, 'nested', nestedType, {
        flat_inst: 'InstRef',
      }),
      nested_plain: new Field(ObjTypeId, 'nested', nestedType),
      arr: new Field(ObjTypeId, 'arr', BuiltinTypes.STRING, refAnno, true),
    },
  })

  const inst = new InstanceElement('inst', objType, {
    reg: 'orig',
    hering: 'InstRef',
    flat_inst: 'InstRef',
    flat_type: 'Ref',
    flat_meta: 'Meta',
    nested: {
      nested_inst: 'InstRef',
    },
    arr: ['InstRef'],
  })

  const elements = [
    objType,
    inst,
    refType,
    metaType,
    instanceRef,
    nestedType,
    annoStringType,
  ]
  const filter = serviceIdReferenceFilter(mockClient()) as Required<Pick<Filter, 'onFetch'>>
  const toBeReplaced = _.cloneDeep(elements)
  filter.onFetch(toBeReplaced)
  const replacedType = toBeReplaced[0] as ObjectType
  const replaced = toBeReplaced[1] as InstanceElement

  describe('values replacements', () => {
    it('should not replace regular values in values', () => {
      expect(replaced.value.reg).toEqual(inst.value.reg)
      expect(replaced.value.reg).not.toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing an instance in values', () => {
      expect(replaced.value.flat_inst).not.toEqual(inst.value.flat_inst)
      expect(replaced.value.flat_inst).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing a type in values', () => {
      expect(replaced.value.flat_type).not.toEqual(inst.value.flat_type)
      expect(replaced.value.flat_type).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing a metadata type in values', () => {
      expect(replaced.value.flat_meta).not.toEqual(inst.value.flat_meta)
      expect(replaced.value.flat_meta).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace nested value in values', () => {
      expect(replaced.value.nested.nested_inst).not.toEqual(inst.value.nested.nested_inst)
      expect(replaced.value.nested.nested_inst).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace value in array in values', () => {
      expect(replaced.value.arr[0]).not.toEqual(inst.value.arr[0])
      expect(replaced.value.arr[0]).toBeInstanceOf(ReferenceExpression)
    })
    it('should not replace value whos type is not designated as replace type in values', () => {
      expect(replaced.value.hering).toEqual(inst.value.hering)
      expect(replaced.value.hering).not.toBeInstanceOf(ReferenceExpression)
    })
  })
  describe('annotation replacements', () => {
    it('should not replace regular values in annotations', () => {
      expect(replacedType.annotations.reg).toEqual(objType.annotations.reg)
      expect(replacedType.annotations.reg).not.toBeInstanceOf(ReferenceExpression)
    })
    it('should not replace default annotations', () => {
      expect(replacedType.annotations[CORE_ANNOTATIONS.VALUES])
        .toEqual(objType.annotations[CORE_ANNOTATIONS.VALUES])
      expect(replacedType.annotations[CORE_ANNOTATIONS.VALUES][0])
        .not.toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing an instance in annotations', () => {
      expect(replacedType.annotations.flat_inst).not.toEqual(objType.annotations.flat_inst)
      expect(replacedType.annotations.flat_inst).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing a type in annotations', () => {
      expect(replacedType.annotations.flat_type).not.toEqual(objType.annotations.flat_type)
      expect(replacedType.annotations.flat_type).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing a metadata type in annotations', () => {
      expect(replacedType.annotations.flat_meta).not.toEqual(objType.annotations.flat_meta)
      expect(replacedType.annotations.flat_meta).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace nested value in annotations', () => {
      expect(replacedType.annotations.nested.nested_inst)
        .not.toEqual(objType.annotations.nested.nested_inst)
      expect(replacedType.annotations.nested.nested_inst).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace value in array in annotations', () => {
      expect(replacedType.annotations.arr[0]).not.toEqual(objType.annotations.arr[0])
      expect(replacedType.annotations.arr[0]).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace annotations in fields', () => {
      expect(replacedType.fields.nested.annotations.flat_inst)
        .not.toEqual(objType.fields.nested.annotations.flat_inst)
      expect(replacedType.fields.nested.annotations.flat_inst)
        .toBeInstanceOf(ReferenceExpression)
    })
    it('should not replace value whos type is not designated as replace type in annotations', () => {
      expect(replacedType.annotations.hering).toEqual(objType.annotations.hering)
      expect(replacedType.annotations.hering).not.toBeInstanceOf(ReferenceExpression)
    })
  })
})
