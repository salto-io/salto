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
import { Change, InstanceElement, getChangeData, ActionName, isServiceId, Values, isEqualValues, isModificationChange } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, promises } from '@salto-io/lowerdash'
import { ResponseValue, Response } from '../../client'
import { ApiDefinitions, DefQuery, queryWithDefault } from '../../definitions'
import { DeployHTTPEndpointDetails } from '../../definitions/system'
import {
  DeployRequestDefinition,
  DeployRequestEndpointDefinition,
  ChangeAndContext,
  InstanceDeployApiDefinitions,
} from '../../definitions/system/deploy'
import { createValueTransformer } from '../../fetch/utils'
import { replaceAllArgs } from '../../fetch/request/utils'
import { TransformDefinition } from '../../definitions/system/shared'
import { DeployRequestCondition } from '../../definitions/system/deploy/deploy'
import { DeployChangeInput } from '../../definitions/system/deploy/types'
import { ChangeElementResolver } from '../../resolve_utils'

const log = logger(module)
const { awu } = collections.asynciterable

export const toDefaultActionNames = <AdditionalAction extends string = never>({ change }: ChangeAndContext): (AdditionalAction | ActionName)[] =>
  [change.action]

export type DeployRequester<AdditionalAction extends string> = {
  requestAllForChangeAndAction: (args: DeployChangeInput<AdditionalAction>) => Promise<void>
}

type ItemExtractor = (args: ChangeAndContext & { value: Values }) => unknown

const createExtractor = (transformationDef?: TransformDefinition<ChangeAndContext>): ItemExtractor => {
  const transform = createValueTransformer(transformationDef)
  return ({ value, ...args }) =>
    collections.array.makeArray(
      transform({
        value,
        typeName: getChangeData(args.change).elemID.typeName,
        context: { ...args },
      }),
    )[0]?.value
}

const createCheck = (conditionDef?: DeployRequestCondition): (args: ChangeAndContext) => boolean => {
  const { custom, transformForCheck, skipIfIdentical } = conditionDef ?? {}
  if (custom !== undefined) {
    return custom({ skipIfIdentical, transformForCheck})
  }
  if (!skipIfIdentical) {
    return () => true
  }
  const transform = createValueTransformer(transformForCheck)
  return args => {
    const { change } = args
    if (!isModificationChange(change)) {
      return true
    }
    const { typeName } = change.data.after.elemID
    return isEqualValues(
      transform({ value: change.data.before, typeName, context: args }),
      transform({ value: change.data.after, typeName, context: args }),
    )
  }
}

export const getRequester = <
  AdditionalAction extends string,
  PaginationOptions extends string | 'none',
  ClientOptions extends string,
