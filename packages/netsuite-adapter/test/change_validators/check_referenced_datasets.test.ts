/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import checkReferencedDatasets from '../../src/change_validators/check_referenced_datasets'
import { parsedDatasetType } from '../../src/type_parsers/analytics_parsers/parsed_dataset'
import { parsedWorkbookType } from '../../src/type_parsers/analytics_parsers/parsed_workbook'
import { mockChangeValidatorParams } from '../utils'

describe('unreferenced dataset validator', () => {
  const baseParams = mockChangeValidatorParams()
  const { type: dataset } = parsedDatasetType()
  const { type: workbook } = parsedWorkbookType()
  const referencedDataset = new InstanceElement('referencedDataset', dataset, {
    scriptid: 'referencedDatasetScriptId',
  })
  const unreferencedDataset = new InstanceElement('unreferencedDataset', dataset, {
    scriptid: 'unreferencedDatasetScriptId',
  })
  const referencingWorkbook = new InstanceElement('referencingWorkbook', workbook, {
    dependencies: {
      dependency: new ReferenceExpression(referencedDataset.elemID.createNestedID('scriptid')),
    },
  })
  const unreferencingWorkbook = new InstanceElement('unreferencingWorkbook', workbook, {
    dependencies: {
      dependency: ['seggev test'],
    },
  })
  const workbookWithoutDependencies = new InstanceElement('workbookWithoutDependencies', workbook)

  it('Should not have a change error when changing a dataset and a workbook referencing it', async () => {
    const changeErrors = await checkReferencedDatasets(
      [toChange({ after: referencedDataset }), toChange({ after: referencingWorkbook })],
      {
        ...baseParams,
        elementsSource: buildElementsSourceFromElements([referencedDataset, referencingWorkbook]),
      },
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('Should not have a change error when not changing a dataset', async () => {
    const changeErrors = await checkReferencedDatasets([toChange({ after: unreferencingWorkbook })], {
      ...baseParams,
      elementsSource: buildElementsSourceFromElements([unreferencingWorkbook]),
    })
    expect(changeErrors).toHaveLength(0)
  })

  it('Should have a change error (info type) when adding a dataset that is being referenced by a workbook in the elementsSource', async () => {
    const changeErrors = await checkReferencedDatasets([toChange({ after: referencedDataset })], {
      ...baseParams,
      elementsSource: buildElementsSourceFromElements([referencedDataset, referencingWorkbook]),
    })
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Info')
    expect(changeErrors[0].elemID).toBe(referencedDataset.elemID)
  })

  it('Should have a change error (error type) when adding a dataset that is not being referenced by any workbook in the elementsSource', async () => {
    const changeErrors = await checkReferencedDatasets(
      [toChange({ after: unreferencedDataset }), toChange({ after: unreferencingWorkbook })],
      {
        ...baseParams,
        elementsSource: buildElementsSourceFromElements([
          unreferencedDataset,
          referencedDataset,
          unreferencingWorkbook,
          referencingWorkbook,
          workbookWithoutDependencies,
        ]),
      },
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toBe(unreferencedDataset.elemID)
  })
})
