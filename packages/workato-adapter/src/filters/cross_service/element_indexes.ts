/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import { Element, InstanceElement, isInstanceElement, ElemID } from '@salto-io/adapter-api'

export type SalesforceIndex = Record<string, Record<string, Readonly<Element>[]>>
export type NetsuiteIndex = Record<string, ElemID>

// salesforce indexes

const API_NAME = 'apiName'
export const METADATA_TYPE = 'metadataType'

const metadataType: (elem: Readonly<Element>) => string | undefined = elem => (
  elem.annotations[METADATA_TYPE]
)

const apiName: (elem: Readonly<Element>) => string | undefined = elem => (
  elem.annotations[API_NAME] ?? metadataType(elem)
)

export const indexSalesforceByMetadataTypeAndApiName = (
  salesforceElements: ReadonlyArray<Readonly<Element>>,
): SalesforceIndex => {
  // needed in order to handle element fragments in custom objects
  const elementsById = _.groupBy(salesforceElements, e => e.elemID.getFullName())

  const mapApiNameToElem = (elements: Readonly<Element>[]): Record<string, Readonly<Element>[]> => (
    _.mapValues(
      _.keyBy(
        elements.filter(e => apiName(e) !== undefined),
        elem => apiName(elem) as string,
      ),
      e => elementsById[e.elemID.getFullName()],
    )
  )

  const groupByMetadataTypeAndApiName = (
    elements: ReadonlyArray<Readonly<Element>>
  ): SalesforceIndex => (
    _.mapValues(
      _.groupBy(
        elements.filter(e => metadataType(e) !== undefined),
        metadataType
      ),
      mapApiNameToElem
    )
  )

  return groupByMetadataTypeAndApiName(salesforceElements)
}

// netsuite index

const CUSTOM_RECORD_TYPE = 'customrecordtype'
const CUSTOM_RECORD_CUSTOM_FIELDS = 'customrecordcustomfields'
const CUSTOM_RECORD_CUSTOM_FIELD = 'customrecordcustomfield'

export const indexNetsuiteByTypeAndScriptId = (
  elements: ReadonlyArray<Readonly<Element>>
): NetsuiteIndex => {
  const toScriptId = (inst: Readonly<InstanceElement>): string | undefined => inst.value.scriptid
  const instances = elements.filter(isInstanceElement)

  const elementIndex = _.mapValues(
    _.keyBy(
      instances.filter(e => toScriptId(e) !== undefined),
      e => toScriptId(e) as string,
    ),
    e => e.elemID,
  )

  const customRecordTypeInstances = instances.filter(
    inst => inst.elemID.typeName === CUSTOM_RECORD_TYPE
  )
  const nestedFields = (
    customRecordTypeInstances
      .flatMap(inst => (
        (inst.value[CUSTOM_RECORD_CUSTOM_FIELDS]?.[CUSTOM_RECORD_CUSTOM_FIELD] ?? [])
          .map((f: { scriptid: string }, idx: number) => ({
            scriptId: f.scriptid,
            nestedPath: inst.elemID.createNestedID(
              CUSTOM_RECORD_CUSTOM_FIELDS,
              CUSTOM_RECORD_CUSTOM_FIELD,
              String(idx),
            ),
          }))))
  )
  // TODO these should be replaced by maps or nested fields under custom objects - see SALTO-1078
  const customRecordTypeNestedFieldIndex = Object.fromEntries(
    nestedFields.map(f => [f.scriptId, f.nestedPath])
  )
  return {
    ...elementIndex,
    ...customRecordTypeNestedFieldIndex,
  }
}
