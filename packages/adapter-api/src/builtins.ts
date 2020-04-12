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
import { ElemID } from './element_id'
import { TypeMap, ObjectType, Field, PrimitiveType, PrimitiveTypes } from './elements'

export const BUILTIN_ADAPTER = ''

export const BuiltinTypes: Record<string, PrimitiveType> = {
  STRING: new PrimitiveType({
    elemID: new ElemID(BUILTIN_ADAPTER, 'string'),
    primitive: PrimitiveTypes.STRING,
  }),
  NUMBER: new PrimitiveType({
    elemID: new ElemID(BUILTIN_ADAPTER, 'number'),
    primitive: PrimitiveTypes.NUMBER,
  }),
  BOOLEAN: new PrimitiveType({
    elemID: new ElemID(BUILTIN_ADAPTER, 'boolean'),
    primitive: PrimitiveTypes.BOOLEAN,
  }),
  SERVICE_ID: new PrimitiveType({
    elemID: new ElemID(BUILTIN_ADAPTER, 'serviceid'),
    primitive: PrimitiveTypes.STRING,
  }),
  JSON: new PrimitiveType({
    elemID: new ElemID(BUILTIN_ADAPTER, 'json'),
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
  PARENT: '_parent',
}

export const InstanceAnnotationTypes: TypeMap = {
  [INSTANCE_ANNOTATIONS.DEPENDS_ON]: BuiltinTypes.STRING,
  [INSTANCE_ANNOTATIONS.PARENT]: BuiltinTypes.STRING,
}

export const RESTRICTION_ANNOTATIONS = {
  ENFORCE_VALUE: 'enforce_value',
  MIN: 'min',
  MAX: 'max',
}

const restrictionElemID = new ElemID('', 'restriction')
export const CoreAnnotationTypes: TypeMap = {
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
