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
import { ActionName, ObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { OpenAPIV3 } from 'openapi-types'
import { DeploymentRequests } from '../../../config/request'
import { OPERATION_TO_ANNOTATION } from '../../../deployment'
import { LoadedSwagger } from '../swagger'
import { extractProperties, isReferenceObject, isV3, SwaggerVersion, toSchema } from '../type_elements/swagger_parser'

const log = logger(module)

const getFieldsNames = (
  swagger: LoadedSwagger,
  operation: OpenAPIV3.OperationObject,
): string[] => {
  const schemaOrRef = toSchema(SwaggerVersion.V3, operation.requestBody)
  if (schemaOrRef === undefined) {
    return []
  }

  const schema = isReferenceObject(schemaOrRef)
    ? swagger.parser.$refs.get(schemaOrRef.$ref)
    : schemaOrRef

  return _(extractProperties(schema, swagger.parser.$refs).allProperties)
    .pickBy(val => !('readOnly' in val) || !val.readOnly)
    .keys()
    .value()
}

const getSwaggerEndpoint = (url: string, baseUrls: string[]): string => {
  const matchingBase = baseUrls.find(baseUrl => url.startsWith(baseUrl))
  return matchingBase === undefined ? url : url.slice(matchingBase.length)
}

/**
 * Add the deployment annotations to the given object type based on the schemas in the swagger
 *
 * @param type The object type to annotate
 * @param swagger The swagger to use to extract with what operations are supported on each value
 * @param endpointDetails The details of of what endpoints to use for each action
 */
export const addDeploymentAnnotations = (
  type: ObjectType,
  swagger: LoadedSwagger,
  endpointDetails: DeploymentRequests,
): void => {
  const { document } = swagger
  if (!isV3(document)) {
    throw new Error('Deployment currently only support open api V3')
  }

  const baseUrls = document.servers?.map(
    // The server url can be either "http://someUrl.." or "//someUrl.."
    server => new URL(server.url.startsWith('//') ? `http:${server.url}` : server.url).pathname
  ).filter(baseUrl => baseUrl !== '/') ?? []

  Object.entries(endpointDetails).forEach(([operation, endpoint]) => {
    if (endpoint === undefined) {
      return
    }
    const endpointUrl = getSwaggerEndpoint(endpoint.url, baseUrls)
    if (swagger.document.paths[endpointUrl]?.[endpoint.method] === undefined) {
      log.warn(`${type.elemID.getFullName()} endpoint ${endpointUrl} not found in swagger`)
      return
    }

    type.annotations[OPERATION_TO_ANNOTATION[operation as ActionName]] = true

    const fields = getFieldsNames(
      swagger,
      swagger.document.paths[endpointUrl][endpoint.method]
    )

    fields.forEach(fieldName => {
      const field = type.fields[fieldName]
      if (field !== undefined) {
        field.annotations[OPERATION_TO_ANNOTATION[operation as ActionName]] = true
      }
    })
  })
}
