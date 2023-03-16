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
import { ElemID, ObjectType, BuiltinTypes, CORE_ANNOTATIONS, FieldDefinition, MapType, ListType, ActionName, createRestriction } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'

const { findDuplicates } = collections.array

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
  isSingle?: boolean
  context: RecurseIntoContext[]
  conditions?: RecurseIntoCondition[]
  skipOnError?: boolean
}

type BaseRequestConfig = {
  url: string
  queryParams?: Record<string, string>
}

export type FetchRequestConfig = BaseRequestConfig & {
  recursiveQueryByResponseField?: Record<string, string>
  dependsOn?: DependsOnConfig[]
  recurseInto?: RecurseIntoConfig[]
  paginationField?: string
}

export type UrlParams = Record<string, string>

export type DeployRequestConfig = BaseRequestConfig & {
  urlParamsToFields?: UrlParams
  deployAsField?: string
  method: 'post' | 'put' | 'delete' | 'patch'
  fieldsToIgnore?: string[]
}

export type DeploymentRequestsByAction<A extends string = ActionName> = Partial<Record<A, DeployRequestConfig>>

export type FetchRequestDefaultConfig = Partial<Omit<FetchRequestConfig, 'url'>>

export const createRequestConfigs = (
  adapter: string,
  additionalFields?: Record<string, FieldDefinition>,
  additionalActions?: string[],
): { fetch: { request: ObjectType; requestDefault: ObjectType }; deployRequests: ObjectType } => {
  const dependsOnFromConfig = new ObjectType({
    elemID: new ElemID(adapter, 'dependsOnFromConfig'),
    fields: {
      type: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      field: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  const dependsOnConfigType = createMatchingObjectType<DependsOnConfig>({
    elemID: new ElemID(adapter, 'dependsOnConfig'),
    fields: {
      pathParam: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      from: {
        refType: dependsOnFromConfig,
        annotations: {
          _required: true,
        },
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const recurseIntoContextType = createMatchingObjectType<RecurseIntoContext>({
    elemID: new ElemID(adapter, 'recurseIntoContext'),
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      fromField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  // either fromField or fromContext is required - not enforcing in nacl for now
  const recurseIntoConditionType = createMatchingObjectType<
    RecurseIntoConditionBase & Partial<RecurseIntoCondition
  >>({
    elemID: new ElemID(adapter, 'recurseIntoCondition'),
    fields: {
      match: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: {
          _required: true,
        },
      },
      fromField: {
        refType: BuiltinTypes.STRING,
      },
      fromContext: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })
  const recurseIntoConfigType = createMatchingObjectType<RecurseIntoConfig>({
    elemID: new ElemID(adapter, 'recurseIntoConfig'),
    fields: {
      toField: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      type: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      isSingle: {
        refType: BuiltinTypes.BOOLEAN,
      },
      context: {
        refType: new ListType(recurseIntoContextType),
        annotations: {
          _required: true,
        },
      },
      conditions: {
        refType: new ListType(recurseIntoConditionType),
      },
      skipOnError: {
        refType: BuiltinTypes.BOOLEAN,
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const sharedEndpointFields: Record<string, FieldDefinition> = {
    url: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    queryParams: {
      refType: new MapType(BuiltinTypes.STRING),
    },
  }


  const fetchEndpointFields: Record<string, FieldDefinition> = {
    recursiveQueryByResponseField: {
      refType: new MapType(BuiltinTypes.STRING),
    },
    paginationField: {
      refType: BuiltinTypes.STRING,
    },
    dependsOn: {
      refType: new ListType(dependsOnConfigType),
    },
    recurseInto: {
      refType: new ListType(recurseIntoConfigType),
    },
    ...sharedEndpointFields,
    ...additionalFields,
  }

  const fetchRequestConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'fetchRequestConfig'),
    fields: fetchEndpointFields,
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const fetchRequestDefaultConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'fetchRequestDefaultConfig'),
    fields: _.omit(fetchEndpointFields, ['url']),
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })


  const deployRequestConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'deployRequestConfig'),
    fields: {
      ...sharedEndpointFields,
      method: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['get', 'post', 'put', 'delete', 'patch'] }),
        },
      },
      urlParamsToFields: {
        refType: new MapType(BuiltinTypes.STRING),
      },
      deployAsField: {
        refType: BuiltinTypes.STRING,
      },
      fieldsToIgnore: {
        refType: new ListType(BuiltinTypes.STRING),
      },
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  const additionalActionFields = Object.fromEntries(
    additionalActions?.map(actionName => [actionName, { refType: deployRequestConfigType }]) ?? []
  )
  const deployRequestsType = new ObjectType({
    elemID: new ElemID(adapter, 'deployRequests'),
    fields: {
      add: {
        refType: deployRequestConfigType,
      },
      modify: {
        refType: deployRequestConfigType,
      },
      remove: {
        refType: deployRequestConfigType,
      },
      ...additionalActionFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

  return {
    fetch: {
      request: fetchRequestConfigType,
      requestDefault: fetchRequestDefaultConfigType,
    },
    deployRequests: deployRequestsType,
  }
}

const findUnresolvedArgs = (url: string, dependsOnArgs: Set<string>): string[] => {
  const urlParams = url.match(ARG_PLACEHOLDER_MATCHER)?.map(m => m.slice(1, -1)) ?? []
  return urlParams.filter(p => !dependsOnArgs.has(p))
}

export const validateRequestConfig = (
  configPath: string,
  requestDefaultConfig: FetchRequestDefaultConfig | undefined,
  requestConfigMap: Record<string, FetchRequestConfig>
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
