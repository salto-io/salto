/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  InstanceElement,
  ReadOnlyElementsSource,
  ReferenceExpression,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { NetsuiteChangeValidator } from './types'
import { DATASET, SCRIPT_ID, WORKBOOK } from '../constants'

const { awu } = collections.asynciterable

type UnreferencedDataset = {
  forInfos: InstanceElement[]
  forErrors: InstanceElement[]
}

export const getInstanceReferenceDependencies = (instance: InstanceElement): ReferenceExpression[] =>
  collections.array.makeArray(instance.value.dependencies?.dependency).filter(dep => isReferenceExpression(dep))

export const getAllWorkbooksFromElementsSource = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement[]> =>
  awu(await elementsSource.list())
    .filter(elemID => elemID.typeName === WORKBOOK && elemID.idType === 'instance')
    .map(async elemId => elementsSource.get(elemId))
    .toArray()

const getUnreferencedDatasetsDeploymentAndEnvironment = async (
  changedDatasets: InstanceElement[],
  changedWorkbooks: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
): Promise<UnreferencedDataset> => {
  const unreferencedDatasetsWithinDeployment = new Map<string, InstanceElement>()
  const unreferencedDatasetsWithinEnvironment = new Map<string, InstanceElement>(
    changedDatasets.map(dataset => [dataset.elemID.createNestedID(SCRIPT_ID).getFullName(), dataset]),
  )
  changedWorkbooks
    .flatMap(workbook => getInstanceReferenceDependencies(workbook))
    .map(dep => dep.elemID.getFullName())
    .forEach(fullName => unreferencedDatasetsWithinEnvironment.delete(fullName))
  if (unreferencedDatasetsWithinEnvironment.size > 0) {
    const allWorkbooks = await getAllWorkbooksFromElementsSource(elementsSource)
    allWorkbooks
      .flatMap(workbook => getInstanceReferenceDependencies(workbook))
      .map(dep => dep.elemID.getFullName())
      .forEach(fullName => {
        const dataset = unreferencedDatasetsWithinEnvironment.get(fullName)
        if (dataset !== undefined) {
          unreferencedDatasetsWithinDeployment.set(fullName, dataset)
          unreferencedDatasetsWithinEnvironment.delete(fullName)
        }
      })
  }

  return {
    forInfos: [...unreferencedDatasetsWithinDeployment.values()],
    forErrors: [...unreferencedDatasetsWithinEnvironment.values()],
  }
}

const changeValidator: NetsuiteChangeValidator = async (changes, { elementsSource }) => {
  const instancesFromAdditionOrModificationChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)

  const changedDatasets = instancesFromAdditionOrModificationChanges.filter(inst => inst.elemID.typeName === DATASET)

  if (changedDatasets.length === 0) {
    return []
  }

  const changedWorkbooks = instancesFromAdditionOrModificationChanges.filter(inst => inst.elemID.typeName === WORKBOOK)

  const { forInfos: unreferencedInDeployment, forErrors: unreferencedInEnvironment } =
    await getUnreferencedDatasetsDeploymentAndEnvironment(changedDatasets, changedWorkbooks, elementsSource)

  const errors = unreferencedInDeployment
    .map(
      ({ elemID }): ChangeError => ({
        elemID,
        severity: 'Info',
        message: 'To deploy this, an existing workbook will be re-deployed',
        detailedMessage:
          'A dataset must be deployed alongside a workbook which was connected to it. ' +
          'Salto will automatically add to the SDF deployment an existing workbook (and the translation collection instances related to that workbook) which was already connected to this dataset. This should not affect the target environment.',
      }),
    )
    .concat(
      unreferencedInEnvironment.map(
        ({ elemID }): ChangeError => ({
          elemID,
          severity: 'Error',
          message: 'This dataset cannot be deployed without any connected workbooks',
          detailedMessage:
            'A dataset must be deployed alongside a workbook which was connected to it. ' +
            'To deploy this dataset, add at least one workbook to your deployment which has this dataset connected.',
        }),
      ),
    )
  return errors
}

export default changeValidator
