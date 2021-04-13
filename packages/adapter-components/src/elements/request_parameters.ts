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
import { Element, Values, isInstanceElement } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { ClientGetWithPaginationParams } from '../client'
import { RequestConfig, ARG_PLACEHOLDER_MATCHER } from '../config/request'

const log = logger(module)

export type ComputeGetArgsFunc = (
  request: RequestConfig,
  contextElements?: Record<string, Element[]>,
) => ClientGetWithPaginationParams[]

/**
 * Convert an endpoint's request details into get argumets.
 * Supports recursive queries (subsequent queries to the same endpoint based on response data).
 */
export const simpleGetArgs: ComputeGetArgsFunc = (
  {
    url,
    queryParams,
    recursiveQueryByResponseField,
    paginationField,
  },
) => {
  const recursiveQueryParams = recursiveQueryByResponseField !== undefined
    ? _.mapValues(
      recursiveQueryByResponseField,
      val => ((entry: Values): string => entry[val])
    )
    : undefined
  return [{ url, queryParams, recursiveQueryParams, paginationField }]
}

const computeDependsOnURLs = (
  {
    url,
    dependsOn,
  }: RequestConfig,
  contextElements?: Record<string, Element[]>,
): string[] => {
  if (!url.includes('{')) {
    return [url]
  }
  const urlParams = url.match(ARG_PLACEHOLDER_MATCHER)
  if (urlParams === null) {
    throw new Error(`invalid endpoint definition ${url}`)
  }

  if (contextElements === undefined || dependsOn === undefined || _.isEmpty(dependsOn)) {
    throw new Error(`cannot resolve endpoint ${url} - missing context`)
  }

  if (urlParams.length > 1) {
    // not needed yet (when it is, we will need to decide which combinations to use)
    throw new Error(`too many variables in endpoint ${url}`)
  }
  const argName = urlParams[0].slice(1, -1)
  const referenceDetails = dependsOn.find(({ pathParam }) => pathParam === argName)
  if (referenceDetails === undefined) {
    log.error('could not resolve path param %s in url %s with dependsOn config %s', argName, url, safeJsonStringify(dependsOn))
    throw new Error(`could not resolve path param ${argName} in url ${url}`)
  }
  const contextInstances = (contextElements[referenceDetails.from.type] ?? []).filter(
    isInstanceElement
  )
  if (contextInstances.length === 0) {
    throw new Error(`no instances found for ${referenceDetails.from.type}, cannot call endpoint ${url}`)
  }
  const potentialParams = contextInstances.map(e => e.value[referenceDetails.from.field])
  return potentialParams.map(p => url.replace(ARG_PLACEHOLDER_MATCHER, p))
}

export const computeGetArgs: ComputeGetArgsFunc = (
  args,
  contextElements,
) => {
  const urls = computeDependsOnURLs(args, contextElements)
  return urls.flatMap(url => simpleGetArgs({ ...args, url }, contextElements))
}
