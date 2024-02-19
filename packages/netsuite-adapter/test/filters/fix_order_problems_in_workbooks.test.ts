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
import { InstanceElement, isInstanceElement, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { LocalFilterOpts } from '../../src/filter'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import filterCreator from '../../src/filters/fix_order_problems_in_workbooks'
import * as constants from '../../src/constants'
import {
  CHARTS,
  DATASETS,
  DATASET_LINK,
  DATASET_LINKS,
  DEPENDENCIES,
  DEPENDENCY,
  PIVOTS,
} from '../../src/type_parsers/analytics_parsers/analytics_constants'
import { parsedWorkbookType } from '../../src/type_parsers/analytics_parsers/parsed_workbook'
import { parsedDatasetType } from '../../src/type_parsers/analytics_parsers/parsed_dataset'

describe('analytics definition handle filter', () => {
  let fetchOpts: LocalFilterOpts
  let workbook: InstanceElement
  let oldWorkbook: InstanceElement
  let oldWorkbookWithStrangeFields: InstanceElement
  let newWorkbookWithStrangeFields: InstanceElement
  let deployWorkbook: InstanceElement
  let deployWorkbookWith3Datasets: InstanceElement
  let deployDataset1: InstanceElement
  let deployDataset2: InstanceElement
  let deployDataset3: InstanceElement

  const workbookType = parsedWorkbookType().type
  const datasetType = parsedDatasetType().type

  const originOldWorkbook = new InstanceElement('custworkbook_order_test', workbookType, {
    name: 'order test',
    scriptid: 'custworkbook_order_test',
    [PIVOTS]: [
      {
        pivot: {
          [constants.SOAP_SCRIPT_ID]: '4',
          datasets: ['a', 'b'],
          definition:
            '<root><version>1</version><columnAxis><dimensionTree><_T_>dataDimension</_T_><id>6</id><children type="array"><_ITEM_><ref>3</ref></_ITEM_></children><items type="array"><_ITEM_><id>2</id><expression><function>field</function><args><type><_T_>textType</_T_></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>displaynamewithhierarchy</fieldId></args></expression></_ITEM_></items></dimensionTree><uiSettings><headerAlwaysVisible type="boolean">true</headerAlwaysVisible></uiSettings></columnAxis><rowAxis><dimensionTree><_T_>section</_T_><id>5</id><children type="array"><_ITEM_><_T_>dataDimension</_T_><id>4</id><items type="array"><_ITEM_><id>1</id><expression><function>field</function><args><type><_T_>textType</_T_></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>description</fieldId></args></expression></_ITEM_></items></_ITEM_></children></dimensionTree></rowAxis><measures type="array"><_ITEM_><_T_>dataMeasure</_T_><id>3</id><aggregation>count</aggregation><expression><function>field</function><args><type><_T_>recordType</_T_><id>record_accttype</id></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>accttype</fieldId></args></expression></_ITEM_></measures></root>',
        },
      },
    ],
  })
  const originWorkbook = new InstanceElement('custworkbook_order_test', workbookType, {
    name: 'order test',
    scriptid: 'custworkbook_order_test',
    [PIVOTS]: [
      {
        pivot: {
          [constants.SOAP_SCRIPT_ID]: '4',
          datasets: ['b', 'a'],
          definition:
            '<root><version>1</version><rowAxis><dimensionTree><_T_>section</_T_><id>5</id><children type="array"><_ITEM_><_T_>dataDimension</_T_><id>4</id><items type="array"><_ITEM_><id>1</id><expression><function>field</function><args><type><_T_>textType</_T_></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>description</fieldId></args></expression></_ITEM_></items></_ITEM_></children></dimensionTree></rowAxis><columnAxis><dimensionTree><_T_>dataDimension</_T_><id>6</id><children type="array"><_ITEM_><ref>3</ref></_ITEM_></children><items type="array"><_ITEM_><id>2</id><expression><function>field</function><args><type><_T_>textType</_T_></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>displaynamewithhierarchy</fieldId></args></expression></_ITEM_></items></dimensionTree><uiSettings><headerAlwaysVisible type="boolean">true</headerAlwaysVisible></uiSettings></columnAxis><measures type="array"><_ITEM_><_T_>dataMeasure</_T_><id>3</id><aggregation>count</aggregation><expression><function>field</function><args><type><_T_>recordType</_T_><id>record_accttype</id></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>accttype</fieldId></args></expression></_ITEM_></measures></root>',
        },
      },
    ],
  })

  const workbookForDeploy = new InstanceElement('custworkbook_dependencies_test', workbookType, {
    [constants.SCRIPT_ID]: 'custworkbook_dependencies_test',
    [DATASET_LINKS]: [
      {
        dsLink: {
          [DATASETS]: ['custdataset_1', 'custdataset_2'],
        },
      },
    ],
  })
  const workbookForDeploywith3Datasets = new InstanceElement('custworkbook_dependencies_test', workbookType, {
    [constants.SCRIPT_ID]: 'custworkbook_dependencies_test',
    [DATASET_LINKS]: [
      {
        dsLink: {
          [DATASETS]: ['custdataset_1', 'custdataset_2', 'custdataset_3'],
        },
      },
    ],
  })
  const oldOddWorkbook = new InstanceElement('custworkbook_with_odd_fields', workbookType, {
    name: 'order test',
    scriptid: 'custworkbook_with_odd_fields',
    [PIVOTS]: [
      {
        pivot: {
          [constants.SOAP_SCRIPT_ID]: '4',
          datasets: ['a', 'b'],
          definition:
            '<root><version>1</version><columnAxis><dimensionTree><_T_>dataDimension</_T_><id>6</id><children type="array"><_ITEM_><ref>3</ref></_ITEM_></children><items type="array"><_ITEM_><id>2</id><expression><function>field</function><args><type><_T_>textType</_T_></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>displaynamewithhierarchy</fieldId></args></expression></_ITEM_></items></dimensionTree><uiSettings><headerAlwaysVisible type="boolean">true</headerAlwaysVisible></uiSettings></columnAxis><rowAxis><dimensionTree><_T_>section</_T_><id>5</id><children type="array"><_ITEM_><_T_>dataDimension</_T_><id>4</id><items type="array"><_ITEM_><id>1</id><expression><function>field</function><args><type><_T_>textType</_T_></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>description</fieldId></args></expression></_ITEM_></items></_ITEM_></children></dimensionTree></rowAxis><measures type="array"><_ITEM_><_T_>dataMeasure</_T_><id>3</id><aggregation>count</aggregation><expression><function>field</function><args><type><_T_>recordType</_T_><id>record_accttype</id></type><dataSourceId>custdataset_dilly_1</dataSourceId><fieldId>accttype</fieldId></args></expression></_ITEM_></measures></root>',
        },
      },
    ],
    [CHARTS]: [
      'string and not plain object',
      {
        chart_with_number_scriptid: {
          [constants.SOAP_SCRIPT_ID]: 5,
        },
      },
      {
        chart_with_scriptid_without_definition: {
          [constants.SOAP_SCRIPT_ID]: '5',
        },
      },
      {
        chart_with_scriptid_with_definition_not_string: {
          [constants.SOAP_SCRIPT_ID]: '6',
          definition: 6,
        },
      },
      {
        chart_with_scriptid_with_definition: {
          [constants.SOAP_SCRIPT_ID]: '7',
          definition: 6,
        },
      },
    ],
    [DATASET_LINKS]: [
      {
        [DATASET_LINK]: {
          [DATASETS]: 5,
        },
      },
    ],
  })
  const newOddWorkbook = oldOddWorkbook.clone()
  newOddWorkbook.value[PIVOTS][0].pivot.definition = '<root><version>1</version></root>' // different xml
  newOddWorkbook.value[CHARTS][3].chart_with_scriptid_with_definition_not_string[constants.SOAP_SCRIPT_ID] = 7

  const dataset1ForDeploy = new InstanceElement('custdataset_1', datasetType, {
    [constants.SCRIPT_ID]: 'custdataset_1',
    [DEPENDENCIES]: {
      [DEPENDENCY]: [],
    },
  })

  const dataset2ForDeploy = new InstanceElement('custdataset_2', datasetType, {
    [constants.SCRIPT_ID]: 'custdataset_2',
    [DEPENDENCIES]: {
      [DEPENDENCY]: [],
    },
  })

  const dataset3ForDeploy = new InstanceElement('custdataset_3', datasetType, {
    [constants.SCRIPT_ID]: 'custdataset_3',
    [DEPENDENCIES]: {
      [DEPENDENCY]: [],
    },
  })

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
    beforeEach(async () => {
      workbook = originWorkbook.clone()
      oldWorkbook = originOldWorkbook.clone()
      oldWorkbookWithStrangeFields = oldOddWorkbook.clone()
      newWorkbookWithStrangeFields = newOddWorkbook.clone()
    })
    it('should sort the order of the datasets in the pivot', async () => {
      const elements = [workbook, oldWorkbookWithStrangeFields]
      fetchOpts.elementsSource = buildElementsSourceFromElements([oldWorkbook, newWorkbookWithStrangeFields])
      await filterCreator(fetchOpts).onFetch?.(elements)
      const newWorkbook = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === constants.WORKBOOK)[0]
      expect(newWorkbook.value.pivots[0].pivot.datasets).toEqual([...newWorkbook.value.pivots[0].pivot.datasets].sort())
    })
    it("should not change workbook's inner XML if changed only by order", async () => {
      const elements = [workbook]
      fetchOpts.elementsSource = buildElementsSourceFromElements([oldWorkbook])
      await filterCreator(fetchOpts).onFetch?.(elements)
      const newWorkbook = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === constants.WORKBOOK)[0]
      expect(newWorkbook.value.pivots[0].pivot.definition).toEqual(oldWorkbook.value.pivots[0].pivot.definition)
    })
  })
  describe('preDeploy', () => {
    beforeEach(async () => {
      deployWorkbook = workbookForDeploy.clone()
      deployWorkbookWith3Datasets = workbookForDeploywith3Datasets.clone()
      deployDataset1 = dataset1ForDeploy.clone()
      deployDataset2 = dataset2ForDeploy.clone()
      deployDataset3 = dataset3ForDeploy.clone()
      workbook = originWorkbook.clone()
    })
    it('should not add dependency to unrelated datasets', async () => {
      const changes = [
        toChange({ after: deployWorkbook }),
        toChange({ after: deployDataset1 }),
        toChange({ after: deployDataset3 }),
        toChange({ after: workbook }),
        toChange({ after: newOddWorkbook }),
      ]
      await filterCreator(fetchOpts).preDeploy?.(changes)
      expect(_.isEmpty(deployDataset1.value[DEPENDENCIES][DEPENDENCY])).toBeTruthy()
      expect(_.isEmpty(deployDataset3.value[DEPENDENCIES][DEPENDENCY])).toBeTruthy()
    })
    it('should add dependency to related datasets', async () => {
      const changes = [
        toChange({ after: deployWorkbook }),
        toChange({ after: deployDataset1 }),
        toChange({ after: deployDataset2 }),
      ]
      await filterCreator(fetchOpts).preDeploy?.(changes)
      expect(_.isEmpty(deployDataset1.value[DEPENDENCIES][DEPENDENCY])).toBeTruthy()
      expect(_.isEmpty(deployDataset2.value[constants.ADDITIONAL_DEPENDENCIES])).toBeFalsy()
      const additionalDependency = deployDataset2.value[constants.ADDITIONAL_DEPENDENCIES][0]
      expect(
        additionalDependency === `[${constants.SCRIPT_ID}=${deployDataset1.value[constants.SCRIPT_ID]}]`,
      ).toBeTruthy()
    })
    it('should add dependency to related datasets with 3 datasets', async () => {
      const changes = [
        toChange({ after: deployWorkbookWith3Datasets }),
        toChange({ after: deployDataset1 }),
        toChange({ after: deployDataset2 }),
        toChange({ after: deployDataset3 }),
      ]
      await filterCreator(fetchOpts).preDeploy?.(changes)
      expect(_.isEmpty(deployDataset1.value[DEPENDENCIES][DEPENDENCY])).toBeTruthy()
      expect(_.isEmpty(deployDataset2.value[constants.ADDITIONAL_DEPENDENCIES])).toBeFalsy()
      expect(_.isEmpty(deployDataset3.value[constants.ADDITIONAL_DEPENDENCIES])).toBeFalsy()
      const additionalDependencyOf2 = deployDataset2.value[constants.ADDITIONAL_DEPENDENCIES][0]
      const additionalDependencyOf3 = deployDataset3.value[constants.ADDITIONAL_DEPENDENCIES][0]
      expect(
        additionalDependencyOf2 === `[${constants.SCRIPT_ID}=${deployDataset1.value[constants.SCRIPT_ID]}]`,
      ).toBeTruthy()
      expect(
        additionalDependencyOf3 === `[${constants.SCRIPT_ID}=${deployDataset2.value[constants.SCRIPT_ID]}]`,
      ).toBeTruthy()
    })
  })
})
