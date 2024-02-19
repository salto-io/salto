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
  createRefToElmWithValue,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isElement,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  ReadOnlyElementsSource,
  toChange,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { DATASET, SCRIPT_ID, TRANSLATION_COLLECTION, WORKBOOK } from '../constants'
import { LocalFilterCreator } from '../filter'
import {
  getAllWorkbooksFromElementsSource,
  getInstanceReferenceDependencies,
} from '../change_validators/check_referenced_datasets'
import { parsedWorkbookType } from '../type_parsers/analytics_parsers/parsed_workbook'

const resolveTypes = async (elem: Element, elementsSource: ReadOnlyElementsSource): Promise<void> => {
  if (isInstanceElement(elem)) {
    const type = await elem.getType(elementsSource)
    elem.refType = createRefToElmWithValue(type)
  }

  const transFunc: TransformFunc = async ({ value, field }) => {
    if (field === undefined) {
      return value
    }
    const fieldType = await field.getType(elementsSource)
    field.refType = createRefToElmWithValue(fieldType)
    return value
  }

  await transformElement({
    element: elem,
    transformFunc: transFunc,
    strict: false,
    elementsSource,
  })
}

const addInnerReferencesTopLevelParent = async (
  elem: InstanceElement,
  elementsSource: ReadOnlyElementsSource,
): Promise<void> => {
  const transFunc: TransformFunc = async ({ value }) => {
    if (isReferenceExpression(value) && value.topLevelParent === undefined) {
      const topLevelParent = await elementsSource.get(value.elemID.createTopLevelParentID().parent)
      if (isElement(topLevelParent)) {
        await resolveTypes(topLevelParent, elementsSource)
        value.topLevelParent = topLevelParent.clone()
      }
      if (
        value.elemID.typeName === TRANSLATION_COLLECTION &&
        isInstanceElement(value.topLevelParent) &&
        isReferenceExpression(value.topLevelParent.value.name)
      ) {
        if (value.elemID.isEqual(value.topLevelParent.value.name.elemID)) {
          value.topLevelParent.value.name.topLevelParent = value.topLevelParent
        } else {
          const refTopLevelParent = await elementsSource.get(
            value.topLevelParent.value.name.elemID.createTopLevelParentID().parent,
          )
          if (isElement(refTopLevelParent)) {
            await resolveTypes(refTopLevelParent, elementsSource)
            value.topLevelParent.value.name.topLevelParent = refTopLevelParent.clone()
          }
        }
      }
    }
    return value
  }

  await transformElement({
    element: elem,
    transformFunc: transFunc,
    strict: false,
  })
}

const getUnreferencedDatasets = (datasets: InstanceElement[], workbooks: InstanceElement[]): Set<string> => {
  const datasetElemIdFullNameSet = new Set<string>(
    datasets.map(dataset => dataset.elemID.createNestedID(SCRIPT_ID).getFullName()),
  )

  workbooks
    .flatMap(workbook => getInstanceReferenceDependencies(workbook))
    .map(dep => dep.elemID.getFullName())
    .forEach(fullName => datasetElemIdFullNameSet.delete(fullName))
  return datasetElemIdFullNameSet
}

const getWorkbooksToPush = async (
  datasets: InstanceElement[],
  changedWorkbooks: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement[]> => {
  const datasetFullNameSet = getUnreferencedDatasets(datasets, changedWorkbooks)

  if (datasetFullNameSet.size === 0) {
    return []
  }

  const allWorkbooks = await getAllWorkbooksFromElementsSource(elementsSource)

  return allWorkbooks.reduce(
    async (acc, workbook) => {
      if (datasetFullNameSet.size === 0) {
        return acc
      }
      const dependencies = getInstanceReferenceDependencies(workbook)
      const datasetDependencies = dependencies
        .map(dep => dep.elemID.getFullName())
        .filter(dep => datasetFullNameSet.has(dep))
      if (datasetDependencies.length > 0) {
        datasetDependencies.forEach(dep => datasetFullNameSet.delete(dep))
        const clonedWorkbook = workbook.clone()
        clonedWorkbook.refType = createRefToElmWithValue(parsedWorkbookType().type)
        await addInnerReferencesTopLevelParent(clonedWorkbook, elementsSource)
        const workbooks = await acc
        return workbooks.concat(clonedWorkbook)
      }
      return acc
    },
    Promise.resolve([] as InstanceElement[]),
  )
}

const filterCreator: LocalFilterCreator = ({ elementsSource }) => ({
  name: 'pushReferencingWorkbooks',
  preDeploy: async changes => {
    const instancesFromAdditionOrModificationChanges = changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)

    const workbooksToPush = await getWorkbooksToPush(
      instancesFromAdditionOrModificationChanges.filter(instance => instance.elemID.typeName === DATASET),
      instancesFromAdditionOrModificationChanges.filter(instance => instance.elemID.typeName === WORKBOOK),
      elementsSource,
    )
    changes.push(...workbooksToPush.map(workbook => toChange({ before: workbook, after: workbook })))
  },
})

export default filterCreator
