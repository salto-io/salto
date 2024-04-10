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

import {
  ChangeError,
  FixElementsFunc,
  GetCustomReferencesFunc,
  InstanceElement,
  ReadOnlyElementsSource,
  ReferenceExpression,
  ReferenceInfo,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { WeakReferencesHandler } from '@salto-io/adapter-components'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  ARTICLE_ORDER_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME,
  ORDER_TYPE_NAMES,
  SECTION_ORDER_TYPE_NAME,
  TRIGGER_ORDER_TYPE_NAME,
} from '../../constants'

const { awu } = collections.asynciterable

const isOrderType = (instance: InstanceElement): boolean => ORDER_TYPE_NAMES.includes(instance.elemID.typeName)

const getInstanceOrderPaths = (instance: InstanceElement): string[] => {
  switch (instance.elemID.typeName) {
    case CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME:
      return ['custom_object_fields']
    case CATEGORY_ORDER_TYPE_NAME:
      return ['category']
    case SECTION_ORDER_TYPE_NAME:
      return ['section']
    case ARTICLE_ORDER_TYPE_NAME:
      return ['article']
    case TRIGGER_ORDER_TYPE_NAME:
      if (!Array.isArray(instance.value.order)) {
        return []
      }
      return instance.value.order.flatMap((_category, index) => [`order.${index}.active`, `order.${index}.inactive`])
    default:
      return ['active', 'inactive']
  }
}

const getInstanceOrderReferences = (
  instance: InstanceElement,
): { path: string; referenceElements: ReferenceExpression[] }[] =>
  getInstanceOrderPaths(instance).map(path => ({ path, referenceElements: _.get(instance.value, path) }))

const getWeakElementReferences = (instance: InstanceElement): ReferenceInfo[] => {
  if (!isOrderType(instance)) {
    return []
  }
  const instanceOrderReferences = getInstanceOrderReferences(instance)
  if (!Array.isArray(instanceOrderReferences)) {
    return []
  }
  return instanceOrderReferences
    .flatMap(({ path, referenceElements }) =>
      Array.isArray(referenceElements)
        ? referenceElements.map((referenceElement, index) =>
            isReferenceExpression(referenceElement)
              ? {
                  source: instance.elemID.createNestedID(path, index.toString()),
                  target: referenceElement.elemID,
                  type: 'weak' as const,
                }
              : undefined,
          )
        : undefined,
    )
    .filter(values.isDefined)
}

/**
 * Marks each element reference in an order type as a weak reference.
 */
const getOrderElementsReferences: GetCustomReferencesFunc = async elements =>
  elements.filter(isInstanceElement).flatMap(getWeakElementReferences)

const typeNameWithoutOrder = (typeName: string): string => typeName.substring(0, typeName.length - '_order'.length)

const getFixedElementsAndUpdatedPaths =
  (elementsSource: ReadOnlyElementsSource) =>
  async (instance: InstanceElement): Promise<{ instance: InstanceElement; paths: string[] } | undefined> => {
    const filterReferencesNotInSource = async (
      allReferences: ReferenceExpression[],
    ): Promise<(ReferenceExpression | number)[]> =>
      awu<ReferenceExpression | number>(allReferences)
        .filter(
          async reference =>
            !isReferenceExpression(reference) ||
            // eslint-disable-next-line no-return-await
            (await elementsSource.has(reference.elemID)),
        )
        .toArray()

    const instanceOrderPaths = getInstanceOrderPaths(instance)
    if (instanceOrderPaths === undefined || !Array.isArray(instanceOrderPaths)) {
      return undefined
    }

    const fixedInstance = instance.clone()
    await awu(instanceOrderPaths).forEach(async path => {
      const allReferences = _.get(instance.value, path)
      if (Array.isArray(allReferences)) {
        const references = await filterReferencesNotInSource(allReferences)
        _.set(fixedInstance.value, path, references)
      }
    })

    const changedPaths = instanceOrderPaths.filter(
      path => _.get(fixedInstance.value, path)?.length !== _.get(instance.value, path)?.length,
    )

    // No order list length changed
    if (changedPaths.length === 0) {
      return undefined
    }

    return {
      instance: fixedInstance,
      paths: changedPaths,
    }
  }

/**
 * Remove invalid references (not references or missing references) from order types.
 */
const removeMissingOrderElements: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}>['removeWeakReferences'] =
  ({ elementsSource }): FixElementsFunc =>
  async elements => {
    const fixedElementsWithPaths = await awu(elements)
      .filter(isInstanceElement)
      .filter(isOrderType)
      .map(getFixedElementsAndUpdatedPaths(elementsSource))
      .filter(values.isDefined)
      .toArray()

    const errors: ChangeError[] = fixedElementsWithPaths.flatMap(({ instance, paths }) =>
      paths.map(path => {
        const fullPath = `${instance.elemID.typeName}.${path}`
        const elementTypeName = `${typeNameWithoutOrder(instance.elemID.typeName)}s`
        return {
          elemID: instance.elemID.createNestedID(path),
          severity: 'Info',
          message: `Deploying without all attached ${elementTypeName}`,
          detailedMessage: `This ${fullPath} is attached to some ${elementTypeName} that do not exist in the target environment. It will be deployed without referencing these ${elementTypeName}.`,
        }
      }),
    )
    return { fixedElements: fixedElementsWithPaths.map(element => element.instance), errors }
  }

export const orderElementsHandler: WeakReferencesHandler<{
  elementsSource: ReadOnlyElementsSource
}> = {
  findWeakReferences: getOrderElementsReferences,
  removeWeakReferences: removeMissingOrderElements,
}
