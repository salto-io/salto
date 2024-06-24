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
import {
  Change,
  InstanceElement,
  getChangeData,
  isServiceId,
  Values,
  isEqualValues,
  isModificationChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { elementExpressionStringifyReplacer, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, promises, values as lowerdashValues } from '@salto-io/lowerdash'
import { ResponseValue, Response, ClientDataParams, executeWithPolling } from '../../client'
import { ApiDefinitions, DefQuery, queryWithDefault } from '../../definitions'
import { APIDefinitionsOptions, DeployHTTPEndpointDetails } from '../../definitions/system'
import {
  DeployRequestDefinition,
  DeployRequestEndpointDefinition,
  ChangeAndContext,
  InstanceDeployApiDefinitions,
} from '../../definitions/system/deploy'
import { createValueTransformer } from '../../fetch/utils'
import { replaceAllArgs } from '../../fetch/request/utils'
import { TransformDefinition } from '../../definitions/system/shared'
import { DeployRequestCondition, DeployableRequestDefinition } from '../../definitions/system/deploy/deploy'
import { DeployChangeInput } from '../../definitions/system/deploy/types'
import { ChangeElementResolver } from '../../resolve_utils'
import { ResolveAdditionalActionType, ResolveClientOptionsType } from '../../definitions/system/api'
import { recursiveNaclCase } from '../../fetch/element/instance_utils'

const log = logger(module)
const { awu } = collections.asynciterable

export type DeployRequester<AdditionalAction extends string> = {
  requestAllForChangeAndAction: (args: DeployChangeInput<AdditionalAction>) => Promise<void>
}

type ItemExtractor = (
  args: ChangeAndContext & {
    value: Values
    additionalContext?: Record<string, unknown>
  },
) => unknown

const createExtractor = (transformationDef?: TransformDefinition<ChangeAndContext>): ItemExtractor => {
  // default single to true for deploy if not explicitly specified
  const transform = createValueTransformer(_.defaults({}, transformationDef, { single: true }))
  return ({ value, ...args }) => {
    const res = transform({
      value,
      typeName: getChangeData(args.change).elemID.typeName,
      context: { ...args },
    })
    if (Array.isArray(res)) {
      return res.map(item => item.value)
    }
    return res?.value
  }
}

const createCheck = (conditionDef?: DeployRequestCondition): ((args: ChangeAndContext) => boolean) => {
  const { custom, transformForCheck, skipIfIdentical } = conditionDef ?? {}
  if (custom !== undefined) {
    return custom({ skipIfIdentical, transformForCheck })
  }
  if (skipIfIdentical === false) {
    return () => true
  }
  // note: no need to add a default for the value of single,
  // since the comparison will return the same value when working with two arrays vs two individual items
  const transform = createValueTransformer(transformForCheck)
  return args => {
    const { change } = args
    if (!isModificationChange(change)) {
      return true
    }
    const { typeName } = change.data.after.elemID
    return !isEqualValues(
      transform({ value: change.data.before.value, typeName, context: args }),
      transform({ value: change.data.after.value, typeName, context: args }),
    )
  }
}

const extractDataToApply = ({
  definition,
  changeAndContext,
  response,
}: {
  definition: TransformDefinition<ChangeAndContext, Values>
  changeAndContext: ChangeAndContext
  response: Response<ResponseValue | ResponseValue[]>
}): Values | undefined => {
  const { change } = changeAndContext
  const { elemID } = getChangeData(change)
  const extractor = createValueTransformer(definition)
  const dataToApply = collections.array.makeArray(
    extractor({
      value: response.data,
      typeName: getChangeData(change).elemID.typeName,
      context: changeAndContext,
    }),
  )[0]?.value
  if (!lowerdashValues.isPlainObject(dataToApply)) {
    log.warn(
      'extracted response for change %s is not a plain object, cannot apply. received value: %s',
      elemID.getFullName(),
      safeJsonStringify(dataToApply, elementExpressionStringifyReplacer),
    )
    return undefined
  }
  return dataToApply
}

const extractResponseDataToApply = async <ClientOptions extends string>({
  requestDef,
  response,
  ...changeAndContext
}: {
  requestDef: DeployableRequestDefinition<ClientOptions>
  response: Response<ResponseValue | ResponseValue[]>
} & ChangeAndContext): Promise<Values | undefined> => {
  const { copyFromResponse } = requestDef
  const dataToApply = {}
  if (copyFromResponse?.additional !== undefined) {
    _.assign(
      dataToApply,
      extractDataToApply({
        definition: copyFromResponse.additional,
        changeAndContext,
        response,
      }),
    )
  }
  if (copyFromResponse?.updateServiceIDs !== false) {
    const type = await getChangeData(changeAndContext.change).getType()
    const serviceIDFieldNames = Object.keys(
      _.pickBy(
        await promises.object.mapValuesAsync(type.fields, async f => isServiceId(await f.getType())),
        val => val,
      ),
    )
    if (serviceIDFieldNames.length > 0) {
      _.assign(
        dataToApply,
        extractDataToApply({
          definition: {
            pick: serviceIDFieldNames,
            // reverse the transformation used for the request
            root: requestDef.request.transformation?.nestUnderField,
          },
          changeAndContext,
          response,
        }),
      )
    }
  }

  return dataToApply
}

const extractExtraContextToApply = <ClientOptions extends string>({
  requestDef,
  response,
  ...changeAndContext
}: {
  requestDef: DeployableRequestDefinition<ClientOptions>
  response: Response<ResponseValue | ResponseValue[]>
} & ChangeAndContext): Values | undefined => {
  const { toSharedContext } = requestDef.copyFromResponse ?? {}
  if (toSharedContext !== undefined) {
    const dataToApply = extractDataToApply({
      definition: toSharedContext,
      changeAndContext,
      response,
    })
    if (toSharedContext.nestUnderElemID !== false) {
      return {
        [getChangeData(changeAndContext.change).elemID.getFullName()]: dataToApply,
      }
    }
    return dataToApply
  }
  return undefined
}

const throwOnUnresolvedReferences = (value: unknown): void =>
  _.cloneDeepWith(value, (val, key) => {
    if (isReferenceExpression(val)) {
      throw new Error(`found unresolved reference expression in ${key}`)
    }
  })

export const getRequester = <TOptions extends APIDefinitionsOptions>({
  clients,
  deployDefQuery,
  changeResolver,
}: {
  clients: ApiDefinitions<TOptions>['clients']
  deployDefQuery: DefQuery<
    InstanceDeployApiDefinitions<ResolveAdditionalActionType<TOptions>, ResolveClientOptionsType<TOptions>>
  >
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
}): DeployRequester<ResolveAdditionalActionType<TOptions>> => {
  const clientDefs = _.mapValues(clients.options, ({ endpoints, ...def }) => ({
    endpoints: queryWithDefault(endpoints),
    ...def,
  }))

  const getMergedRequestDefinition = (
    requestDef: DeployRequestEndpointDefinition<ResolveClientOptionsType<TOptions>>,
  ): {
    merged: DeployRequestDefinition<ResolveClientOptionsType<TOptions>> & { endpoint: DeployHTTPEndpointDetails }
    clientName: ResolveClientOptionsType<TOptions>
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

  const singleRequest = async ({
    requestDef,
    change,
    ...changeContext
  }: ChangeAndContext & {
    requestDef: DeployRequestEndpointDefinition<ResolveClientOptionsType<TOptions>>
  }): Promise<Response<ResponseValue | ResponseValue[]>> => {
    const { merged: mergedRequestDef, clientName } = getMergedRequestDefinition(requestDef)
    const mergedEndpointDef = mergedRequestDef.endpoint

    const extractor = createExtractor(mergedRequestDef.transformation)

    const { elemID, value } = getChangeData(change)

    const resolvedChange = await changeResolver(change)
    const contextFunc =
      mergedRequestDef.context?.custom !== undefined
        ? mergedRequestDef.context.custom(mergedRequestDef.context)
        : () => undefined
    const additionalContext = replaceAllArgs({
      context: _.merge({}, getChangeData(resolvedChange).value, getChangeData(resolvedChange).annotations),
      value: _.merge(
        contextFunc({ change, ...changeContext }),
        _.omit(mergedRequestDef.context, ['change', 'changeGroup', 'elementSource', 'sharedContext', 'custom']),
      ),
    })

    const data = mergedEndpointDef.omitBody
      ? undefined
      : extractor({
          change,
          ...changeContext,
          additionalContext,
          value: recursiveNaclCase(getChangeData(resolvedChange).value, true),
        })

    throwOnUnresolvedReferences(data)

    const callArgs = {
      queryParams:
        mergedEndpointDef.queryArgs !== undefined
          ? replaceAllArgs({
              value: mergedEndpointDef.queryArgs,
              context: _.merge({}, value, additionalContext),
            })
          : undefined,
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
      context: _.merge({}, value, additionalContext),
      throwOnUnresolvedArgs: true,
    })
    const client = clientDefs[clientName].httpClient
    const additionalValidStatuses = mergedEndpointDef.additionalValidStatuses ?? []
    const { polling } = mergedEndpointDef

    const singleClientCall = async (args: ClientDataParams): Promise<Response<ResponseValue | ResponseValue[]>> => {
      try {
        return await client[finalEndpointIdentifier.method ?? 'get'](args)
      } catch (e) {
        const status = e.response?.status
        if (additionalValidStatuses.includes(status)) {
          log.debug(
            'Suppressing %d error %o, for path %s in method %s',
            status,
            e,
            finalEndpointIdentifier.path,
            finalEndpointIdentifier.method,
          )
          return { data: {}, status }
        }
        throw e
      }
    }

    const updatedArgs: ClientDataParams = {
      url: finalEndpointIdentifier.path,
      ...callArgs,
    }
    const result = polling
      ? await executeWithPolling<ClientDataParams>(updatedArgs, polling, singleClientCall)
      : await singleClientCall(updatedArgs)
    return result
  }

  const requestAllForChangeAndAction: DeployRequester<
    ResolveAdditionalActionType<TOptions>
  >['requestAllForChangeAndAction'] = async args => {
    const { change, changeGroup, action, sharedContext } = args
    const { elemID } = getChangeData(change)
    log.debug('requestAllForChange change %s action %s group %s', elemID.getFullName(), action, changeGroup.groupID)
    const deployDef = deployDefQuery.query(elemID.typeName)
    if (deployDef === undefined) {
      throw new Error(`Could not find requests for change ${elemID.getFullName()} action ${action}`)
    }

    const { requestsByAction } = deployDef

    const requests = queryWithDefault(requestsByAction).query(action)
    if (requests === undefined) {
      throw new Error(`Could not find requests for change ${elemID.getFullName()} action ${action}`)
    }

    await awu(collections.array.makeArray(requests)).some(async def => {
      const { request, condition } = def
      if (request.earlySuccess === undefined && request.endpoint === undefined) {
        // should not happen
        throw new Error(`Invalid request for change ${elemID.getFullName()} action ${action}`)
      }
      const checkFunc = createCheck(condition)
      if (!checkFunc(args)) {
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
        log.trace('earlySuccess reached for change %s action %s', elemID.getFullName(), action)
        return true
      }

      const res = await singleRequest({ ...args, requestDef: request })
      try {
        const dataToApply = await extractResponseDataToApply({ ...args, requestDef: def, response: res })
        if (dataToApply !== undefined) {
          log.trace(
            'applying the following value to change %s: %s',
            elemID.getFullName(),
            safeJsonStringify(dataToApply, elementExpressionStringifyReplacer),
          )
          _.assign(getChangeData(change).value, dataToApply)
        }
        const extraContextToApply = extractExtraContextToApply({ ...args, requestDef: def, response: res })
        if (extraContextToApply !== undefined) {
          log.trace(
            'applying the following value to extra context in group %s from change %s: %s',
            changeGroup.groupID,
            elemID.getFullName(),
            safeJsonStringify(extraContextToApply, elementExpressionStringifyReplacer),
          )
          _.assign(sharedContext, extraContextToApply)
        }
      } catch (e) {
        log.error('failed to apply request result: %s (stack: %s)', e, e.stack)
        throw new Error(`failed to update change ${elemID.getFullName()} action ${action} from response: ${e}`)
      }
      return false
    })
  }

  return { requestAllForChangeAndAction }
}
