/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ActionName,
  Change,
  CORE_ANNOTATIONS,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, filter } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { AdapterFilterCreator, FilterCreator } from '../filter_utils'
import { createUrl } from '../fetch/resource'
import { ApiDefinitions, queryWithDefault } from '../definitions'
import { FetchApiDefinitionsOptions, InstanceFetchApiDefinitions } from '../definitions/system/fetch'
import { AdapterApiConfig, TransformationConfig, TypeConfig } from '../config_deprecated'

const log = logger(module)

export const configDefToInstanceFetchApiDefinitionsForServiceUrl = (
  configDef?: TypeConfig<TransformationConfig, ActionName>,
  baseUrl?: string,
): InstanceFetchApiDefinitions | undefined => {
  const serviceUrl = configDef?.transformation?.serviceUrl
  return serviceUrl !== undefined
    ? {
        element: {
          topLevel: {
            isTopLevel: true as const,
            serviceUrl: { path: serviceUrl, baseUrl },
          },
        },
      }
    : undefined
}

export const addUrlToInstance: <Options extends FetchApiDefinitionsOptions = {}>(
  instance: InstanceElement,
  apiDef: InstanceFetchApiDefinitions<Options> | undefined,
) => void = (instance, apiDef) => {
  const { path, baseUrl } = apiDef?.element?.topLevel?.serviceUrl ?? {}
  if (path === undefined) {
    return
  }
  if (baseUrl === undefined) {
    log.error('baseUrl is missing in serviceUrl definition for %s', instance.elemID.typeName)
    return
  }

  // parent is ReferenceExpression during fetch, and serialized into full value during deploy
  const parentValues = instance.annotations[CORE_ANNOTATIONS.PARENT]?.map((parent: unknown) =>
    isReferenceExpression(parent) ? parent.value.value : parent,
  )
  const parentContext = parentValues?.reduce((result: Values, parentVal: Values, idx: number) => {
    Object.entries(parentVal).forEach(([key, value]) => {
      _.set(result, `_parent.${idx}.${key}`, value)
    })
    return result
  }, {})
  const url = createUrl({ instance, url: path, additionalUrlVars: parentContext })
  instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, baseUrl).href
}

export const serviceUrlFilterCreator: <
  TContext,
  TResult extends void | filter.FilterResult = void,
  TAdditional = {},
  TOptions extends FetchApiDefinitionsOptions = {},
>() => AdapterFilterCreator<TContext, TResult, TAdditional, TOptions> =
  () =>
  ({ definitions }) => {
    if (definitions.fetch === undefined) {
      log.warn('No fetch definitions were found, skipping service url filter')
      return () => ({})
    }
    const { instances } = definitions.fetch
    const defQuery = queryWithDefault(instances)
    return {
      name: 'serviceUrlFilter',
      onFetch: async (elements: Element[]) => {
        elements.filter(isInstanceElement).forEach(instance => {
          addUrlToInstance(instance, defQuery.query(instance.elemID.typeName))
        })
      },
      onDeploy: async (changes: Change<InstanceElement>[]) => {
        const relevantChanges = changes.filter(isInstanceChange).filter(isAdditionChange)
        relevantChanges.map(getChangeData).forEach(instance => {
          addUrlToInstance(instance, defQuery.query(instance.elemID.typeName))
        })
      },
    }
  }
// TODO deprecate when upgrading to new definitions SALTO-5538
export const serviceUrlFilterCreatorDeprecated: <
  TClient,
  TContext extends { apiDefinitions: AdapterApiConfig },
  TResult extends void | filter.FilterResult = void,
>(
  baseUrl: string,
  additionalApiDefinitions?: AdapterApiConfig,
) => FilterCreator<TClient, TContext, TResult> = (baseUrl, additionalApiDefinitions) => args => {
  const { config } = args
  const customizations = _({ ...config.apiDefinitions.types, ...additionalApiDefinitions?.types })
    .mapValues(value => configDefToInstanceFetchApiDefinitionsForServiceUrl(value, baseUrl))
    .pickBy(lowerdashValues.isDefined)
    .value()

  // casting to "ApiDefinitions" is safe in this case because we use only fetch customizations for calculating serviceUrl
  const definitions = {
    fetch: {
      instances: {
        default: {
          element: {
            topLevel: {
              serviceUrl: { baseUrl },
            },
          },
        },
        customizations,
      },
    },
  } as ApiDefinitions
  return serviceUrlFilterCreator()({
    ...args,
    definitions,
    elementSource: buildElementsSourceFromElements([]),
    sharedContext: {},
  })
}
