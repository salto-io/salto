/*
*                      Copyright 2022 Salto Labs Ltd.
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
  GLOBAL_ADAPTER,
  isTemplateExpression,
  ReferenceExpression,
  TemplateExpression,
  isStaticFile,
  StaticFile,
  MAP_ID_PREFIX,
  LIST_ID_PREFIX,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { UnresolvedReference } from './expressions'

const { awu } = collections.asynciterable

// Changing element ids is a practice we'd like to discourage, which is why this
// function is not generic, but aimed at a specific need - to create a copy of an elemID
// with a modified adapter. This is used when an account has a different name than the
// service it represents. Created for the multiple accounts per service features (SALTO-1264).
export const createAdapterReplacedID = (elemID: ElemID, adapter: string): ElemID => {
  if (elemID.adapter === GLOBAL_ADAPTER || elemID.adapter === ElemID.VARIABLES_NAMESPACE) {
    return elemID
  }
  return ElemID.fromFullNameParts([adapter, ...elemID.getFullNameParts().slice(1)])
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

const updateRefTypeWithId = (
  refType: TypeReference,
  newAccountName: string,
  oldAccountName: string
): void => {
  if (refType.type === undefined) {
    // check if it is a container type
    const internalElemId = ElemID.getTypeOrContainerTypeID(refType.elemID)
    if (!internalElemId.isEqual(refType.elemID) && internalElemId.adapter === oldAccountName) {
      const fullName = refType.elemID.getFullName()
      const newInternalElemId = createAdapterReplacedID(internalElemId, newAccountName)
      if (fullName.startsWith(MAP_ID_PREFIX)) {
        _.set(refType, 'elemID', MapType.createElemID(new TypeReference(newInternalElemId)))
      }
      if (fullName.startsWith(LIST_ID_PREFIX)) {
        _.set(refType, 'elemID', ListType.createElemID(new TypeReference(newInternalElemId)))
      }
    } else {
      _.set(refType, 'elemID', createAdapterReplacedID(refType.elemID, newAccountName))
    }
    return
  }
  if (isContainerType(refType.type)) {
    refType.type = refType.type.clone()
    recursivelyUpdateContainerType(refType.type, newAccountName)
  } else {
    const newElemID = createAdapterReplacedID(refType.type.elemID, newAccountName)
    if (!newElemID.isEqual(refType.type.elemID)) {
      refType.type = refType.type.clone()
      _.set(refType.type, 'elemID', createAdapterReplacedID(refType.type.elemID, newAccountName))
    }
  }
  _.set(refType, 'elemID', refType.type.elemID)
}

const updateReferenceExpression = (value: ReferenceExpression, accountName: string): void => {
  _.set(value, 'elemID', createAdapterReplacedID(value.elemID, accountName))
  // This will happen because we used resolve on a list of elements, and some of the types
  // will not resolve by the time we reach an element that references them. Since we don't
  // care about resolved values, we can just remove this.
  if (value.value instanceof UnresolvedReference) {
    value.value = undefined
  }
}

const updateTemplateExpression = (value: TemplateExpression, accountName: string): void => {
  value.parts.forEach(part => {
    if (isReferenceExpression(part)) {
      updateReferenceExpression(part, accountName)
    }
  })
}

const updateStaticFile = (
  value: StaticFile,
  newAccountName: string,
  oldAccountName: string,
): void => {
  // Note: the replace function only replace the first occurrence (which will be the folder name)
  _.set(value, 'filepath', value.filepath.replace(`${oldAccountName}/`, `${newAccountName}/`))
}

const updateElement = (value: Element, newAccountName: string, oldAccountName: string): void => {
  _.set(value, 'elemID', createAdapterReplacedID(value.elemID, newAccountName))
  value.annotationRefTypes = _.mapValues(value.annotationRefTypes,
    annotation => {
      const annotationType = _.clone(annotation)
      updateRefTypeWithId(annotationType, newAccountName, oldAccountName)
      return annotationType
    })
  if (isField(value)) {
    const fieldType = _.clone(value.refType)
    updateRefTypeWithId(fieldType, newAccountName, oldAccountName)
    value.refType = fieldType
  }
}

const transformElemIDAdapter = (
  newAccountName: string,
  oldAccountName: string
): TransformFunc => async (
  { value }
) => {
  if (isReferenceExpression(value)) {
    updateReferenceExpression(value, newAccountName)
  }
  if (isStaticFile(value)) {
    updateStaticFile(value, newAccountName, oldAccountName)
  }
  if (isTemplateExpression(value)) {
    updateTemplateExpression(value, newAccountName)
  }
  if (isElement(value) && value.elemID.adapter !== newAccountName) {
    updateElement(value, newAccountName, oldAccountName)
  }
  return value
}

export const updateElementsWithAlternativeAccount = async (elementsToUpdate: Element[],
  newAccount: string, oldAccount: string, source?: ReadOnlyElementsSource): Promise<void> =>
  awu(elementsToUpdate).forEach(async element => {
    if (element.path !== undefined && (element.path[0] === oldAccount)) {
      element.path = [newAccount, ...element.path.slice(1)]
    }
    if (element.elemID.adapter === oldAccount) {
      await transformElement({
        element,
        transformFunc: transformElemIDAdapter(newAccount, oldAccount),
        strict: false,
        runOnFields: true,
        elementsSource: source,
      })
      _.set(element, 'elemID', createAdapterReplacedID(element.elemID, newAccount))
      if (isInstanceElement(element)) {
        updateRefTypeWithId(element.refType, newAccount, oldAccount)
      }
      Object.values(element.annotationRefTypes).forEach(annotation => updateRefTypeWithId(
        annotation, newAccount, oldAccount
      ))
    }
  })
