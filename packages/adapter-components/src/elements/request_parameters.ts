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
import _ from 'lodash'
import { Element, Values, isInstanceElement, isPrimitiveValue, InstanceElement } from '@salto-io/adapter-api'
import { resolvePath, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ClientGetWithPaginationParams } from '../client'
import { FetchRequestConfig, ARG_PLACEHOLDER_MATCHER, UrlParams } from '../config/request'

const { isDefined } = lowerdashValues
const log = logger(module)

const FIELD_PATH_DELIMITER = '.'

export type ComputeGetArgsFunc = (
  request: FetchRequestConfig,
  contextElements?: Record<string, Element[]>,
  requestContext?: Record<string, unknown>,
) => ClientGetWithPaginationParams[]

/**
 * Convert an endpoint's request details into get arguments.
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

export const replaceUrlParams = (url: string, paramValues: Record<string, unknown>): string => (
  url.replace(
    ARG_PLACEHOLDER_MATCHER,
    val => {
      const replacement = paramValues[val.slice(1, -1)] ?? val
      if (!isPrimitiveValue(replacement)) {
        throw new Error(`Cannot replace param ${val} in ${url} with non-primitive value ${replacement}`)
      }
      return replacement.toString()
    }
  )
)

const computeDependsOnURLs = (
  {
    url,
    dependsOn,
  }: FetchRequestConfig,
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

  const potentialParamsByArg = urlParams.map(urlParam => {
    const argName = urlParam.slice(1, -1)
    const referenceDetails = dependsOn.find(({ pathParam }) => pathParam === argName)
    if (referenceDetails === undefined) {
      log.error('could not resolve path param %s in url %s with dependsOn config %s', argName, url, safeJsonStringify(dependsOn))
      throw new Error(`could not resolve path param ${argName} in url ${url}`)
    }
    const contextInstances = (contextElements[referenceDetails.from.type] ?? []).filter(
      isInstanceElement
    )
    if (contextInstances.length === 0) {
      log.warn(`no instances found for ${referenceDetails.from.type}, cannot call endpoint ${url}`)
    }
    const potentialParams = contextInstances
      .map(e => e.value[referenceDetails.from.field])
      .filter(isDefined)
      .map(_.toString)
    return _.uniq(potentialParams).map(val => ({ [argName]: val }))
  })

  const allArgCombinations = potentialParamsByArg.reduce((acc, potentialParams) => acc.flatMap(
    combo => potentialParams.map(param => ({ ...combo, ...param }))
  ))

  return allArgCombinations.map(p => replaceUrlParams(url, p))
}

export const createUrl = ({
  instance, baseUrl, urlParamsToFields, additionalUrlVars,
}: {
  instance: InstanceElement
  baseUrl: string
  urlParamsToFields?: UrlParams
  additionalUrlVars?: Record<string, string>
}): string => replaceUrlParams(
  baseUrl,
  {
    ...instance.value,
    ..._.mapValues(
      urlParamsToFields ?? {},
      fieldName => resolvePath(
        instance,
        instance.elemID.createNestedID(...fieldName.split(FIELD_PATH_DELIMITER))
      )
    ),
    ...(additionalUrlVars ?? {}),
  }
)

export const computeGetArgs: ComputeGetArgsFunc = (
  args,
  contextElements,
  requestContext
) => {
  // Replace known url params
  const baseUrl = requestContext !== undefined
    ? replaceUrlParams(args.url, requestContext)
    : args.url

  const urls = computeDependsOnURLs(
    { url: baseUrl, dependsOn: args.dependsOn },
    contextElements,
  )
  return urls.flatMap(url => simpleGetArgs({ ...args, url }, contextElements))
}
