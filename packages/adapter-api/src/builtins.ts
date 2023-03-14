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
import { ElemID, INSTANCE_ANNOTATIONS, GLOBAL_ADAPTER } from './element_id'
import { Element, TypeMap, ObjectType, PrimitiveType, PrimitiveTypes, ListType, BuiltinTypesRefByFullName } from './elements'
import { TypeReference } from './values'
import { CORE_ANNOTATIONS } from './core_annotations'

export { CORE_ANNOTATIONS }

const StandardBuiltinTypes = {
  STRING: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'string'),
    primitive: PrimitiveTypes.STRING,
  }),
  NUMBER: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'number'),
    primitive: PrimitiveTypes.NUMBER,
  }),
  BOOLEAN: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'boolean'),
    primitive: PrimitiveTypes.BOOLEAN,
  }),
  SERVICE_ID: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'serviceid'),
    primitive: PrimitiveTypes.STRING,
    annotations: { [CORE_ANNOTATIONS.SERVICE_ID]: true },
  }),
  SERVICE_ID_NUMBER: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'serviceid_number'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: { [CORE_ANNOTATIONS.SERVICE_ID]: true },
  }),
  JSON: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'json'),
    primitive: PrimitiveTypes.STRING,
  }),
  UNKNOWN: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'unknown'),
    primitive: PrimitiveTypes.UNKNOWN,
  }),
}

const restrictionType = new ObjectType({
  elemID: new ElemID(GLOBAL_ADAPTER, 'restriction'),
  fields: {
    // eslint-disable-next-line camelcase
    enforce_value: {
      refType: new TypeReference(
        StandardBuiltinTypes.BOOLEAN.elemID,
        StandardBuiltinTypes.BOOLEAN,
      ),
    },
    values: {
      refType: new TypeReference(
        StandardBuiltinTypes.STRING.elemID,
        StandardBuiltinTypes.STRING,
      ),
    },
    min: {
      refType: new TypeReference(
        StandardBuiltinTypes.NUMBER.elemID,
        StandardBuiltinTypes.NUMBER,
      ),
    },
    max: {
      refType: new TypeReference(
        StandardBuiltinTypes.NUMBER.elemID,
        StandardBuiltinTypes.NUMBER,
      ),
    },
    regex: {
      refType: new TypeReference(
        StandardBuiltinTypes.STRING.elemID,
        StandardBuiltinTypes.STRING,
      ),
    },
    max_length: {
      refType: new TypeReference(
        StandardBuiltinTypes.NUMBER.elemID,
        StandardBuiltinTypes.NUMBER,
      ),
    },
    max_list_length: {
      refType: new TypeReference(
        StandardBuiltinTypes.NUMBER.elemID,
        StandardBuiltinTypes.NUMBER
      ),
    },
  },
})

const dependencyOccurrenceType = new ObjectType({
  elemID: new ElemID(GLOBAL_ADAPTER, 'dependencyOccurrence'),
  fields: {
    direction: { refType: StandardBuiltinTypes.STRING },
    location: { refType: StandardBuiltinTypes.UNKNOWN },
  },
})
const dependencyType = new ObjectType({
  elemID: new ElemID(GLOBAL_ADAPTER, 'dependency'),
  fields: {
    reference: {
      refType: StandardBuiltinTypes.UNKNOWN,
      annotations: { [CORE_ANNOTATIONS.REQUIRED]: true },
    },
    occurrences: { refType: new ListType(dependencyOccurrenceType) },
  },
})

export type RestrictionAnnotationType = Partial<{
  // eslint-disable-next-line camelcase
  enforce_value: boolean
  values: ReadonlyArray<unknown>
  min: number
  max: number
  regex: string
  // eslint-disable-next-line camelcase
  max_length: number
  // eslint-disable-next-line camelcase
  max_list_length: number
}>

