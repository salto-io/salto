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
  Change,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Value,
  getChangeData,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils/src/element_source'
import filterCreator from '../../src/filters/add_referencing_workbooks'
import { LocalFilterOpts } from '../../src/filter'
import { parsedDatasetType } from '../../src/type_parsers/analytics_parsers/parsed_dataset'
import { parsedWorkbookType } from '../../src/type_parsers/analytics_parsers/parsed_workbook'
import { translationcollectionType } from '../../src/autogen/types/standard_types/translationcollection'
import { NETSUITE, SCRIPT_ID, WORKBOOK } from '../../src/constants'

describe('add_referencing_workbooks filter', () => {
  const checkTopLevelParent = (newChange: Change): boolean =>
    isInstanceChange(newChange) &&
    // && isListType(getChangeData(newChange).value.dependencies.dependency)
    getChangeData(newChange).value.dependencies.dependency.every(
      (dependency: Value) => isReferenceExpression(dependency) && dependency.topLevelParent !== undefined,
    )

  const { type: workbook } = parsedWorkbookType()
  const translation = new InstanceElement('translationcollection', translationcollectionType().type, {
    scriptid: 'custcollection_seggev_translation',
    nameValue: 'The name',
  })
  translation.value.name_with_toplevelParent_and_resValue = new ReferenceExpression(
    translation.elemID.createNestedID('nameValue'),
    translation.value.nameValue,
    translation,
  )
  translation.value.name = new ReferenceExpression(translation.elemID.createNestedID('nameValue'))
  const dataset = new InstanceElement('dataset', parsedDatasetType().type, {
    scriptid: 'datasetScriptId',
  })
  const refToDataset = new ReferenceExpression(dataset.elemID.createNestedID('scriptid'))
  refToDataset.topLevelParent = dataset

  const objElement = new ObjectType({
    elemID: new ElemID(NETSUITE),
  })

  const referencingWorkbook = new InstanceElement('referencingWorkbook', workbook, {
    [SCRIPT_ID]: 'refWorkbook',
    dependencies: {
      dependency: [
        new ReferenceExpression(translation.elemID.createNestedID('nameValue')),
        new ReferenceExpression(translation.elemID),
        new ReferenceExpression(objElement.elemID),
        refToDataset,
      ],
    },
  })
  const unreferencingWorkbook = new InstanceElement('unreferencingWorkbook', workbook, {
    dependencies: {
      dependency: ['seggev test'],
    },
  })
  const workbookWithoutDependencies = new InstanceElement('workbookWithoutDependencies', workbook)
  it('should not add any workbook if there is no datasets in the deployment', async () => {
    const changes = [toChange({ after: referencingWorkbook })]
    const elementsSource = buildElementsSourceFromElements([
      dataset,
      referencingWorkbook,
      unreferencingWorkbook,
      workbookWithoutDependencies,
      translation,
    ])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(originalNumOfChanges)
  })
  it('should not add any workbook if there is a dataset and a workbook referencing it in the deployment', async () => {
    const changes = [toChange({ after: referencingWorkbook }), toChange({ after: dataset })]
    const elementsSource = buildElementsSourceFromElements([
      dataset,
      referencingWorkbook,
      unreferencingWorkbook,
      workbookWithoutDependencies,
      translation,
    ])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(originalNumOfChanges)
  })
  it('should not add any workbook if there is a dataset and a workbook referencing it, with other workbooks, in the deployment', async () => {
    const changes = [
      toChange({ after: unreferencingWorkbook }),
      toChange({ after: workbookWithoutDependencies }),
      toChange({ after: referencingWorkbook }),
      toChange({ after: dataset }),
    ]
    const elementsSource = buildElementsSourceFromElements([
      dataset,
      referencingWorkbook,
      unreferencingWorkbook,
      workbookWithoutDependencies,
      translation,
    ])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(originalNumOfChanges)
  })
  it('should add a workbook if there is no workbook in the deployment', async () => {
    const changes = [toChange({ after: dataset })]
    const elementsSource = buildElementsSourceFromElements([
      dataset,
      unreferencingWorkbook,
      workbookWithoutDependencies,
      referencingWorkbook,
      translation,
      objElement,
    ])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(originalNumOfChanges + 1)
    const addedChange = changes[originalNumOfChanges]
    expect(isModificationChange(addedChange)).toBeTruthy()
    expect(getChangeData(addedChange).elemID.typeName).toEqual(WORKBOOK)
    expect(getChangeData(addedChange).value.scriptid).toEqual(referencingWorkbook.value.scriptid)
    expect(checkTopLevelParent(addedChange)).toBeTruthy()
  })
  it('should add a workbook to the deployment if there is a unreferenced dataset', async () => {
    const changes = [toChange({ after: dataset }), toChange({ after: unreferencingWorkbook })]
    const elementsSource = buildElementsSourceFromElements([
      dataset,
      referencingWorkbook,
      unreferencingWorkbook,
      workbookWithoutDependencies,
      translation,
      objElement,
    ])
    const originalNumOfChanges = changes.length
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(originalNumOfChanges + 1)
    const addedChange = changes[originalNumOfChanges]
    expect(isModificationChange(addedChange)).toBeTruthy()
    expect(getChangeData(addedChange).elemID.typeName).toEqual(WORKBOOK)
    expect(getChangeData(addedChange).value.scriptid).toEqual(referencingWorkbook.value.scriptid)
    expect(checkTopLevelParent(addedChange)).toBeTruthy()
  })
})
