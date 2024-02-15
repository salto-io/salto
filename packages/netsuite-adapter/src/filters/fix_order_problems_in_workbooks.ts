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

import { Change, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceElement, ReadOnlyElementsSource, Value, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { parse } from 'fast-xml-parser'
import { decode } from 'he'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { DATASET, SCRIPT_ID, SOAP_SCRIPT_ID, WORKBOOK } from '../constants'
import { LocalFilterCreator } from '../filter'
import { ATTRIBUTE_PREFIX } from '../client/constants'
import { DATASET_LINK, DATASET_LINKS, DATASETS, INNER_ARRAY_NAMES, INNER_XML_TITLES } from '../type_parsers/analytics_parsers/analytics_constants'
import { addAdditionalDependency } from '../client/utils'

const log = logger(module)
const { awu } = collections.asynciterable

const addWorkbookToolsToRecord = (
  instance: InstanceElement,
  workbookToolsRecord: Record<string, Values>,
  name: string
): void => {
  if (Array.isArray(instance.value[name])) {
    instance.value[name].forEach((tool: unknown) => {
      if (values.isPlainObject(tool)) {
        Object.values(tool)
          .filter(values.isPlainObject)
          .forEach((obj: Values) => {
            if (_.isString(obj[SOAP_SCRIPT_ID])) {
              workbookToolsRecord[obj[SOAP_SCRIPT_ID]] = obj
            }
          })
      }
    })
  }
}

const createRecordOfPivotsChartsAndDsLinks = async (
  elementsSource: ReadOnlyElementsSource,
  elemID: ElemID,
): Promise<Record<string, Values>> => {
  const oldWorkbookToolsRecord: Record<string, Values> = {}
  const oldInstance = await elementsSource.get(elemID)
  if (isInstanceElement(oldInstance)) {
    INNER_ARRAY_NAMES.forEach(arrayName => {
      addWorkbookToolsToRecord(oldInstance, oldWorkbookToolsRecord, arrayName)
    })
  }
  return oldWorkbookToolsRecord
}

const isSameXmlValues = (xml1: string, xml2: string): boolean => {
  const values1 = parse(xml1, {
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    ignoreAttributes: false,
    tagValueProcessor: val => decode(val),
  })
  const values2 = parse(xml2, {
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    ignoreAttributes: false,
    tagValueProcessor: val => decode(val),
  })
  return _.isEqual(values1, values2)
}

const getInnerXmlTitle = (workbookTool: Values): string | undefined =>
  INNER_XML_TITLES.find(title => title in workbookTool)

const compareAndAssignInnerXmls = (newTool: Values, oldTool: Values): void => {
  const innerXmlTitle = getInnerXmlTitle(newTool)
  if (innerXmlTitle === undefined) {
    return
  }
  const innerXmlNew = newTool[innerXmlTitle]
  const innerXmlOld = oldTool[innerXmlTitle]
  if (!_.isString(innerXmlNew) || !_.isString(innerXmlOld)) {
    return
  }
  if (isSameXmlValues(innerXmlNew, innerXmlOld)) {
    newTool[innerXmlTitle] = oldTool[innerXmlTitle]
  }
}

const adjustWorkbookToolsOrder = (workbookTools: Value[], oldWorkbookToolsRecord: Record<string, Values>): void => {
  workbookTools
    .filter(values.isPlainObject)
    .flatMap(obj => Object.values(obj))
    .filter(values.isPlainRecord)
    .forEach((workbookTool: Values) => {
      if (_.isArray(workbookTool[DATASETS])) {
        workbookTool[DATASETS].sort()
      }
      if (_.isString(workbookTool[SOAP_SCRIPT_ID]) && workbookTool[SOAP_SCRIPT_ID] in oldWorkbookToolsRecord) {
        const oldWorkbookTool = oldWorkbookToolsRecord[workbookTool[SOAP_SCRIPT_ID]]
        compareAndAssignInnerXmls(workbookTool, oldWorkbookTool)
      }
    })
}

const discardUnrelevantChanges = (
  newInstanceValues: Values,
  oldTools: Record<string, Values>,
): void => {
  INNER_ARRAY_NAMES.forEach(arrName => {
    if (Array.isArray(newInstanceValues[arrName])) {
      adjustWorkbookToolsOrder(newInstanceValues[arrName], oldTools)
    }
  })
}

// The deployment order of datasets affected the list order and resulted in changes to the fetch operations.
// We created dependencies between the datasets to ensure the correct order.
const addDependencyToDataset = (
  datasetFirstName: string,
  datasetSecondName: string,
  datasetMap: Map<string, InstanceElement>,
): void => {
  const firstDataset = datasetMap.get(datasetFirstName)
  const secondDataset = datasetMap.get(datasetSecondName)
  if (isInstanceElement(firstDataset) && isInstanceElement(secondDataset)) {
    addAdditionalDependency(secondDataset, firstDataset.value[SCRIPT_ID])
  }
}

const getDatasetLinkList = (workbook: InstanceElement): Values[] =>
  (Array.isArray(workbook.value[DATASET_LINKS])
    ? workbook.value[DATASET_LINKS]
      .filter(values.isPlainRecord)
      .map((obj: Values) => obj[DATASET_LINK])
      .filter(values.isPlainObject)
    : [])

const isStringArray = (val: unknown): val is string[] => Array.isArray(val) && _.every(val, _.isString)

const filterCreator: LocalFilterCreator = ({ elementsSource }) => ({
  name: 'fixOrderProblemsInWorkbooks',
  onFetch: async elements => {
    const workbooks = elements
      .filter(elem => elem.elemID.typeName === WORKBOOK)
      .filter(isInstanceElement)
    await awu(workbooks)
      .forEach(async instance => {
        const oldTools = await createRecordOfPivotsChartsAndDsLinks(elementsSource, instance.elemID)
        discardUnrelevantChanges(instance.value, oldTools)
      })
  },

  preDeploy: async (changes: Change[]) => {
    const changedDatasets = changes
      .filter(isAdditionOrModificationChange)
      .filter(change => change.data.after.elemID.typeName === DATASET)
      .map(getChangeData)
      .filter(isInstanceElement)

    const datasetMap = new Map<string, InstanceElement>(
      changedDatasets.map(dataset => [dataset.value[SCRIPT_ID], dataset])
    )

    const workbooks = changes
      .filter(isAdditionOrModificationChange)
      .filter(change => change.data.after.elemID.typeName === WORKBOOK)
      .map(getChangeData)
      .filter(isInstanceElement)

    workbooks.forEach(workbook => {
      getDatasetLinkList(workbook)
        .forEach(dslink => {
          const datasetNamesArray = dslink[DATASETS]
          if (isStringArray(datasetNamesArray)) {
            if (datasetNamesArray.length !== 2) {
              log.debug('There is a datasetLink with different number of datasets than 2: %o', dslink)
            }
            datasetNamesArray.reduce((prev, current) => {
              addDependencyToDataset(prev, current, datasetMap)
              return current
            })
          }
        })
    })
  },
})

export default filterCreator
