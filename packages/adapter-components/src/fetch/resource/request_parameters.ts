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
import _ from 'lodash'
import { Element, Values, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { resolvePath, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ClientGetWithPaginationParams } from '../../client'
import { FetchRequestConfig, UrlParams, DependsOnConfig } from '../../config/request' // TODO move and change format
import { replaceArgs, ARG_PLACEHOLDER_MATCHER } from '../request'

const { isDefined } = lowerdashValues
const log = logger(module)

const FIELD_PATH_DELIMITER = '.'

export type ComputeGetArgsFunc = (
  request: FetchRequestConfig,
  contextElements?: Record<string, Element[]>,
  requestContext?: Record<string, unknown>,
  reversedSupportedTypes?: Record<string, string[]>,
) => ClientGetWithPaginationParams[]

/**
 * Convert an endpoint's request details into get arguments.
 * Supports recursive queries (subsequent queries to the same endpoint based on response data).
 */
export const simpleGetArgs: ComputeGetArgsFunc = (
  {
    url,
    queryParams,
    // TODO deprecate once old config is gone, and replace with recurseInto
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

const getContextInstances = (
  referenceDetails: DependsOnConfig,
  contextElements: Record<string, Element[]>,
  reversedSupportedTypes?: Record<string, string[]>,
): InstanceElement[] => {
  const fromType = referenceDetails.from.type
  const itemTypes = reversedSupportedTypes?.[fromType]
  return (contextElements[fromType] ?? [])
    .filter(isInstanceElement)
    // The relevant context instances are of the types correspond to the page type in SupportedTypes,
    // fallback to all instances if the mapping is missing from SupportedTypess
    .filter(instance => (itemTypes !== undefined ? itemTypes.includes(instance.elemID.typeName) : true))
}

export class MissingContextError extends Error {}

/**
 * Compute the cartesian product of all the potential arg values that are relevant for the output args.
 * Assumes possibleArgs are unique.
 *
 * @param possibleArgs A mapping from each arg to its possible choices
 * @param outputArgs The args in play
 */
export const computeArgCombinations = (
  possibleArgs: Record<string, unknown[]>, // assuming possibleArgs are unique
  outputArgs?: string[],
): Record<string, unknown>[] => {
  // since we are creating a cartesian product, we should focus on the required args
  // in order to avoid getting unnecessarily-large combination sets
  const potentialArgsByName = Object.entries(outputArgs !== undefined ? _.pick(possibleArgs, outputArgs) : possibleArgs)
    .map(([argName, argValues]) => argValues.map(val => ({ [argName]: val })))

  if (potentialArgsByName.length === 0) {
    return [{}]
  }
  return potentialArgsByName.reduce((acc, argChoices) => acc.flatMap(
    combo => argChoices.map(arg => ({ ...combo, ...arg }))
  ))
}

const computeDependsOnURLs = (
  {
    url,
    dependsOn,
  }: FetchRequestConfig,
  contextElements?: Record<string, Element[]>,
  reversedSupportedTypes?: Record<string, string[]>,
): string[] => {
  if (!url.includes('{')) {
    return [url]
  }
  const urlParams = url.match(ARG_PLACEHOLDER_MATCHER)
  if (urlParams === null) {
    throw new Error(`invalid endpoint definition ${url}`)
  }

  if (contextElements === undefined || dependsOn === undefined || _.isEmpty(dependsOn)) {
    throw new MissingContextError(`cannot resolve endpoint ${url} - missing context`)
  }

  const potentialParamsByArg = urlParams.map(urlParam => {
    const argName = urlParam.slice(1, -1)
    const referenceDetails = dependsOn.find(({ pathParam }) => pathParam === argName)
    if (referenceDetails === undefined) {
      log.error('could not resolve path param %s in url %s with dependsOn config %s', argName, url, safeJsonStringify(dependsOn))
      throw new Error(`could not resolve path param ${argName} in url ${url}`)
    }
    const contextInstances = getContextInstances(referenceDetails, contextElements, reversedSupportedTypes)
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

  return allArgCombinations.map(p => replaceArgs(url, p))
}

export const createUrl = ({
  instance, baseUrl, urlParamsToFields, additionalUrlVars,
}: {
  instance: InstanceElement
  baseUrl: string
  urlParamsToFields?: UrlParams
  additionalUrlVars?: Record<string, string>
}): string => replaceArgs(
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
  requestContext,
  reversedSupportedTypes,
) => {
  // Replace known url params
  const baseUrl = requestContext !== undefined
    ? replaceArgs(args.url, requestContext)
    : args.url

  const urls = computeDependsOnURLs(
    { url: baseUrl, dependsOn: args.dependsOn },
    contextElements,
    reversedSupportedTypes,
  )
  return urls.flatMap(url => simpleGetArgs({ ...args, url }, contextElements))
}
