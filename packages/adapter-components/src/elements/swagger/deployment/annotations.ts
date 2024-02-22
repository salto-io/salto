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
import {
  ActionName,
  CORE_ANNOTATIONS,
  isListType,
  isMapType,
  isObjectType,
  ObjectType,
  TypeElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { AdapterApiConfig } from '../../../config/shared'
import { DeploymentRequestsByAction } from '../../../config/request'
import { LoadedSwagger } from '../swagger'
import { OPERATION_TO_ANNOTATION } from '../../../deployment/annotations'
import {
  extractProperties,
  isArraySchemaObject,
  isReferenceObject,
  isV3,
  SchemaObject,
  SchemaOrReference,
  SwaggerVersion,
  toSchema,
} from '../type_elements/swagger_parser'

const { awu } = collections.asynciterable

const log = logger(module)

const getFields = (swagger: LoadedSwagger, schemaOrRef: SchemaOrReference): Record<string, SchemaObject> => {
  const schema = isReferenceObject(schemaOrRef) ? swagger.parser.$refs.get(schemaOrRef.$ref) : schemaOrRef

  const { allProperties, additionalProperties } = extractProperties(schema, swagger.parser.$refs)
  const fields = {
    ...allProperties,
    ...(additionalProperties !== undefined ? { additionalProperties } : {}),
  }
  const editableFields = _.pickBy(fields, val => !('readOnly' in val) || !val.readOnly)
  return editableFields
}

const getSwaggerEndpoint = (url: string, baseUrls: string[]): string => {
  const matchingBase = baseUrls.find(baseUrl => url.startsWith(baseUrl))
  const urlWithoutBase = matchingBase === undefined ? url : url.slice(matchingBase.length)
  return urlWithoutBase.split('?')[0]
}

const getInnerSchemaAndType = async (
  type: TypeElement,
  schema: SchemaOrReference,
): Promise<{ schema: SchemaOrReference; type: ObjectType } | undefined> => {
  if (isObjectType(type)) {
    return { schema, type }
  }

  if (isMapType(type)) {
    const innerType = await type.getInnerType()
    if (isObjectType(innerType)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      return getInnerSchemaAndType(innerType, schema)
    }
  }

  if (isListType(type)) {
    const innerType = await type.getInnerType()
    if (isArraySchemaObject(schema) && isObjectType(innerType)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      return getInnerSchemaAndType(innerType, schema.items)
    }
  }
  return undefined
}

const setTypeAnnotations = async (
  type: ObjectType,
  schema: SchemaOrReference,
  swagger: LoadedSwagger,
  action: ActionName,
  annotatedTypes: Set<string>,
): Promise<void> => {
  if (annotatedTypes.has(type.elemID.getFullName())) {
    return
  }

  annotatedTypes.add(type.elemID.getFullName())

  const swaggerFields = getFields(swagger, schema)

  await awu(Object.entries(swaggerFields)).forEach(async ([name, properties]) => {
    const field = type.fields[name]

    if (field === undefined) {
      return
    }
    delete field.annotations[OPERATION_TO_ANNOTATION[action]]

    const fieldType = await field.getType()

    const schemaAndType = await getInnerSchemaAndType(fieldType, properties)
    if (schemaAndType === undefined) {
      return
    }

    const { schema: innerSchema, type: innerType } = schemaAndType

    await setTypeAnnotations(innerType, innerSchema, swagger, action, annotatedTypes)
  })
}

export const addDeploymentAnnotationsFromSwagger = async (
  type: ObjectType,
  swagger: LoadedSwagger,
  endpointDetails: DeploymentRequestsByAction,
): Promise<Set<string>> => {
  const foundEndpoint = new Set<string>()

  const { document } = swagger
  if (!isV3(document)) {
    throw new Error('Deployment currently only supports open api V3')
  }

  const baseUrls =
    document.servers
      ?.map(
        // The server url can be either "http://someUrl.." or "//someUrl.."
        server => new URL(server.url.startsWith('//') ? `http:${server.url}` : server.url).pathname,
      )
      .filter(baseUrl => baseUrl !== '/') ?? []

  await awu(Object.entries(endpointDetails)).forEach(async ([operation, endpoint]) => {
    if (endpoint === undefined) {
      return
    }

    const endpointUrl = getSwaggerEndpoint(endpoint.url, baseUrls)
    if (swagger.document.paths[endpointUrl]?.[endpoint.method] === undefined) {
      return
    }
    foundEndpoint.add(endpoint.url)

    delete type.annotations[OPERATION_TO_ANNOTATION[operation as ActionName]]

    const schema = toSchema(SwaggerVersion.V3, swagger.document.paths[endpointUrl][endpoint.method].requestBody)

    if (schema === undefined) {
      log.warn('Failed to get schema for type %s', type.elemID.getFullName())
      return
    }
    await setTypeAnnotations(type, schema, swagger, operation as ActionName, new Set())
  })

  return foundEndpoint
}

/**
 * Add the deployment annotations to the given object type based on the schemas in the swagger
 *
 * @param type The object type to annotate
 * @param swagger The swagger to use to extract with what operations are supported on each value
 * @param endpointDetails The details of of what endpoints to use for each action
 */
const addDeploymentAnnotationsToType = async (
  type: ObjectType,
  swaggers: LoadedSwagger[],
  endpointDetails: DeploymentRequestsByAction,
): Promise<void> => {
  const foundEndpointsDetails = await awu(swaggers)
    .map(swagger => addDeploymentAnnotationsFromSwagger(type, swagger, endpointDetails))
    .toArray()

  ;[endpointDetails.add?.url, endpointDetails.modify?.url, endpointDetails.remove?.url]
    .filter(values.isDefined)
    .filter(url => foundEndpointsDetails.every(foundEndpoints => !foundEndpoints.has(url)))
    .forEach(url => {
      log.warn(`${type.elemID.getFullName()} endpoint ${url} not found in swagger`)
    })
}

/**
 * Add the deployment annotations to the given object type based on the schemas in the swagger
 *
 * @param type The object type to annotate
 * @param swagger The swagger to use to extract with what operations are supported on each value
 * @param endpointDetails The details of of what endpoints to use for each action
 */
export const addDeploymentAnnotations = async (
  types: ObjectType[],
  swaggers: LoadedSwagger[],
  apiDefinitions: AdapterApiConfig,
): Promise<void> => {
  types.forEach(type => {
    type.annotations[CORE_ANNOTATIONS.CREATABLE] = Boolean(type.annotations[CORE_ANNOTATIONS.CREATABLE])
    type.annotations[CORE_ANNOTATIONS.UPDATABLE] = Boolean(type.annotations[CORE_ANNOTATIONS.UPDATABLE])
    type.annotations[CORE_ANNOTATIONS.DELETABLE] = Boolean(type.annotations[CORE_ANNOTATIONS.DELETABLE])
    Object.values(type.fields).forEach(field => {
      field.annotations[CORE_ANNOTATIONS.CREATABLE] = Boolean(field.annotations[CORE_ANNOTATIONS.CREATABLE])
      field.annotations[CORE_ANNOTATIONS.UPDATABLE] = Boolean(field.annotations[CORE_ANNOTATIONS.UPDATABLE])
    })
  })

  await awu(types).forEach(type =>
    addDeploymentAnnotationsToType(type, swaggers, apiDefinitions.types[type.elemID.name]?.deployRequests ?? {}),
  )
}
