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
import {
  Change,
  ChangeError,
  ChangeValidator, getChangeData,
  InstanceElement,
  isAdditionChange, isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import {
  ARTICLE_ORDER_TYPE_NAME, ARTICLE_TYPE_NAME,
  ARTICLES_FIELD,
  CATEGORIES_FIELD,
  CATEGORY_ORDER_TYPE_NAME,
  CATEGORY_TYPE_NAME, SECTION_ORDER_TYPE_NAME, SECTION_TYPE_NAME,
  SECTIONS_FIELD,
} from '../../constants'


const createNoOrderInstanceWarning = (instance: InstanceElement, orderTypeName: string): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: `${instance.elemID.typeName} instance not specified under the corresponding ${orderTypeName}`,
  detailedMessage: `The ${instance.elemID.typeName} instance '${instance.elemID.name}' is not listed in ${orderTypeName}, and will be added to be first by default. If order is important, please include it under the ${orderTypeName}`,
})

const validateOrderElementAdded = (
  changes: readonly Change[],
  orderField: string,
  orderTypeName: string,
  childTypeName: string,
): ChangeError[] => {
  const relevantChildInstances = changes.filter(isInstanceChange).filter(isAdditionChange)
    .map(getChangeData).filter(child => child.elemID.typeName === childTypeName)

  const relevantOrderInstances = changes.filter(isInstanceChange).filter(isAdditionOrModificationChange)
    .map(getChangeData).filter(order => order.elemID.typeName === orderTypeName)

  const childrenInOrderInstances = new Set(relevantOrderInstances
    .flatMap(order => order.value[orderField] ?? [])
    .map(child => child.elemID?.getFullName()))

  return relevantChildInstances.filter(child => !childrenInOrderInstances.has(child.elemID.getFullName()))
    .map(child => createNoOrderInstanceWarning(child, orderTypeName))
}

/**
 * Warns the user if he is adding a child instance and not its order instance
 * */
export const childInOrderValidator: ChangeValidator = async changes => {
  const errors: ChangeError[] = []
  return errors.concat(
    validateOrderElementAdded(changes, ARTICLES_FIELD, ARTICLE_ORDER_TYPE_NAME, ARTICLE_TYPE_NAME),
    validateOrderElementAdded(changes, SECTIONS_FIELD, SECTION_ORDER_TYPE_NAME, SECTION_TYPE_NAME),
    validateOrderElementAdded(changes, CATEGORIES_FIELD, CATEGORY_ORDER_TYPE_NAME, CATEGORY_TYPE_NAME),
  )
}
