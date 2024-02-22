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

/* eslint-disable camelcase */
import {
  AdditionChange,
  ElemID,
  InstanceElement,
  ObjectType,
  isInstanceElement,
  isObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { LocalFilterOpts } from '../../src/filter'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import { parsedDatasetType } from '../../src/type_parsers/analytics_parsers/parsed_dataset'
import filterCreator from '../../src/filters/analytics_definition_handle'
import * as constants from '../../src/constants'
import {
  basicDataset,
  basicDatasetDefinition,
  basicWorkbookDefinition,
  defaultValuesDatasetDefinition,
  emptyDataset,
  emptyDatasetDefinition,
  emptyWorkbook,
  emptyWorkbookDefinition,
  parsedBasicDataset,
  parsedBasicDatasetValue,
  parsedBasicWorkbook,
  parsedDatasetWithDefaultCompletion,
  parsedTypesWorkbook,
  parsedUnknownDataset,
  typesWorkbook,
  unknownDataset,
  workbookDependencies,
  unknownDefinition,
  parsedWorkbookWithArrays,
  definitionWithArrays,
  tablesArray,
  pivotArray,
  basicWorkbook,
  parsedBasicWorkbookValue,
  parsedUnknownDatasetValueForFetch,
} from './analytics_tests_constants'
import { CHARTS, PIVOTS, TABLES } from '../../src/type_parsers/analytics_parsers/analytics_constants'

describe('analytics definition handle filter', () => {
  let fetchOpts: LocalFilterOpts
  const datasetPath = parsedDatasetType().type.path

  beforeEach(async () => {
    fetchOpts = {
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })

  describe('onFetch', () => {
    it('should remove old object type and add the new type', async () => {
      const datasetObject = new ObjectType({
        elemID: new ElemID('netsuite', constants.DATASET),
        path: datasetPath,
      })
      const elements = [datasetObject]
      await filterCreator(fetchOpts).onFetch?.(elements)
      expect(elements.filter(isObjectType).filter(e => e.elemID.typeName === constants.DATASET)[0]).not.toEqual(
        datasetObject,
      )
      expect(elements.filter(isObjectType).filter(e => e.elemID.typeName === constants.DATASET)[0]).toEqual(
        parsedDatasetType().type,
      )
    })
    it('Should accept unknown attributes and create an element', async () => {
      const elements = [unknownDataset]
      await filterCreator(fetchOpts).onFetch?.(elements)
      const newInstance = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === constants.DATASET)[0].value
      expect(newInstance).not.toEqual(unknownDataset)
      expect(newInstance).toEqual(parsedUnknownDatasetValueForFetch)
    })
    it('should handle different primitive types of attributes in the definition field', async () => {
      const elements = [typesWorkbook]
      await filterCreator(fetchOpts).onFetch?.(elements)
      const newInstance = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === constants.WORKBOOK)[0].value
      expect(newInstance).not.toEqual(typesWorkbook)
      expect(newInstance).toEqual(parsedTypesWorkbook)
    })
    it('should handle basic dataset', async () => {
      const elements = [basicDataset]
      await filterCreator(fetchOpts).onFetch?.(elements)
      const newInstance = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === constants.DATASET)[0].value
      expect(newInstance).not.toEqual(basicDataset)
      expect(newInstance).toEqual(parsedBasicDatasetValue)
    })
    it('should handle basic workbook', async () => {
      const elements = [basicWorkbook]
      await filterCreator(fetchOpts).onFetch?.(elements)
      const newInstance = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === constants.WORKBOOK)[0].value
      expect(newInstance).not.toEqual(basicWorkbook)
      expect(newInstance).toEqual(parsedBasicWorkbookValue)
    })
  })
  describe('preDeploy', () => {
    it('should add the right fields to an empty dataset', async () => {
      const datasetChange = toChange({ after: emptyDataset }) as AdditionChange<InstanceElement>
      await filterCreator(fetchOpts).preDeploy?.([datasetChange])
      expect(Object.keys(datasetChange.data.after.value)).toHaveLength(2)
      expect(datasetChange.data.after.value.definition).toEqual(emptyDatasetDefinition)
      expect(datasetChange.data.after.value.name).toEqual(emptyDataset.value.name)
      expect(datasetChange.data.after.value.scriptid).toEqual(emptyDataset.value.scriptid)
      expect(datasetChange.data.after.value.dependencies).toBeUndefined()
    })
    it('should add the right fields to an empty workbook', async () => {
      const analyticChange = toChange({ after: emptyWorkbook }) as AdditionChange<InstanceElement>
      await filterCreator(fetchOpts).preDeploy?.([analyticChange])
      expect(Object.keys(analyticChange.data.after.value)).toHaveLength(5)
      expect(analyticChange.data.after.value.definition).toEqual(emptyWorkbookDefinition)
      expect(analyticChange.data.after.value.name).toEqual(emptyWorkbook.value.name)
      expect(analyticChange.data.after.value.scriptid).toEqual(emptyWorkbook.value.scriptid)
      expect(analyticChange.data.after.value.dependencies).toBeUndefined()
    })
    it('should create a deployable element from basic dataset', async () => {
      const analyticChange = toChange({ after: parsedBasicDataset }) as AdditionChange<InstanceElement>
      await filterCreator(fetchOpts).preDeploy?.([analyticChange])
      expect(Object.keys(analyticChange.data.after.value)).toHaveLength(3)
      expect(analyticChange.data.after.value.definition).toEqual(basicDatasetDefinition)
      expect(analyticChange.data.after.value.name).toEqual(parsedBasicDataset.value.name)
      expect(analyticChange.data.after.value.scriptid).toEqual(parsedBasicDataset.value.scriptid)
      expect(analyticChange.data.after.value.dependencies).toBeUndefined()
    })
    it('should create a deployable element from basic workbook', async () => {
      const analyticChange = toChange({ after: parsedBasicWorkbook }) as AdditionChange<InstanceElement>
      await filterCreator(fetchOpts).preDeploy?.([analyticChange])
      expect(Object.keys(analyticChange.data.after.value)).toHaveLength(7)
      expect(analyticChange.data.after.value.definition).toEqual(basicWorkbookDefinition)
      expect(analyticChange.data.after.value.name).toEqual(parsedBasicWorkbook.value.name)
      expect(analyticChange.data.after.value.scriptid).toEqual(parsedBasicWorkbook.value.scriptid)
      expect(analyticChange.data.after.value.dependencies).toEqual(workbookDependencies)
      expect(analyticChange.data.after.value.tables).toEqual({
        table: [{ scriptid: 'custview72_16951029801843995215' }],
      })
    })
    it('should add default values to missing fields with that annotation', async () => {
      const analyticChange = toChange({ after: parsedDatasetWithDefaultCompletion }) as AdditionChange<InstanceElement>
      await filterCreator(fetchOpts).preDeploy?.([analyticChange])
      expect(Object.keys(analyticChange.data.after.value)).toHaveLength(3)
      expect(analyticChange.data.after.value.definition).toEqual(defaultValuesDatasetDefinition)
      expect(analyticChange.data.after.value.name).toEqual(parsedDatasetWithDefaultCompletion.value.name)
      expect(analyticChange.data.after.value.scriptid).toEqual(parsedDatasetWithDefaultCompletion.value.scriptid)
      expect(analyticChange.data.after.value.dependencies).toBeUndefined()
    })
    it('should handle unknown values in the create of the definition value', async () => {
      const analyticChange = toChange({ after: parsedUnknownDataset }) as AdditionChange<InstanceElement>
      await filterCreator(fetchOpts).preDeploy?.([analyticChange])
      expect(Object.keys(analyticChange.data.after.value)).toHaveLength(4)
      expect(analyticChange.data.after.value.definition).toEqual(unknownDefinition)
      expect(analyticChange.data.after.value.name).toEqual(parsedUnknownDataset.value.name)
      expect(analyticChange.data.after.value.scriptid).toEqual(parsedUnknownDataset.value.scriptid)
      expect(analyticChange.data.after.value.dependencies).toBeUndefined()
    })
    it('should create arrays of pivots/tables/charts/dataLinks as the original', async () => {
      const analyticChange = toChange({ after: parsedWorkbookWithArrays }) as AdditionChange<InstanceElement>
      await filterCreator(fetchOpts).preDeploy?.([analyticChange])
      expect(Object.keys(analyticChange.data.after.value)).toHaveLength(6)
      expect(analyticChange.data.after.value.definition).toEqual(definitionWithArrays)
      expect(analyticChange.data.after.value.name).toEqual(parsedWorkbookWithArrays.value.name)
      expect(analyticChange.data.after.value.scriptid).toEqual(parsedWorkbookWithArrays.value.scriptid)
      expect(analyticChange.data.after.value.dependencies).toBeUndefined()
      expect(analyticChange.data.after.value[TABLES]).toEqual({ table: tablesArray })
      expect(analyticChange.data.after.value[PIVOTS]).toEqual({ pivot: pivotArray })
      expect(analyticChange.data.after.value[CHARTS]).toEqual({ chart: [] })
    })
  })
})
