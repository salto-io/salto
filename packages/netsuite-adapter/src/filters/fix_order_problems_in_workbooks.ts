/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { XMLParser } from 'fast-xml-parser'
import he from 'he'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  Values,
} from '@salto-io/adapter-api'
import { TransformFunc, resolvePath, transformValuesSync } from '@salto-io/adapter-utils'
import { DATASET, SCRIPT_ID, WORKBOOK } from '../constants'
import { LocalFilterCreator } from '../filter'
import { DATASET_LINK, DATASET_LINKS, DATASETS, ROOT } from '../type_parsers/analytics_parsers/analytics_constants'
import { addAdditionalDependency, XML_PARSER_DEFAULT_OPTIONS } from '../client/utils'

const log = logger(module)
const { awu } = collections.asynciterable

const isStringArray = (val: unknown): val is string[] => Array.isArray(val) && _.every(val, _.isString)

const isXmlContent = (val: unknown): val is string => _.isString(val) && val.startsWith(`<${ROOT}>`)

const xmlParser = new XMLParser({
  ...XML_PARSER_DEFAULT_OPTIONS,
  tagValueProcessor: (_name, val) => he.decode(val),
})

const isSameXmlValues = (xml1: string, xml2: string): boolean => _.isEqual(xmlParser.parse(xml1), xmlParser.parse(xml2))

const discardIrrelevantChanges = (
  existingInstance: InstanceElement | undefined,
  newInstance: InstanceElement,
): void => {
  const transformFunc: TransformFunc = ({ value, path }) => {
    if (path === undefined) {
      return value
    }
    if (path.name === DATASETS && isStringArray(value)) {
      return value.sort()
    }
    if (!isInstanceElement(existingInstance) || !isXmlContent(value)) {
      return value
    }
    const existingValue = resolvePath(existingInstance, path)
    if (isXmlContent(existingValue) && isSameXmlValues(value, existingValue)) {
      return existingValue
    }
    return value
  }

  newInstance.value = transformValuesSync({
    values: newInstance.value,
    type: newInstance.getTypeSync(),
    strict: false,
    pathID: newInstance.elemID,
    transformFunc,
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
  Array.isArray(workbook.value[DATASET_LINKS])
    ? workbook.value[DATASET_LINKS].filter(values.isPlainRecord)
        .map((obj: Values) => obj[DATASET_LINK])
        .filter(values.isPlainObject)
    : []

const filterCreator: LocalFilterCreator = ({ elementsSource }) => ({
  name: 'fixOrderProblemsInWorkbooks',
  onFetch: async elements => {
    await awu(elements)
      .filter(elem => elem.elemID.typeName === WORKBOOK)
      .filter(isInstanceElement)
      .forEach(async instance => {
        discardIrrelevantChanges(await elementsSource.get(instance.elemID), instance)
      })
  },
  preDeploy: async (changes: Change[]) => {
    const changedDatasets = changes
      .filter(isAdditionOrModificationChange)
      .filter(change => change.data.after.elemID.typeName === DATASET)
      .map(getChangeData)
      .filter(isInstanceElement)

    const datasetMap = new Map<string, InstanceElement>(
      changedDatasets.map(dataset => [dataset.value[SCRIPT_ID], dataset]),
    )

    const workbooks = changes
      .filter(isAdditionOrModificationChange)
      .filter(change => change.data.after.elemID.typeName === WORKBOOK)
      .map(getChangeData)
      .filter(isInstanceElement)

    workbooks.forEach(workbook => {
      getDatasetLinkList(workbook).forEach(dslink => {
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
