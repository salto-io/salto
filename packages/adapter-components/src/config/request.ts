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
import {
  ElemID, ObjectType, BuiltinTypes, CORE_ANNOTATIONS, FieldDefinition, MapType, ListType,
} from '@salto-io/adapter-api'
import { findDuplicates } from './validation_utils'

export const ARG_PLACEHOLDER_MATCHER = /\{([\w_]+)\}/g

export type DependsOnConfig = {
  pathParam: string
  from: {
    type: string
    field: string
  }
}

type RecurseIntoConditionBase = { match: string[] }
type RecurseIntoConditionByField = RecurseIntoConditionBase & {
  fromField: string
}
type RecurseIntoConditionByContext = RecurseIntoConditionBase & {
  fromContext: string
}

export type RecurseIntoCondition = RecurseIntoConditionByField | RecurseIntoConditionByContext

export const isRecurseIntoConditionByField = (
  condition: RecurseIntoCondition
): condition is RecurseIntoConditionByField => (
  'fromField' in condition
)

type RecurseIntoContext = {
  name: string
  fromField: string
}

type RecurseIntoConfig = {
  toField: string
  type: string
  context: RecurseIntoContext[]
  conditions?: RecurseIntoCondition[]
}

export type RequestConfig = {
  url: string
  queryParams?: Record<string, string>
  recursiveQueryByResponseField?: Record<string, string>
  dependsOn?: DependsOnConfig[]
  recurseInto?: RecurseIntoConfig[]
  paginationField?: string
}

export type RequestDefaultConfig = Partial<Omit<RequestConfig, 'url'>>

export const createRequestConfigs = (
  adapter: string,
  additionalFields?: Record<string, FieldDefinition>,
): { request: ObjectType; requestDefault: ObjectType } => {
  const dependsOnFromConfig = new ObjectType({
    elemID: new ElemID(adapter, 'dependsOnFromConfig'),
    fields: {
      type: {
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      field: {
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })
  const dependsOnConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'dependsOnConfig'),
    fields: {
      pathParam: {
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      from: {
        type: dependsOnFromConfig,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

  const sharedEndpointFields: Record<string, FieldDefinition> = {
    queryParams: { type: new MapType(BuiltinTypes.STRING) },
    recursiveQueryByResponseField: { type: new MapType(BuiltinTypes.STRING) },
    paginationField: { type: BuiltinTypes.STRING },
    dependsOn: { type: new ListType(dependsOnConfigType) },
    ...additionalFields,
  }

  const requestConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'requestConfig'),
    fields: {
      url: {
        type: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      ...sharedEndpointFields,
    },
  })

  const requestDefaultConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'requestDefaultConfig'),
    fields: {
      ...sharedEndpointFields,
    },
  })

  return { request: requestConfigType, requestDefault: requestDefaultConfigType }
}

const findUnresolvedArgs = (url: string, dependsOnArgs: Set<string>): string[] => {
  const urlParams = url.match(ARG_PLACEHOLDER_MATCHER)?.map(m => m.slice(1, -1)) ?? []
  return urlParams.filter(p => !dependsOnArgs.has(p))
}

export const validateRequestConfig = (
  configPath: string,
  requestDefaultConfig: RequestDefaultConfig | undefined,
  requestConfigMap: Record<string, RequestConfig>
): void => {
  if (requestDefaultConfig?.dependsOn !== undefined) {
    const duplicates = findDuplicates(requestDefaultConfig.dependsOn.map(def => def.pathParam))
    if (duplicates.length > 0) {
      throw new Error(`Duplicate dependsOn params found in ${configPath} default config: ${duplicates}`)
    }
  }
  const defaultDependsOnArgs = (requestDefaultConfig?.dependsOn ?? []).map(d => d.pathParam)
  const typesWithErrors = (Object.entries(requestConfigMap)
    .filter(([_typeName, config]) => config.dependsOn !== undefined)
    .map(([typeName, config]) => ({
      typeName,
      dups: findDuplicates((config.dependsOn ?? []).map(def => def.pathParam)),
      unresolvedArgs: findUnresolvedArgs(
        config.url,
        new Set([...defaultDependsOnArgs, ...(config.dependsOn ?? []).map(d => d.pathParam)]),
      ),
    }))
    .filter(({ dups, unresolvedArgs }) => dups.length > 0 || unresolvedArgs.length > 0)
  )
  const dependsOnDups = typesWithErrors.filter(({ dups }) => dups.length > 0)
  if (dependsOnDups.length > 0) {
    throw new Error(`Duplicate dependsOn params found in ${configPath} for the following types: ${dependsOnDups.map(d => d.typeName)}`)
  }
  const typesWithUnresolvedArgs = typesWithErrors.filter(
    ({ unresolvedArgs }) => unresolvedArgs.length > 0
  )
  if (typesWithUnresolvedArgs.length > 0) {
    throw new Error(`Unresolved URL params in the following types in ${configPath} for the following types: ${typesWithUnresolvedArgs.map(d => d.typeName)}`)
  }
}
