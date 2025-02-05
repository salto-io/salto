/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ActionName } from '@salto-io/adapter-api'
import { InstanceDeployApiDefinitions } from '../definitions/system/deploy'

export const DEFAULT_CONTEXT = {
  parent_id: '{_parent.0.id}',
}

type StandardDeployArgs<AdditionalAction extends string, ClientOptions extends string> = {
  bulkPath: string
  idField?: string
  modificationMethod?: 'put' | 'patch'
  // do not add definitions for some actions
  withoutActions?: (ActionName | AdditionalAction)[]
  client?: ClientOptions
  nestUnderField?: string
}

export const createStandardItemDeployDefinition = <AdditionalAction extends string, ClientOptions extends string>({
  client,
  bulkPath,
  withoutActions,
  nestUnderField,
  idField = 'id',
  modificationMethod = 'put',
}: StandardDeployArgs<AdditionalAction, ClientOptions>): InstanceDeployApiDefinitions<
  AdditionalAction,
  ClientOptions
> => {
  const standardCustomizationsByAction = {
    add: [
      {
        request: {
          endpoint: {
            path: bulkPath,
            method: 'post',
            client,
          },
        },
      },
    ],
    modify: [
      {
        request: {
          endpoint: {
            path: `${bulkPath}/{${idField}}`,
            method: modificationMethod,
            client,
          },
        },
      },
    ],
    remove: [
      {
        request: {
          endpoint: {
            path: `${bulkPath}/{${idField}}`,
            method: 'delete',
            client,
          },
        },
      },
    ],
  }
  return {
    requestsByAction: {
      default: {
        request: {
          transformation: {
            nestUnderField,
          },
        },
      },
      customizations: _.omit(standardCustomizationsByAction, withoutActions ?? []),
    },
  } as InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
}

/**
 * helper for creating one of the common REST patterns for a type -
 * - create: POST on <path>
 * - update: PUT (default) or PATCH on <path>/<:id_field>
 * - remove: DELETE on <path>/<:id_field>
 * and potentially nest the value under a specified field
 */
export const createStandardDeployDefinitions = <AdditionalAction extends string, ClientOptions extends string>(
  typeArgs: Record<string, StandardDeployArgs<AdditionalAction, ClientOptions>>,
): Record<string, InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>> =>
  _.mapValues(typeArgs, createStandardItemDeployDefinition)

/**
 * helper for creating a common REST pattern -
 * - create: POST on <base_path>/<typename>
 * - update: PUT (default) or PATCH on <base_path>/<typename>/<:id_field>
 * - remove: DELETE on <base_path>/<typename>/<:id_field>
 * with an option to specify nesting under the type field
 */
export const createStandardDeployDefinitionsByType = <AdditionalAction extends string, ClientOptions extends string>({
  typeArgs,
  basePath,
  nestUnderTypeField,
}: {
  typeArgs: Record<string, Omit<StandardDeployArgs<AdditionalAction, ClientOptions>, 'bulkPath'>>
  basePath: string
  nestUnderTypeField?: boolean
}): Record<string, InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>> =>
  _.mapValues(typeArgs, (args, typeName) =>
    createStandardItemDeployDefinition({
      ...args,
      bulkPath: `${basePath}/${typeName}`,
      ...(nestUnderTypeField ? { nestUnderField: typeName } : {}),
    }),
  )