>({
  clients,
  deployDefQuery,
  changeResolver,
}: {
  clients: ApiDefinitions<ClientOptions, PaginationOptions, AdditionalAction>['clients']
  deployDefQuery: DefQuery<InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>>
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
}): DeployRequester<AdditionalAction> => {
  const clientDefs = _.mapValues(clients.options, ({ endpoints, ...def }) => ({
    endpoints: queryWithDefault(endpoints),
    ...def,
  }))

  const getMergedRequestDefinition = (
    requestDef: DeployRequestEndpointDefinition<ClientOptions>,
  ): {
    merged: DeployRequestDefinition<ClientOptions> & { endpoint: DeployHTTPEndpointDetails }
    clientName: ClientOptions
  } => {
    const { endpoint: requestEndpoint } = requestDef
    const clientName = requestEndpoint.client ?? clients.default
    const clientDef = clientDefs[clientName]
    const endpointDef = clientDef.endpoints.query(requestEndpoint.path)?.[requestEndpoint.method ?? 'get']
    return {
      merged: {
        ...requestDef,
        endpoint: _.merge({}, endpointDef, requestDef.endpoint),
      },
      clientName,
    }
  }

  const singleRequest = async ({ requestDef, change, changeGroup, elementSource }: ChangeAndContext & {
    requestDef: DeployRequestEndpointDefinition<ClientOptions>
  }): Promise<Response<ResponseValue | ResponseValue[]>> => {
    const { merged: mergedRequestDef, clientName } = getMergedRequestDefinition(requestDef)
    const mergedEndpointDef = mergedRequestDef.endpoint

    const extractor = createExtractor(mergedRequestDef.transformation)

    // TODON make sure no unresolved references at this point
    const { elemID, value } = getChangeData(change)

    const resolvedChange = await changeResolver(change)

    const extractedBody = mergedEndpointDef.omitBody
      ? undefined
      : extractor({
          change,
          changeGroup,
          elementSource,
          value: getChangeData(resolvedChange).value,
        })
    const data = Array.isArray(extractedBody) ? extractedBody[0] : extractedBody
    const callArgs = {
      queryParams: mergedEndpointDef.queryArgs,
      headers: mergedEndpointDef.headers,
      data,
    }

    log.trace(
      'making request for change %s client %s endpoint %s.%s',
      elemID.getFullName(),
      clientName,
      mergedRequestDef.endpoint.path,
      mergedRequestDef.endpoint.method,
    )

    const finalEndpointIdentifier = replaceAllArgs({
      value: mergedEndpointDef,
      context: value,
      throwOnUnresolvedArgs: true,
    })

    const client = clientDefs[clientName].httpClient

    return client[finalEndpointIdentifier.method ?? 'get']({
      url: finalEndpointIdentifier.path,
      ...callArgs,
    })
  }

  const requestAllForChangeAndAction: DeployRequester<AdditionalAction>['requestAllForChangeAndAction'] = async args => {
    const { change, changeGroup, action } = args
    const { elemID } = getChangeData(change)
    log.debug('requestAllForChange change %s action %s group %s', elemID.getFullName(), action, changeGroup.groupID)
    const deployDef = deployDefQuery.query(elemID.typeName)
    if (deployDef === undefined) {
      throw new Error(`could not find requests for change ${elemID.getFullName()} action ${action}`)
    }

    const { requestsByAction } = deployDef

    const requests = queryWithDefault(requestsByAction).query(action)
    if (requests === undefined) {
      throw new Error(`could not find requests for change ${elemID.getFullName()} action ${action}`)
    }

    await awu(collections.array.makeArray(requests)).some(async def => {
      const { request, condition, copyFromResponse } = def
      const checkFunc = createCheck(condition)
      if (condition !== undefined && !checkFunc(args)) {
        if (!request.earlySuccess) {
          const { client, path, method } = request.endpoint
          log.trace(
            'skipping call s.%s(%s) for change %s action %s because the condition was not met',
            client,
            path,
            method,
            elemID.getFullName(),
            action,
          )
        }
        return false
      }
      if (request.earlySuccess) {
        // if earlySuccess is defined, we will not continue to the next request
        log.trace(
          'earlySuccess reached for change %s action %s',
          elemID.getFullName(),
          action,
        )
        return false
      }

      // TODON better error handling
      const res = await singleRequest({ ...args, requestDef: request })
      // apply relevant parts of the result back to change
      const extractionDef = _.omit(copyFromResponse, 'updateServiceIDs')
      if (copyFromResponse?.updateServiceIDs !== false) {
        const type = await getChangeData(change).getType()
        const serviceIDFieldNames = Object.keys(
          _.pickBy(
            await promises.object.mapValuesAsync(type.fields, async f => isServiceId(await f.getType())),
            val => val,
          ),
        )
        if (serviceIDFieldNames.length > 0) {
          extractionDef.pick = _.concat(extractionDef.pick ?? [], serviceIDFieldNames)
        }
      }
      const extractor = createValueTransformer(extractionDef)
      const dataToApply = collections.array.makeArray(
        extractor({
          value: res.data,
          typeName: elemID.typeName,
          context: args,
        }),
      )[0]?.value
      if (Array.isArray(dataToApply)) {
        log.warn('extracted response for change %s is not a single value, cannot apply', elemID.getFullName())
      } else if (dataToApply !== undefined) {
        log.debug(
          'applying the following value to change %s: %s',
          elemID.getFullName(),
          safeJsonStringify(dataToApply),
        )
        _.assign(getChangeData(change).value, dataToApply)
      }
    })
  }

  return { requestAllForChangeAndAction }
}
