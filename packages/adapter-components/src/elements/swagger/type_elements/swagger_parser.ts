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
import _ from 'lodash'
import { PrimitiveType, BuiltinTypes } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import SwaggerParser from '@apidevtools/swagger-parser'
import { OpenAPI, OpenAPIV2, IJsonSchema, OpenAPIV3 } from 'openapi-types'
import { loadSwagger, LoadedSwagger } from '../swagger'

const { isDefined } = lowerdashValues
const { makeArray } = collections.array
const log = logger(module)

export type ReferenceObject = OpenAPIV2.ReferenceObject | OpenAPIV3.ReferenceObject
export type SchemaObject = OpenAPIV2.SchemaObject | OpenAPIV3.SchemaObject | IJsonSchema
export type SwaggerRefs = Pick<SwaggerParser.$Refs, 'get'>

export type SchemaOrReference = ReferenceObject | SchemaObject

// field to use for swagger additionalProperties
export const ADDITIONAL_PROPERTIES_FIELD = 'additionalProperties'
export const ARRAY_ITEMS_FIELD = 'items'

export const SWAGGER_OBJECT = 'object'
export const SWAGGER_ARRAY = 'array'

export const toPrimitiveType = (val: string | string[] | undefined): PrimitiveType => {
  const swaggerTypeMap: Record<string, PrimitiveType> = {
    string: BuiltinTypes.STRING,
    byte: BuiltinTypes.STRING,
    binary: BuiltinTypes.STRING,
    password: BuiltinTypes.STRING,
    // should later use dedicated types
    date: BuiltinTypes.STRING,
    dateTime: BuiltinTypes.STRING,

    boolean: BuiltinTypes.BOOLEAN,

    number: BuiltinTypes.NUMBER,
    integer: BuiltinTypes.NUMBER,
    long: BuiltinTypes.NUMBER,
    float: BuiltinTypes.NUMBER,
    double: BuiltinTypes.NUMBER,
  }

  const types = _.uniqBy(
    makeArray(val)
      .map(typeName => swaggerTypeMap[typeName])
      .filter(isDefined),
    type => type.elemID.name,
  )
  if (types.length === 1) {
    return types[0]
  }
  log.warn('Found %d types for %s, falling back to unknown', types.length, val)
  return BuiltinTypes.UNKNOWN
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isReferenceObject = (value: any): value is ReferenceObject => (
  value?.$ref !== undefined
)

type ArraySchemaObject = {
  items: ReferenceObject | SchemaObject
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isArraySchemaObject = (schema: any): schema is ArraySchemaObject => (
  schema.type === SWAGGER_ARRAY && schema.items !== undefined
)

const ID_SEPARATOR = '__'
export const toTypeName = (endpointName: string): string => (
  endpointName.split('/').filter(p => !_.isEmpty(p)).join(ID_SEPARATOR)
)

export const toNormalizedRefName = (ref: ReferenceObject): string => (
  // conflicts can only happen if the swagger ref definitions have names that only differ
  // in non-alnum characters - hopefully that's unlikely
  pathNaclCase(naclCase(_.last(ref.$ref.split('/'))))
)

const isV2 = (doc: OpenAPI.Document): doc is OpenAPIV2.Document => {
  const version = _.get(doc, 'swagger')
  return _.isString(version) && version.startsWith('2.')
}
export const isV3 = (doc: OpenAPI.Document): doc is OpenAPIV3.Document => {
  const version = _.get(doc, 'openapi')
  return _.isString(version) && version.startsWith('3.')
}

export type SchemasAndRefs = {
  schemas: Record<string, SchemaOrReference>
  refs: SwaggerRefs
}

type V2Def = { schema: OpenAPIV2.Schema }

const toSchemaV2 = (def?: V2Def): (undefined | OpenAPIV2.Schema) =>
  def?.schema

type V3Def = OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject | OpenAPIV3.RequestBodyObject

const toSchemaV3 = (
  def?: V3Def
): undefined | OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject => {
  if (isReferenceObject(def)) {
    return def
  }

  if (def?.content) {
    const mediaType = _.first(Object.values(def.content))
    if (isDefined(mediaType) && _.isObjectLike(mediaType)) {
      return (mediaType as OpenAPIV3.MediaTypeObject).schema
    }
  }
  return undefined
}

export enum SwaggerVersion {
  V2,
  V3
}

const getSwaggerVersion = (swagger: LoadedSwagger): SwaggerVersion => {
  if (!(isV2(swagger.document) || isV3(swagger.document))) {
    // unreachable because of the swagger-parser validations
    throw new Error(`unsupported swagger version ${_.get(swagger.document, 'swagger') ?? _.get(swagger.document, 'openapi')}`)
  }

  return isV2(swagger.document) ? SwaggerVersion.V2 : SwaggerVersion.V3
}

export const toSchema = (
  swaggerVersion: SwaggerVersion,
  def?: V3Def | V2Def
): SchemaOrReference | undefined => (
  swaggerVersion === SwaggerVersion.V2 ? toSchemaV2(def as V2Def) : toSchemaV3(def as V3Def)
)

export const getParsedDefs = async ({
  swaggerPath,
  loadedSwagger,
  additionalTypes,
}:{
  swaggerPath: string
  loadedSwagger?: LoadedSwagger
  additionalTypes?: Set<string>
}):Promise<SchemasAndRefs> => {
  const swagger = loadedSwagger ?? await loadSwagger(swaggerPath)

  const swaggerVersion = getSwaggerVersion(swagger)
  const responseSchemas = _.pickBy(
    _.mapValues(swagger.document.paths, def => toSchema(swaggerVersion, def.get?.responses?.[200])),
    isDefined,
  )
  const additionalSchemas = isV3(swagger.document)
    ? _.pickBy(
      swagger.document.components?.schemas,
      (_value, key) => additionalTypes?.has(key)
    )
    : _.pickBy(
      swagger.document.definitions,
      (_value, key) => additionalTypes?.has(key)
    )
  return {
    schemas: { ...responseSchemas, ...additionalSchemas },
    refs: swagger.parser.$refs,
  }
}

type HasXOf = {
  allOf?: SchemaOrReference[]
  anyOf?: SchemaOrReference[]
  oneOf?: SchemaOrReference[]
}

/**
 * Extract the nested fields for the specified schema that are defined in its allOf nested schemas,
 * including additionalProperties.
 */
export const extractProperties = (schemaDefObj: SchemaObject, refs: SwaggerRefs): {
  allProperties: Record<string, SchemaObject>
  additionalProperties?: SchemaObject
} => {
  const recursiveXOf = (
    { allOf, anyOf, oneOf }: HasXOf
  ): SchemaOrReference[] => (
    [allOf, anyOf, oneOf].filter(isDefined).flatMap(
      xOf => [
        ...xOf,
        ...xOf
          .flatMap(nested => (isReferenceObject(nested) ? [nested] : recursiveXOf(nested))),
      ]
    )
  )

  const flattenXOfProps = (schemaDef: SchemaObject): Record<string, SchemaObject> => ({
    ...schemaDef.properties,
    ...Object.assign(
      {},
      // TODO check if need handling for arrays as nested allOf (edge case?)
      ...(recursiveXOf(schemaDef)).flatMap(nested => (
        isReferenceObject(nested)
          ? flattenXOfProps(refs.get(nested.$ref))
          : {
            ...nested.properties,
            ...flattenXOfProps(nested.properties ?? {}),
          }
      )),
    ),
  })

  const flattenXOfAdditionalProps = (schemaDef: SchemaObject): SchemaObject[] => (
    [
      schemaDef.additionalProperties,
      ...recursiveXOf(schemaDef).flatMap(nested => (
        isReferenceObject(nested)
          ? flattenXOfAdditionalProps(refs.get(nested.$ref))
          : [
            nested.additionalProperties,
            ...flattenXOfAdditionalProps(nested.properties ?? {}),
          ]
      )),
    ].filter(p => p !== false)
      .map(p => {
        if (p === undefined || _.isBoolean(p)) {
          return {}
        }
        return p
      }).filter(isDefined)
  )

  if (isArraySchemaObject(schemaDefObj)) {
    // this is a top-level array object - create a nested `items` field and disallow
    // additional properties
    return {
      allProperties: { [ARRAY_ITEMS_FIELD]: schemaDefObj },
      additionalProperties: undefined,
    }
  }

  const hasNonEmptyDefinition = (s: SchemaObject): boolean => (
    s.properties !== undefined
    || !_.isEmpty(s.type)
    || !_.isEmpty(s.allOf)
  )

  const allAdditionalProperties = flattenXOfAdditionalProps(schemaDefObj)
  if (allAdditionalProperties.filter(p => hasNonEmptyDefinition(p)).length > 1) {
    // TODO change when we have validations on these (SALTO-1259) to cover anyOf and oneOf correctly
    log.debug('too many additionalProperties found in allOf / anyOf / oneOf - using first non-empty')
  }
  const additionalProperties = (
    allAdditionalProperties.find(isReferenceObject)
    ?? allAdditionalProperties.find(hasNonEmptyDefinition)
    ?? allAdditionalProperties[0]
  )

  return {
    allProperties: flattenXOfProps(schemaDefObj),
    additionalProperties,
  }
}
