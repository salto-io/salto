/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { AdditionChange, ElemID, InstanceElement, isListType, isObjectType, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import filterCreator, { shouldBeList } from '../../src/filters/parse_report_types'
import { savedsearchType } from '../../src/autogen/types/standard_types/savedsearch'
import { reportdefinitionType } from '../../src/autogen/types/standard_types/reportdefinition'
import { financiallayoutType } from '../../src/autogen/types/standard_types/financiallayout'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE, SAVED_SEARCH } from '../../src/constants'
import { FilterOpts } from '../../src/filter'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import { savedsearchType as newSavedSearchType } from '../../src/type_parsers/saved_search_parsing/parsed_saved_search'
import { layoutDefinition, layoutDefinitionResult } from '../type_parsers/financial_layout_consts'
import { emptyDefinition, emptyDefinitionOutcome } from '../type_parsers/saved_search_definition'
import { simpleReportDefinitionResult, simpleReportDefinition } from '../type_parsers/report_definitions_consts'
import { getInnerStandardTypes, getTopLevelStandardTypes } from '../../src/types'
import { TypesMap } from '../../src/types/object_types'
import { StandardType } from '../../src/autogen/types'

const { awu } = collections.asynciterable

describe('parse_report_types filter', () => {
  let savedSearchInstance: InstanceElement
  let sourceSavedSearchInstance: InstanceElement
  let fetchOpts: FilterOpts
  let financialLayoutInstance: InstanceElement
  let sourceFinancialLayoutInstance: InstanceElement
  let reportDefinitionInstance: InstanceElement
  let sourceReportDefinitionInstance: InstanceElement

  beforeEach(async () => {
    fetchOpts = {
      client: {} as NetsuiteClient,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }

    const savedsearch = savedsearchType().type
    const financiallayout = financiallayoutType().type
    const reportdefinition = reportdefinitionType().type
    savedSearchInstance = new InstanceElement(
      'someSearch',
      savedsearch,
      { definition: emptyDefinition }
    )
    sourceSavedSearchInstance = new InstanceElement(
      'someSearch',
      savedsearch,
      { definition: `source@${emptyDefinition}` }
    )

    financialLayoutInstance = new InstanceElement(
      'layout1',
      financiallayout,
      { layout: layoutDefinition }
    )
    sourceFinancialLayoutInstance = new InstanceElement(
      'layout1',
      financiallayout,
      { layout: `source@${layoutDefinition}` }
    )
    reportDefinitionInstance = new InstanceElement(
      'report1',
      reportdefinition,
      { definition: simpleReportDefinition }
    )
    sourceReportDefinitionInstance = new InstanceElement(
      'report1',
      reportdefinition,
      { definition: `source@${simpleReportDefinition}` }
    )
  })
  describe('onFetch', () => {
    it('should removes old object type and adds new type', async () => {
      const savedSearchObject = new ObjectType({ elemID: new ElemID('netsuite', SAVED_SEARCH) })
      const elements = [savedSearchObject]
      await filterCreator(fetchOpts).onFetch?.(elements)
      expect(elements.filter(isObjectType)
        .filter(e => e.elemID.typeName === SAVED_SEARCH)[0])
        .not.toEqual(savedSearchObject)
      expect(elements.filter(isObjectType)
        .filter(e => e.elemID.typeName === SAVED_SEARCH)[0])
        .toEqual(newSavedSearchType().type)
    })
    it('should removes doubled dependency object type', async () => {
      const dependencyObjectType = new ObjectType({ elemID: new ElemID(NETSUITE, 'savedsearch_dependencies'),
        fields: {} })
      const elements = [dependencyObjectType]
      await filterCreator(fetchOpts).onFetch?.(elements)
      expect(elements.filter(isObjectType)
        .filter(e => e.elemID.typeName === SAVED_SEARCH)[0])
        .not.toEqual(dependencyObjectType)
    })
    it('should adds definition values', async () => {
      await filterCreator(fetchOpts).onFetch?.([savedSearchInstance, reportDefinitionInstance, financialLayoutInstance])
      expect(savedSearchInstance.value).toEqual({ definition: emptyDefinition, ...emptyDefinitionOutcome })
      expect(reportDefinitionInstance.value).toEqual(
        { definition: simpleReportDefinition, ...simpleReportDefinitionResult }
      )
      expect(financialLayoutInstance.value).toEqual({ layout: layoutDefinition, ...layoutDefinitionResult })
    })
    it('should keeps old definition', async () => {
      const sourceElements = [
        sourceSavedSearchInstance,
        sourceFinancialLayoutInstance,
        sourceReportDefinitionInstance,
      ]
      await filterCreator(fetchOpts).onFetch?.(sourceElements)
      fetchOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements(sourceElements),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(fetchOpts).onFetch?.([savedSearchInstance, reportDefinitionInstance, financialLayoutInstance])
      expect(savedSearchInstance.value.definition).toEqual(`source@${emptyDefinition}`)
      expect(reportDefinitionInstance.value.definition).toEqual(`source@${simpleReportDefinition}`)
      expect(financialLayoutInstance.value.layout).toEqual(`source@${layoutDefinition}`)
    })
    it('should make list', async () => {
      savedSearchInstance.value.dependencies = { dependency: 'some_dependency' }
      await filterCreator(fetchOpts).onFetch?.([savedSearchInstance])
      expect(savedSearchInstance.value.dependencies.dependency).toEqual(['some_dependency'])
    })
    it('validate fields that needs to be lists', async () => {
      const typesAndInnerTypes = {
        savedsearch: savedsearchType(),
        financiallayout: financiallayoutType(),
        reportdefinition: reportdefinitionType(),
      } as TypesMap<StandardType>
      const typesToCheck = getTopLevelStandardTypes(typesAndInnerTypes)
        .concat(getInnerStandardTypes(typesAndInnerTypes))
      const typesWithLists = await awu(typesToCheck)
        .filter(type => awu(Object.values(type.fields))
          .some(async field => isListType(await field.getType())))
        .toArray()
      expect(typesWithLists).toHaveLength(1)
      expect(typesWithLists[0].elemID.getFullName()).toEqual('netsuite.savedsearch_dependencies')
      expect(Object.values(shouldBeList).flatMap(perType => Object.values(perType))).toHaveLength(1)
      expect(shouldBeList[SAVED_SEARCH][0]).toEqual(['dependencies', 'dependency'])
      const dependenciesInnerType = await newSavedSearchType().type.fields[shouldBeList[SAVED_SEARCH][0][0]].getType()
      expect(isObjectType(dependenciesInnerType)
      && isListType(await dependenciesInnerType.fields[shouldBeList[SAVED_SEARCH][0][1]].getType())).toBeTruthy()
    })
  })
  describe('preDeploy', () => {
    it('should preDeploy removes values', async () => {
      savedSearchInstance.value.test = 'toBeRemoved'
      financialLayoutInstance.value.test = 'toBeRemoved'
      const savedSearchChange = toChange({ after: savedSearchInstance }) as AdditionChange<InstanceElement>
      const financialLayoutChange = toChange({ after: financialLayoutInstance }) as AdditionChange<InstanceElement>
      expect(savedSearchChange.data.after.value.test).toEqual('toBeRemoved')
      await filterCreator(fetchOpts).preDeploy?.([savedSearchChange, financialLayoutChange])
      expect(savedSearchChange.data.after.value.test).toBeUndefined()
      expect(financialLayoutChange.data.after.value.test).toBeUndefined()
    })
  })
})