const StandardCoreAnnotationTypes: TypeMap = {
  [CORE_ANNOTATIONS.DEFAULT]: StandardBuiltinTypes.UNKNOWN,
  [CORE_ANNOTATIONS.REQUIRED]: StandardBuiltinTypes.BOOLEAN,
  [CORE_ANNOTATIONS.RESTRICTION]: restrictionType,
  [CORE_ANNOTATIONS.HIDDEN]: StandardBuiltinTypes.BOOLEAN,
  [CORE_ANNOTATIONS.HIDDEN_VALUE]: StandardBuiltinTypes.BOOLEAN,
}

export const BuiltinTypes = {
  ...StandardBuiltinTypes,
  HIDDEN_STRING: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'hidden_string'),
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: StandardCoreAnnotationTypes,
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
    },
  }),
  HIDDEN_BOOLEAN: new PrimitiveType({
    elemID: new ElemID(GLOBAL_ADAPTER, 'hidden_boolean'),
    primitive: PrimitiveTypes.BOOLEAN,
    annotationRefsOrTypes: StandardCoreAnnotationTypes,
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
    },
  }),
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export const isServiceId = (type: any): boolean =>
  type.annotations?.[CORE_ANNOTATIONS.SERVICE_ID] ?? false

export const BuiltinTypesByFullName: Record<string, PrimitiveType> = (_.keyBy(
  Object.values(BuiltinTypes),
  builtinType => builtinType.elemID.getFullName(),
))

// This is a pretty big hack: the map is created in elements, because it is used in
// the Element constructor. But it can only be initialized here, after types have been defined.
// Specifically, PrimitiveType needs to be defined before this is initialized, and PrimitiveType
// inherits Element. To solve this, we would need to unite three modules: builtins, values,
// and element. Even then, we would need to initialize an empty record, and only add values into it
// after all necessary classes have been defined.
Object.entries(BuiltinTypesByFullName).forEach(([name, type]) => {
  BuiltinTypesRefByFullName[name] = new TypeReference(type.elemID, type)
})

export const InstanceAnnotationTypes: TypeMap = {
  [INSTANCE_ANNOTATIONS.DEPENDS_ON]: new ListType(dependencyType),
  [INSTANCE_ANNOTATIONS.PARENT]: new ListType(StandardBuiltinTypes.STRING),
  [INSTANCE_ANNOTATIONS.GENERATED_DEPENDENCIES]: new ListType(dependencyType),
  [INSTANCE_ANNOTATIONS.HIDDEN]: StandardBuiltinTypes.BOOLEAN,
  [INSTANCE_ANNOTATIONS.SERVICE_URL]: BuiltinTypes.HIDDEN_STRING,
  [INSTANCE_ANNOTATIONS.CREATED_BY]: BuiltinTypes.HIDDEN_STRING,
  [INSTANCE_ANNOTATIONS.CREATED_AT]: BuiltinTypes.HIDDEN_STRING,
  [INSTANCE_ANNOTATIONS.CHANGED_BY]: BuiltinTypes.HIDDEN_STRING,
  [INSTANCE_ANNOTATIONS.CHANGED_AT]: BuiltinTypes.HIDDEN_STRING,
  [INSTANCE_ANNOTATIONS.ALIAS]: StandardBuiltinTypes.STRING,
}

export const CoreAnnotationTypes: TypeMap = {
  ...InstanceAnnotationTypes,
  ...StandardCoreAnnotationTypes,
  [CORE_ANNOTATIONS.CREATABLE]: BuiltinTypes.HIDDEN_BOOLEAN,
  [CORE_ANNOTATIONS.UPDATABLE]: BuiltinTypes.HIDDEN_BOOLEAN,
  [CORE_ANNOTATIONS.DELETABLE]: BuiltinTypes.HIDDEN_BOOLEAN,
}

export const getRestriction = (
  { annotations }: { annotations: Element['annotations'] },
): RestrictionAnnotationType => (
  annotations[CORE_ANNOTATIONS.RESTRICTION] ?? {}
)

// Hack to get typescript to enforce the type
export const createRestriction = (def: RestrictionAnnotationType): RestrictionAnnotationType => def
