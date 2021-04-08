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
import _ from 'lodash'
import { PrimitiveType, BuiltinTypes } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import SwaggerParser from '@apidevtools/swagger-parser'
import { OpenAPI, OpenAPIV2, IJsonSchema, OpenAPIV3 } from 'openapi-types'

const { isDefined } = lowerdashValues
const { makeArray } = collections.array
const log = logger(module)

export type ReferenceObject = OpenAPIV2.ReferenceObject | OpenAPIV3.ReferenceObject
export type SchemaObject = OpenAPIV2.SchemaObject | OpenAPIV3.SchemaObject | IJsonSchema
export type SwaggerRefs = SwaggerParser.$Refs

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
  log.error('Found %d types for %s, falling back to unknown', types.length, val)
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
const isV3 = (doc: OpenAPI.Document): doc is OpenAPIV3.Document => {
  const version = _.get(doc, 'openapi')
  return _.isString(version) && version.startsWith('3.')
}

export const getParsedDefs = async (swaggerPath: string):
  Promise<{
  schemas: Record<string, SchemaOrReference>
  refs: SwaggerRefs
}> => {
  const parser = new SwaggerParser()
  const parsedSwagger: OpenAPI.Document = await parser.bundle(swaggerPath)

  const toSchemaV2 = (def?: OpenAPIV2.OperationObject): (undefined | OpenAPIV2.Schema) => (
    def?.responses?.[200]?.schema
  )

  const toSchemaV3 = (
    def?: OpenAPIV3.OperationObject
  ): undefined | OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject => {
    const response = def?.responses?.[200]
    if (isReferenceObject(response)) {
      return response
    }

    if (response?.content) {
      const mediaType = _.first(Object.values(response.content))
      if (isDefined(mediaType) && _.isObjectLike(mediaType)) {
        return (mediaType as OpenAPIV3.MediaTypeObject).schema
      }
    }
    return undefined
  }

  if (!(isV2(parsedSwagger) || isV3(parsedSwagger))) {
    // unreachable because of the swagger-parser validations
    throw new Error(`unsupported swagger version ${_.get(parsedSwagger, 'swagger') ?? _.get(parsedSwagger, 'openapi')}`)
  }
  const toSchema = isV2(parsedSwagger) ? toSchemaV2 : toSchemaV3
  const responseSchemas = _.pickBy(
    _.mapValues(parsedSwagger.paths, def => toSchema(def.get)),
    isDefined,
  )
  return {
    schemas: responseSchemas,
    refs: parser.$refs,
  }
}

type HasXOf = {
  allOf?: SchemaOrReference[]
  anyOf?: SchemaOrReference[]
  oneOf?: SchemaOrReference[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const xOfCompatible = (val: any): val is HasXOf => (
  (val.allOf === undefined || Array.isArray(val.allOf))
  && (val.anyOf === undefined || Array.isArray(val.anyOf))
  && (val.oneOf === undefined || Array.isArray(val.oneOf))
)

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
          .filter(x => xOfCompatible(x) || isReferenceObject(x))
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
      ...(xOfCompatible(schemaDef) ? recursiveXOf(schemaDef) : []).flatMap(nested => (
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
