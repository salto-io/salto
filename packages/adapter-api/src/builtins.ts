import { ElemID } from './element_id'
import { TypeMap, ObjectType, Field, PrimitiveType, PrimitiveTypes } from './elements'

export const BuiltinTypes: Record<string, PrimitiveType> = {
  STRING: new PrimitiveType({
    elemID: new ElemID('', 'string'),
    primitive: PrimitiveTypes.STRING,
  }),
  NUMBER: new PrimitiveType({
    elemID: new ElemID('', 'number'),
    primitive: PrimitiveTypes.NUMBER,
  }),
  BOOLEAN: new PrimitiveType({
    elemID: new ElemID('', 'boolean'),
    primitive: PrimitiveTypes.BOOLEAN,
  }),
  SERVICE_ID: new PrimitiveType({
    elemID: new ElemID('', 'serviceid'),
    primitive: PrimitiveTypes.STRING,
  }),
}

export const CORE_ANNOTATIONS = {
  DEFAULT: '_default',
  REQUIRED: '_required',
  VALUES: '_values',
  RESTRICTION: '_restriction',
}

export const INSTANCE_ANNOTATIONS = {
  DEPENDS_ON: '_depends_on',
}

export const RESTRICTION_ANNOTATIONS = {
  ENFORCE_VALUE: 'enforce_value',
  MIN: 'min',
  MAX: 'max',
}

const restrictionElemID = new ElemID('', 'restriction')
export const BuiltinAnnotationTypes: TypeMap = {
  [CORE_ANNOTATIONS.DEFAULT]: BuiltinTypes.STRING,
  [CORE_ANNOTATIONS.REQUIRED]: BuiltinTypes.BOOLEAN,
  [CORE_ANNOTATIONS.VALUES]: BuiltinTypes.STRING,
  [CORE_ANNOTATIONS.RESTRICTION]: new ObjectType({ elemID: restrictionElemID,
    fields: {
      [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: new Field(
        restrictionElemID, RESTRICTION_ANNOTATIONS.ENFORCE_VALUE, BuiltinTypes.BOOLEAN
      ),
      [RESTRICTION_ANNOTATIONS.MIN]: new Field(
        restrictionElemID, RESTRICTION_ANNOTATIONS.MIN, BuiltinTypes.NUMBER
      ),
      [RESTRICTION_ANNOTATIONS.MAX]: new Field(
        restrictionElemID, RESTRICTION_ANNOTATIONS.MAX, BuiltinTypes.NUMBER
      ),
    } }),
}
