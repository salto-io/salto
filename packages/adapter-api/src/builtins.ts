/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, INSTANCE_ANNOTATIONS } from './element_id'
import { Element, TypeMap, ObjectType, PrimitiveType, PrimitiveTypes, ListType } from './elements'
import { ReferenceExpression } from './values'
import { CORE_ANNOTATIONS } from './core_annotations'

export { CORE_ANNOTATIONS }

export const GLOBAL_ADAPTER = ''

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
      refType: new ReferenceExpression(
        StandardBuiltinTypes.BOOLEAN.elemID,
        StandardBuiltinTypes.BOOLEAN,
      ),
    },
    values: {
      refType: new ReferenceExpression(
        StandardBuiltinTypes.STRING.elemID,
        StandardBuiltinTypes.STRING,
      ),
    },
    min: {
      refType: new ReferenceExpression(
        StandardBuiltinTypes.NUMBER.elemID,
        StandardBuiltinTypes.NUMBER,
      ),
    },
    max: {
      refType: new ReferenceExpression(
        StandardBuiltinTypes.NUMBER.elemID,
        StandardBuiltinTypes.NUMBER,
      ),
    },
    regex: {
      refType: new ReferenceExpression(
        StandardBuiltinTypes.STRING.elemID,
        StandardBuiltinTypes.STRING,
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

type RestrictionAnnotationType = Partial<{
  // eslint-disable-next-line camelcase
  enforce_value: boolean
  values: ReadonlyArray<unknown>
  min: number
  max: number
  regex: string
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
}

export const BuiltinTypesByFullName: Record<string, PrimitiveType> = (_.keyBy(
  Object.values(BuiltinTypes),
  builtinType => builtinType.elemID.getFullName(),
))

export const BuiltinTypesRefByFullName = _.mapValues(
  BuiltinTypesByFullName,
  type => new ReferenceExpression(type.elemID, type)
)

export const InstanceAnnotationTypes: TypeMap = {
  [INSTANCE_ANNOTATIONS.DEPENDS_ON]: new ListType(dependencyType),
  [INSTANCE_ANNOTATIONS.PARENT]: new ListType(StandardBuiltinTypes.STRING),
  [INSTANCE_ANNOTATIONS.GENERATED_DEPENDENCIES]: new ListType(dependencyType),
  [INSTANCE_ANNOTATIONS.HIDDEN]: StandardBuiltinTypes.BOOLEAN,
  [INSTANCE_ANNOTATIONS.SERVICE_URL]: BuiltinTypes.HIDDEN_STRING,
}

export const CoreAnnotationTypes: TypeMap = {
  ...InstanceAnnotationTypes,
  ...StandardCoreAnnotationTypes,
}

export const getRestriction = (
  { annotations }: { annotations: Element['annotations'] },
): RestrictionAnnotationType => (
  annotations[CORE_ANNOTATIONS.RESTRICTION] ?? {}
)

// Hack to get typescript to enforce the type
export const createRestriction = (def: RestrictionAnnotationType): RestrictionAnnotationType => def
