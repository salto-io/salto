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
import { InstanceElement } from '@salto-io/adapter-api'
import { openapi } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ZuoraApiConfig } from '../config'
import { ZUORA_BILLING, SETTINGS_TYPE_PREFIX } from '../constants'

const { isDefined } = lowerdashValues
const { generateTypes } = openapi

type OperationResponseType = openapi.SchemaOrReference & {
  definitions?: Record<string, openapi.SchemaObject>
}

type OperationInfo = {
  method: string
  url: string
  responseType: OperationResponseType
}

type SettingsInfoDef = {
  httpOperations: OperationInfo[]
}

const DEF_REF_PREFIX = '#/definitions/'

const toSchemasAndRefs = (defs: SettingsInfoDef[]): openapi.SchemasAndRefs => {
  const extractDetails = (settingsInfo: SettingsInfoDef): OperationInfo | undefined => {
    const getOperation = settingsInfo.httpOperations.find((op: { method: string }) => op.method === 'GET')
    if (getOperation === undefined || getOperation.url === undefined || getOperation.responseType === undefined) {
      // nothing to retrieve
      return undefined
    }
    return getOperation
  }

  const addSettingsTypePrefix = (opInfo: OperationInfo): OperationInfo =>
    _.cloneDeepWith(opInfo, (val, key) =>
      key === '$ref' && _.isString(val)
        ? val.replace(DEF_REF_PREFIX, `${DEF_REF_PREFIX}${SETTINGS_TYPE_PREFIX}`)
        : undefined,
    )

  const parsedDefs = defs.flatMap(extractDetails).filter(isDefined).map(addSettingsTypePrefix)
  return {
    schemas: Object.fromEntries(parsedDefs.map(({ url, responseType }) => [url, responseType])),
    // assuming recurring types are consistent
    refs: new Map(
      parsedDefs.flatMap(op =>
        Object.entries(
          _.mapKeys(op.responseType.definitions, (_val, key) => `${DEF_REF_PREFIX}${SETTINGS_TYPE_PREFIX}${key}`),
        ),
      ),
    ),
  }
}

/**
 * Generate types for billing settings, which are returned from an endpoint and not specified
 * in the main swagger.
 * Instead, we query the /settings/listing endpoint for the type definitions, and add all
 * types with a Settings_ prefix to avoid conflicts with the swagger types.
 */
export const generateBillingSettingsTypes = async (
  settingsOpInfoInstances: InstanceElement[],
  apiDefConfig: ZuoraApiConfig,
): Promise<openapi.ParsedTypes> => {
  const settingsInfos = settingsOpInfoInstances.flatMap(inst =>
    Array.isArray(inst.value.settings) ? inst.value.settings : [],
  )

  const schemasAndRefs = toSchemasAndRefs(settingsInfos)
  const settingsApiDefConfig = {
    ...apiDefConfig,
    swagger: {
      // 'url' key is required in type SwaggerDefinitionBaseConfig,
      // but it's ignored as we transfer the 'preParsedDefs' argument ('schemasAndRefs')
      url: apiDefConfig.swagger.url,
      typeNameOverrides: apiDefConfig.settingsSwagger?.typeNameOverrides,
    },
  }
  return generateTypes(ZUORA_BILLING, settingsApiDefConfig, schemasAndRefs)
}
