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
import { collections, values as lowerfashValues } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ClientGetParams } from './types'
import { APIConnection } from './http_connection'
import { safeJsonStringify } from '../utils'

const { isDefined } = lowerfashValues
const { makeArray } = collections.array
const log = logger(module)

export type GetAllItemsFunc = ({
  client,
  pageSize,
  getParams,
}: {
  client: APIConnection
  pageSize: number
  getParams: ClientGetParams
}) => Promise<Values[]>

export const getWithOffsetPagination: GetAllItemsFunc = async ({ client, pageSize, getParams }) => {
  const { endpointName, paginationField, queryArgs, recursiveQueryArgs } = getParams
  const requestQueryArgs: Record<string, string>[] = [{}]
  const allResults = []
  const usedParams = new Set<string>()

  while (requestQueryArgs.length > 0) {
    const additionalArgs = requestQueryArgs.pop() as Record<string, string>
    const serializedArgs = safeJsonStringify(additionalArgs)
    if (usedParams.has(serializedArgs)) {
      // eslint-disable-next-line no-continue
      continue
    }
    usedParams.add(serializedArgs)
    const params = { ...queryArgs, ...additionalArgs }
    // eslint-disable-next-line no-await-in-loop
    const response = await client.get(
      endpointName,
      Object.keys(params).length > 0 ? { params } : undefined
    )
    // TODO remove?
    log.debug(`Full HTTP response for ${endpointName} ${safeJsonStringify(params)}: ${safeJsonStringify(response.data)}`)

    const results: Values[] = (
      // TODO is items a generic-enough field?
      (_.isObjectLike(response.data) && Array.isArray(response.data.items))
        ? response.data.items
        : makeArray(response.data)
    )

    allResults.push(...results)

    if (paginationField !== undefined && results.length >= pageSize) {
      requestQueryArgs.unshift({
        ...additionalArgs,
        [paginationField]: (additionalArgs[paginationField] ?? 1) + 1,
      })
    }

    if (recursiveQueryArgs !== undefined && Object.keys(recursiveQueryArgs).length > 0) {
      const newArgs = (results
        .map(res => _.pickBy(
          _.mapValues(
            recursiveQueryArgs,
            mapper => mapper(res),
          ),
          isDefined,
        ))
        .filter(args => Object.keys(args).length > 0)
      )
      requestQueryArgs.unshift(...newArgs)
    }
  }
  return allResults
}

export const getWithCursorPagination: GetAllItemsFunc = async ({ client, getParams }) => {
  const { endpointName, queryArgs, paginationField } = getParams
  const nextPageField = paginationField ?? 'nextPage'

  const entries = []
  let nextPageArgs: Values = {}
  while (true) {
    const params = {
      ...queryArgs,
      ...nextPageArgs,
    }
    // eslint-disable-next-line no-await-in-loop
    const response = await client.get(
      endpointName,
      {
        params,
      },
    )
    // TODO remove?
    log.info(`Full HTTP response for ${endpointName} ${safeJsonStringify(params)}: ${safeJsonStringify(response.data)}`)

    // TODO check if need the 2nd condition. the success field doesn't always exist
    if (response.status !== 200 || response.data.success === false) {
      // TODO extract better error
      log.error(`error getting result for ${endpointName}: %s %o %o`, response.status, response.statusText, response.data)
      break
    }
    entries.push(...makeArray(response.data))
    if (response.data[nextPageField] === undefined) {
      break
    }
    const nextPage = new URL(response.data[nextPageField], 'http://localhost')
    // TODO verify pathname is the same
    nextPageArgs = Object.fromEntries(nextPage.searchParams.entries())
  }
  log.info('Received %d results for endpoint %s', // TODO inaccurate when not extracting nested field
    entries.length, endpointName)
  return entries
}
