/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element } from '@salto-io/adapter-api'
import _ from 'lodash'

export type SalesforceIndex = Record<string, Record<string, Readonly<Element>[]>>

const API_NAME = 'apiName'
const METADATA_TYPE = 'metadataType'

const metadataType: (elem: Readonly<Element>) => string | undefined = elem => elem.annotations[METADATA_TYPE]

const apiName: (elem: Readonly<Element>) => string | undefined = elem =>
  elem.annotations[API_NAME] ?? metadataType(elem)

export const indexSalesforceByMetadataTypeAndApiName = (
  salesforceElements: ReadonlyArray<Readonly<Element>>,
): SalesforceIndex => {
  // needed in order to handle element fragments in custom objects
  const elementsById = _.groupBy(salesforceElements, e => e.elemID.getFullName())

  const mapApiNameToElem = (elements: Readonly<Element>[]): Record<string, Readonly<Element>[]> =>
    _.mapValues(
      _.keyBy(
        elements.filter(e => apiName(e) !== undefined),
        elem => apiName(elem) as string,
      ),
      e => elementsById[e.elemID.getFullName()],
    )

  const groupByMetadataTypeAndApiName = (elements: ReadonlyArray<Readonly<Element>>): SalesforceIndex =>
    _.mapValues(
      _.groupBy(
        elements.filter(e => metadataType(e) !== undefined),
        metadataType,
      ),
      mapApiNameToElem,
    )

  return groupByMetadataTypeAndApiName(salesforceElements)
}
