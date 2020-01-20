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
      nestedInst: new Field(nestedId, 'nestedInst', BuiltinTypes.STRING, refAnno),
    },
    annotationTypes: {
      flatInst: annoStringType,
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
      flatInst: annoStringType,
      flatType: annoStringType,
      flatMeta: annoStringType,
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
      flatInst: 'InstRef',
      flatType: 'Ref',
      flatMeta: 'Meta',
      nested: {
        nestedInst: 'InstRef',
      },
      arr: ['InstRef', 'notRef'],
      nestedArr: [{
        nestedInst: 'InstRef',
      }],
    },
    fields: {
      reg: new Field(ObjTypeId, 'reg', BuiltinTypes.STRING),
      hering: new Field(ObjTypeId, 'hering', BuiltinTypes.STRING),
      flatInst: new Field(ObjTypeId, 'flatInst', BuiltinTypes.STRING, refAnno),
      flatType: new Field(ObjTypeId, 'flatType', BuiltinTypes.STRING, refAnno),
      flatMeta: new Field(ObjTypeId, 'flatMeta', BuiltinTypes.STRING, refAnno),
      nested: new Field(ObjTypeId, 'nested', nestedType, {
        flatInst: 'InstRef',
      }),
      nested_plain: new Field(ObjTypeId, 'nested', nestedType),
      arr: new Field(ObjTypeId, 'arr', BuiltinTypes.STRING, refAnno, true),
    },
  })

  const inst = new InstanceElement('inst', objType, {
    reg: 'orig',
    hering: 'InstRef',
    flatInst: 'InstRef',
    flatType: 'Ref',
    flatMeta: 'Meta',
    nested: {
      nestedInst: 'InstRef',
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
      expect(replaced.value.flatInst).not.toEqual(inst.value.flatInst)
      expect(replaced.value.flatInst).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing a type in values', () => {
      expect(replaced.value.flatType).not.toEqual(inst.value.flatType)
      expect(replaced.value.flatType).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing a metadata type in values', () => {
      expect(replaced.value.flatMeta).not.toEqual(inst.value.flatMeta)
      expect(replaced.value.flatMeta).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace nested value in values', () => {
      expect(replaced.value.nested.nestedInst).not.toEqual(inst.value.nested.nestedInst)
      expect(replaced.value.nested.nestedInst).toBeInstanceOf(ReferenceExpression)
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
      expect(replacedType.annotations.flatInst).not.toEqual(objType.annotations.flatInst)
      expect(replacedType.annotations.flatInst).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing a type in annotations', () => {
      expect(replacedType.annotations.flatType).not.toEqual(objType.annotations.flatType)
      expect(replacedType.annotations.flatType).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace values referencing a metadata type in annotations', () => {
      expect(replacedType.annotations.flatMeta).not.toEqual(objType.annotations.flatMeta)
      expect(replacedType.annotations.flatMeta).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace nested value in annotations', () => {
      expect(replacedType.annotations.nested.nestedInst)
        .not.toEqual(objType.annotations.nested.nestedInst)
      expect(replacedType.annotations.nested.nestedInst).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace value in array in annotations', () => {
      expect(replacedType.annotations.arr[0]).not.toEqual(objType.annotations.arr[0])
      expect(replacedType.annotations.arr[0]).toBeInstanceOf(ReferenceExpression)
    })
    it('should replace annotations in fields', () => {
      expect(replacedType.fields.nested.annotations.flatInst)
        .not.toEqual(objType.fields.nested.annotations.flatInst)
      expect(replacedType.fields.nested.annotations.flatInst)
        .toBeInstanceOf(ReferenceExpression)
    })
    it('should not replace value whos type is not designated as replace type in annotations', () => {
      expect(replacedType.annotations.hering).toEqual(objType.annotations.hering)
      expect(replacedType.annotations.hering).not.toBeInstanceOf(ReferenceExpression)
    })
  })
})
