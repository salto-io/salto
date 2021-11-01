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
import { collections } from '@salto-io/lowerdash'
import {
  isInstanceElement,
  ContainerType,
  isContainerType,
  isMapType,
  MapType,
  isListType,
  ListType,
  TypeReference,
  isReferenceExpression,
  isElement,
  isField,
  ReadOnlyElementsSource,
  Element,
  ElemID,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { UnresolvedReference } from './expressions'

const { awu } = collections.asynciterable

// Changing element ids is a practice we'd like to discourage, which is why this
// function is not generic, but aimed at a specific need - to create a copy of an elemID
// with a modified adapter. This is used when an account has a different name than the
// service it represents. Created for the multiple accounts per service features (SALTO-1264).
export const createAdapterReplacedID = (elemID: ElemID, adapter: string): ElemID => {
  if (!elemID.adapter || elemID.adapter === ElemID.VARIABLES_NAMESPACE) {
    return elemID
  }
  return ElemID.fromFullName(`${adapter}.${elemID.getFullName().split('.').slice(1).join('.')}`)
}

const recursivelyUpdateContainerType = (type: ContainerType, accountName: string): void => {
  const innerType = type.refInnerType
  if (isContainerType(innerType.type)) {
    recursivelyUpdateContainerType(innerType.type, accountName)
    _.set(innerType, 'elemID', innerType.type.elemID)
  } else {
    _.set(innerType, 'elemID', createAdapterReplacedID(innerType.elemID, accountName))
  }
  if (isMapType(type)) {
    _.set(type, 'elemID', MapType.createElemID(innerType))
  } else if (isListType(type)) {
    _.set(type, 'elemID', ListType.createElemID(innerType))
  }
}

const updateRefTypeWithId = (refType: TypeReference, accountName: string): void => {
  if (refType.value === undefined) {
    return
  }
  refType.value = refType.value.clone()
  _.set(refType.value, 'elemID', createAdapterReplacedID(refType.value.elemID, accountName))
  if (isContainerType(refType.value)) {
    recursivelyUpdateContainerType(refType.value, accountName)
  }
  _.set(refType, 'elemID', refType.value.elemID)
}

const transformElemIDAdapter = (accountName: string): TransformFunc => async (
  { value }
) => {
  if (isReferenceExpression(value)) {
    _.set(value, 'elemID', createAdapterReplacedID(value.elemID, accountName))
    if (value.value instanceof UnresolvedReference) {
      value.value = undefined
    }
  }
  if (isElement(value) && value.elemID.adapter !== accountName) {
    _.set(value, 'elemID', createAdapterReplacedID(value.elemID, accountName))
    value.annotationRefTypes = _.mapValues(value.annotationRefTypes,
      annotation => {
        const annotationType = _.clone(annotation)
        updateRefTypeWithId(annotationType, accountName)
        return annotationType
      })
    if (isField(value)) {
      const fieldType = _.clone(value.refType)
      updateRefTypeWithId(fieldType, accountName)
      value.refType = fieldType
    }
  }
  return value
}

export const updateElementsWithAlternativeAdapter = async (elementsToUpdate: Element[],
  newAdapter: string, oldAdapter: string, source?: ReadOnlyElementsSource): Promise<void> =>
  awu(elementsToUpdate).forEach(async element => {
    if (element.path && (element.path[0] === oldAdapter)) {
      element.path = [newAdapter, ...element.path.slice(1)]
    }
    await transformElement({
      element,
      transformFunc: transformElemIDAdapter(newAdapter),
      strict: false,
      runOnFields: true,
      elementsSource: source,
    })
    _.set(element, 'elemID', createAdapterReplacedID(element.elemID, newAdapter))
    if (isInstanceElement(element)) {
      element.refType = _.clone(element.refType)
      updateRefTypeWithId(element.refType, newAdapter)
    }
    Object.values(element.annotationRefTypes).forEach(annotation => updateRefTypeWithId(
      annotation, newAdapter
    ))
  })
