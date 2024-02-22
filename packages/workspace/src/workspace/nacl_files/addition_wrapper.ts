/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { AdditionDiff } from '@salto-io/dag'
import {
  Element,
  ElemID,
  ObjectType,
  InstanceElement,
  Value,
  isObjectType,
  isInstanceElement,
  PrimitiveType,
  isField,
  FieldDefinition,
  Field,
} from '@salto-io/adapter-api'
import _ from 'lodash'

export type DetailedAddition = AdditionDiff<Value> & {
  id: ElemID
  path: string[]
}

type NestedValue = {
  id: ElemID
  value: Value
}

const addToField = (
  nestedValue: NestedValue,
  commonField: Field,
  currentField?: FieldDefinition,
): Record<string, FieldDefinition> => {
  const { name } = commonField
  const { path } = nestedValue.id.createTopLevelParentID()
  const annotations = { ...currentField?.annotations }
  if (!_.isEmpty(path)) {
    _.set(annotations, path.slice(1), nestedValue.value)
  }
  return { [name]: { refType: commonField.refType, annotations } }
}

const createObjectTypeFromNestedAdditions = (
  nestedValues: NestedValue[],
  commonObjectType: ObjectType,
  path?: string[],
): ObjectType =>
  new ObjectType(
    nestedValues.reduce(
      (prev, nestedValue) => {
        switch (nestedValue.id.idType) {
          case 'field': {
            const { value } = nestedValue
            if (isField(value)) {
              return {
                ...prev,
                fields: {
                  ...prev.fields,
                  [value.name]: value,
                },
              }
            }
            const fieldName = nestedValue.id.createTopLevelParentID().path[0]
            const field = commonObjectType.fields[fieldName]
            if (field === undefined) {
              throw new Error(
                `field ${fieldName} was not found in common object type ${commonObjectType.elemID.getFullName()}`,
              )
            }
            return {
              ...prev,
              fields: {
                ...prev.fields,
                ...addToField(nestedValue, field, prev.fields[fieldName]),
              },
            }
          }
          case 'attr': {
            const attrPath = nestedValue.id.createTopLevelParentID().path
            return { ...prev, annotations: _.set({ ...prev.annotations }, attrPath, nestedValue.value) }
          }
          case 'annotation': {
            const annoName = nestedValue.id.createTopLevelParentID().path[0]
            return {
              ...prev,
              annotationRefsOrTypes: {
                ...prev.annotationRefsOrTypes,
                [annoName]: nestedValue.value,
              },
            }
          }
          default:
            return prev
        }
      },
      {
        elemID: commonObjectType.elemID,
        fields: {} as Record<string, FieldDefinition>,
        annotationRefsOrTypes: {},
        annotations: {},
        path,
        isSettings: commonObjectType.isSettings,
      },
    ),
  )

const createInstanceElementFromNestedAdditions = (
  nestedValues: NestedValue[],
  commonInstance: InstanceElement,
  path?: string[],
): InstanceElement => {
  // IDs inside instances can be of values or annotations, we need to keep them separate
  const value = {}
  const annotations = {}
  nestedValues.forEach(nestedValue => {
    const inValuePath = nestedValue.id.createTopLevelParentID().path
    _.set(nestedValue.id.isAttrID() ? annotations : value, inValuePath, nestedValue.value)
  })

  return new InstanceElement(commonInstance.elemID.name, commonInstance.refType, value, path, annotations)
}

const createPrimitiveTypeFromNestedAdditions = (
  nestedValues: NestedValue[],
  commonPrimitiveType: PrimitiveType,
  path?: string[],
): PrimitiveType =>
  new PrimitiveType(
    nestedValues.reduce(
      (prev, nestedValue) => {
        switch (nestedValue.id.idType) {
          case 'attr':
            return {
              ...prev,
              annotations: {
                ...prev.annotations,
                [nestedValue.id.name]: nestedValue.value,
              },
            }
          case 'annotation':
            return {
              ...prev,
              annotationRefTypes: {
                ...prev.annotationRefTypes,
                [nestedValue.id.name]: nestedValue.value,
              },
            }
          default:
            return prev
        }
      },
      {
        elemID: commonPrimitiveType.elemID,
        primitive: commonPrimitiveType.primitive,
        annotationRefTypes: {},
        annotations: {},
        path,
      },
    ),
  )

export const wrapNestedValues = (nestedValues: NestedValue[], commonElement: Element, path?: string[]): Element => {
  if (isObjectType(commonElement)) {
    return createObjectTypeFromNestedAdditions(nestedValues, commonElement, path)
  }
  if (isInstanceElement(commonElement)) {
    return createInstanceElementFromNestedAdditions(nestedValues, commonElement, path)
  }
  return createPrimitiveTypeFromNestedAdditions(nestedValues, commonElement as PrimitiveType, path)
}

export const wrapAdditions = (nestedAdditions: DetailedAddition[], commonElement: Element): DetailedAddition => {
  const refAddition = nestedAdditions[0]
  const refPath = nestedAdditions[0].path
  const wrapperElement = wrapNestedValues(
    nestedAdditions.map(addition => ({ ...addition, value: addition.data.after })),
    commonElement,
    refPath,
  )
  return {
    action: 'add',
    id: wrapperElement.elemID,
    path: refAddition.path,
    data: {
      after: wrapperElement as Element,
    },
  } as DetailedAddition
}
