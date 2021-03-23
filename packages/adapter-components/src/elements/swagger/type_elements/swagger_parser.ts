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
export type SchemaObject = OpenAPIV2.SchemaObject | OpenAPIV3.SchemaObject
export type SwaggerRefs = SwaggerParser.$Refs

export type SchemaOrReference = ReferenceObject | SchemaObject

// field to use for swagger additionalProperties
export const ADDITIONAL_PROPERTIES_FIELD = 'additionalProperties'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isArraySchemaObject = (schema: any): schema is OpenAPIV3.ArraySchemaObject => (
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

export const getParsedDefs = async (swaggerPath: string):
  Promise<{
  // TODO add better handling for v2 vs. v3, add safeties
  schemas: Record<string, SchemaOrReference>
  refs: SwaggerRefs
}> => {
  const parser = new SwaggerParser()
  const parsedSwagger: OpenAPI.Document = await parser.bundle(swaggerPath)
  const getDefs: Record<string, OpenAPIV2.OperationObject> = _.pickBy(
    _.mapValues(parsedSwagger.paths, def => def.get),
    isDefined,
  )
  const toSchema = (def: OpenAPIV2.OperationObject): (
    undefined | OpenAPIV2.Schema | OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => {
    // v2
    if (def.responses?.[200]?.schema !== undefined) {
      return def.responses?.[200]?.schema
    }
    // v3
    const { content } = def.responses?.[200] ?? {}
    if (content) {
      const mediaType = _.first(Object.values(content))
      if (isDefined(mediaType) && _.isObjectLike(mediaType)) {
        return (mediaType as OpenAPIV3.MediaTypeObject).schema
      }
    }
    return undefined
  }

  const responseSchemas = _.pickBy(
    _.mapValues(getDefs, toSchema),
    isDefined,
  )
  return {
    schemas: responseSchemas,
    refs: parser.$refs,
  }
}

type ExtendedSchema = IJsonSchema | SchemaObject

type HasAllOf = {
  allOf?: ExtendedSchema[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allOfCompatible = (val: any): val is HasAllOf => (
  val.allOf === undefined || allOfCompatible(val.allOf)
)

/**
 * Extract the nested fields for the specified schema that are defined in its allOf nested schemas,
 * including additionalProperties.
 */
export const extractAllOf = (schemaDefObj: SchemaObject, refs: SwaggerRefs): {
  allProperties: Record<string, SchemaObject>
  additionalProperties?: ExtendedSchema
} => {
  const recursiveAllOf = (
    { allOf }: HasAllOf
  ): ExtendedSchema[] => {
    if (allOf === undefined) {
      return []
    }
    return [
      ...allOf,
      ...allOf.filter(allOfCompatible).flatMap(recursiveAllOf),
    ]
  }

  const flattenAllOfProps = (schemaDef: SchemaObject): Record<string, SchemaObject> => ({
    ...schemaDef.properties,
    ...Object.assign(
      {},
      // TODO check if need handling for arrays as nested allOf (edge case?)
      ...(recursiveAllOf(schemaDef)).flatMap(nested => (
        isReferenceObject(nested)
          ? flattenAllOfProps(refs.get(nested.$ref))
          : {
            ...nested.properties,
            ...flattenAllOfProps(nested.properties ?? {}),
          }
      )),
    ),
  })

  const flattenAllOfAddlProps = (schemaDef: SchemaObject): ExtendedSchema[] => (
    [
      schemaDef.additionalProperties,
      ...(allOfCompatible(schemaDef) ? recursiveAllOf(schemaDef) : []).flatMap(nested => (
        isReferenceObject(nested)
          ? flattenAllOfAddlProps(refs.get(nested.$ref))
          : [
            nested.additionalProperties,
            ...flattenAllOfAddlProps(nested.properties ?? {}),
          ]
      )),
    ].map(p => (p === false ? undefined : p))
      .map(p => (p === true ? {} : p))
      .filter(isDefined)
  )

  if (isArraySchemaObject(schemaDefObj)) {
    return {
      allProperties: { items: schemaDefObj },
      additionalProperties: undefined,
    }
  }

  const additionalProperties = flattenAllOfAddlProps(schemaDefObj)
  if (additionalProperties.length > 1) {
    log.error('too many additionalProperties found in allOf - using first')
  }

  return {
    allProperties: flattenAllOfProps(schemaDefObj),
    additionalProperties: additionalProperties[0],
  }
}
