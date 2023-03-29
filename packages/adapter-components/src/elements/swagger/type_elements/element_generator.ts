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
import { ObjectType, PrimitiveType, ElemID, BuiltinTypes, Field, MapType, ListType, TypeMap } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { types as lowerdashTypes, values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { TYPES_PATH, SUBTYPES_PATH } from '../../constants'
import { RequestableTypeSwaggerConfig, AdapterSwaggerApiConfig, TypeSwaggerConfig, TypeSwaggerDefaultConfig } from '../../../config/swagger'
import {
  getParsedDefs, isReferenceObject, toNormalizedRefName, SchemaObject,
  extractProperties, ADDITIONAL_PROPERTIES_FIELD, toPrimitiveType, toTypeName, SwaggerRefs,
  SchemaOrReference, SWAGGER_ARRAY, SWAGGER_OBJECT, isArraySchemaObject, SchemasAndRefs,
} from './swagger_parser'
import { fixTypes, defineAdditionalTypes, getFieldTypeOverridesTypes } from './type_config_override'
import { filterTypes, markServiceIdField } from '../../type_elements'
import { LoadedSwagger } from '../swagger'
import { getConfigWithDefault } from '../../../config/shared'
import { getDependencies } from '../../element_getter'

const { isDefined } = lowerdashValues
const { isArrayOfType } = lowerdashTypes
const log = logger(module)

type TypeAdderType = (
  schema: SchemaOrReference,
  origTypeName: string,
  endpointName?: string,
) => PrimitiveType | ObjectType | ListType

/**
 * Helper function for creating type elements for the given swagger definitions.
 * Keeps track of already-generated subtypes to reuse existing elements and avoid duplications.
 */
const typeAdder = ({
  adapterName,
  schemas,
  toUpdatedResourceName,
  definedTypes,
  parsedConfigs,
  refs,
}: {
  adapterName: string
  toUpdatedResourceName: (origResourceName: string) => string
  schemas: Record<string, SchemaOrReference>
  definedTypes: Record<string, ObjectType>
  parsedConfigs: Record<string, RequestableTypeSwaggerConfig>
  refs: SwaggerRefs
}): TypeAdderType => {
  // keep track of the top-level schemas, so that even if they are reached from another
  // endpoint before being reached directly, they will be treated as top-level
  // (alternatively, we could create a DAG if we knew there are no cyclic dependencies)
  const endpointRootSchemaRefs = _(schemas)
    .pickBy(isReferenceObject)
    .mapValues(toNormalizedRefName)
    .entries()
    .map(([endpointName, refName]) => ({ endpointName, refName }))
    .groupBy(({ refName }) => toUpdatedResourceName(refName))
    .mapValues(val => val.map(({ endpointName }) => endpointName))
    .value()

  /**
   * Helper for adding a nested type for a field.
   */
  const createNestedType = (
    schemaDef: SchemaOrReference,
    nestedName: string,
  ): ObjectType | ListType | PrimitiveType => {
    if (!isReferenceObject(schemaDef)) {
      if (isArraySchemaObject(schemaDef)) {
        // eslint-disable-next-line no-use-before-define
        return new ListType(addType(
          schemaDef.items,
          nestedName,
        ))
      }
      if (
        _.isEmpty(schemaDef)
        || (
          schemaDef.type === SWAGGER_OBJECT
          && schemaDef.properties === undefined
          && schemaDef.additionalProperties === undefined
        )
      ) {
        return BuiltinTypes.UNKNOWN
      }
    }
    // eslint-disable-next-line no-use-before-define
    return addType(
      schemaDef,
      nestedName,
    )
  }

  /**
   * Helper for adding a reusable non-primitive type and recursively adding types for its fields.
   */
  const createAndAssignObjectType = ({
    schemaDef,
    objName,
    endpoints,
  }: {
    schemaDef: SchemaObject
    objName: string
    endpoints?: string[]
  }): void => {
    const naclObjName = naclCase(objName)

    // first add an empty type, to avoid endless recursion in cyclic references from fields
    const type = new ObjectType({
      elemID: new ElemID(adapterName, naclObjName),
      path: !_.isEmpty(endpoints)
        ? [adapterName, TYPES_PATH,
          pathNaclCase(naclObjName)]
        : [adapterName, TYPES_PATH, SUBTYPES_PATH,
          pathNaclCase(naclObjName), pathNaclCase(naclObjName)],
    })
    definedTypes[naclObjName] = type

    const { allProperties, additionalProperties } = extractProperties(schemaDef, refs)

    Object.assign(
      type.fields,
      _.mapValues(allProperties, (fieldSchema, fieldName) => {
        const toNestedTypeName = ({ allOf, anyOf, oneOf }: SchemaObject): string => {
          const xOf = [allOf, anyOf, oneOf].filter(isDefined).flat()
          if (xOf.length > 0 && isArrayOfType(xOf, isReferenceObject)) {
            if (xOf.length === 1) {
              return toNormalizedRefName(xOf[0])
            }
            return `combined_${(xOf).map(toNormalizedRefName).sort().join('_')}`
          }
          return `${objName}_${fieldName}`
        }

        return new Field(
          type,
          fieldName,
          createNestedType(
            fieldSchema,
            toNestedTypeName(fieldSchema),
          ),
        )
      }),
    )

    if (additionalProperties !== undefined) {
      if (type.fields[ADDITIONAL_PROPERTIES_FIELD] !== undefined) {
        log.warn('type %s has both a standard %s field and allows additionalProperties - overriding with an additionalProperties field of type unknown',
          type.elemID.name, ADDITIONAL_PROPERTIES_FIELD)
        Object.assign(
          type.fields,
          { [ADDITIONAL_PROPERTIES_FIELD]: new Field(
            type,
            ADDITIONAL_PROPERTIES_FIELD,
            new MapType(BuiltinTypes.UNKNOWN),
          ) },
        )
      } else {
        Object.assign(
          type.fields,
          { [ADDITIONAL_PROPERTIES_FIELD]: new Field(
            type,
            ADDITIONAL_PROPERTIES_FIELD,
            new MapType(createNestedType(
              additionalProperties,
              // fallback type name when no name is provided in the swagger def
              `${objName}_${ADDITIONAL_PROPERTIES_FIELD}`,
            )),
          ) },
        )
      }
    }

    if (endpoints !== undefined && endpoints.length > 0) {
      if (endpoints.length > 1) {
        log.warn('found %d endpoints for type %s (%s) - using %s', endpoints.length, type.elemID.name, endpoints, endpoints[0])
      }
      parsedConfigs[type.elemID.name] = { request: { url: endpoints[0] } }
    }
  }

  const addType: TypeAdderType = (schema, origTypeName, endpointName) => {
    const typeName = toUpdatedResourceName(origTypeName)

    const toObjectType = (
      schemaDef: SchemaObject,
      objName: string,
      apiEndpointName?: string,
    ): ObjectType => {
      const endpoints = _.uniq([
        apiEndpointName,
        ...(endpointRootSchemaRefs[typeName] ?? []),
      ].filter(isDefined))

      const naclObjName = naclCase(objName)

      if (definedTypes[naclObjName] === undefined) {
        createAndAssignObjectType({
          schemaDef,
          objName,
          endpoints,
        })
      }
      return definedTypes[naclObjName]
    }

    if (isReferenceObject(schema)) {
      return addType(
        refs.get(schema.$ref),
        toNormalizedRefName(schema),
        endpointName,
      )
    }

    const isObjectSchema = (schemaObj: SchemaObject): boolean => (
      schemaObj.type === SWAGGER_OBJECT || schemaObj.type === SWAGGER_ARRAY
      || schemaObj.properties !== undefined
      || ([schemaObj.allOf, schemaObj.oneOf, schemaObj.anyOf].some(xOf =>
        Array.isArray(xOf)
        && (xOf as SchemaObject[]).every(s => isObjectSchema(s) || isReferenceObject(s)))
      )
    )

    if (isObjectSchema(schema)) {
      // top-level schemas are still created as object types
      if (isArraySchemaObject(schema) && endpointName === undefined) {
        return new ListType(addType(
          schema.items,
          typeName,
        ))
      }
      return toObjectType(
        schema,
        typeName,
        endpointName ?? endpointRootSchemaRefs[typeName]?.[0],
      )
    }
    return toPrimitiveType(schema.type)
  }

  return addType
}

export type ParsedTypes = {
  allTypes: TypeMap
  parsedConfigs: Record<string, RequestableTypeSwaggerConfig>
}

const addServiceIdAnnotations = (
  types: Record<string, ObjectType>,
  typeConfig: Record<string, TypeSwaggerConfig>,
  typeDefaultConfig: TypeSwaggerDefaultConfig,
): void => {
  Object.values(types).forEach(type => {
    const { serviceIdField } = getConfigWithDefault(
      typeConfig[type.elemID.name]?.transformation ?? {},
      typeDefaultConfig.transformation,
    )
    if (serviceIdField !== undefined) {
      markServiceIdField(serviceIdField, type.fields, type.elemID.name)
    }
  })
}

/**
 * Generate types for the given OpenAPI definitions.
 */
export const generateTypes = async (
  adapterName: string,
  {
    swagger,
    types,
    typeDefaults,
    supportedTypes,
  }: AdapterSwaggerApiConfig,
  preParsedDefs?: SchemasAndRefs,
  loadedSwagger?: LoadedSwagger,
): Promise<ParsedTypes> => {
  // TODO SALTO-1252 - persist swagger locally

  const toUpdatedResourceName = (
    origResourceName: string
  ): string => swagger.typeNameOverrides?.find(
    ({ originalName }) => originalName === naclCase(origResourceName)
  )?.newName ?? origResourceName

  const definedTypes: Record<string, ObjectType> = {}
  const parsedConfigs: Record<string, RequestableTypeSwaggerConfig> = {}

  const additionalTypesFromConfig = getFieldTypeOverridesTypes(types, typeDefaults)
  const { schemas, refs } = preParsedDefs
    ?? await getParsedDefs({
      swaggerPath: swagger.url,
      loadedSwagger,
      additionalTypes: additionalTypesFromConfig,
    })

  const addType = typeAdder({
    adapterName,
    schemas,
    toUpdatedResourceName,
    definedTypes,
    parsedConfigs,
    refs,
  })

  Object.entries(schemas).forEach(
    ([endpointName, schema]) => addType(
      schema,
      toTypeName(endpointName),
      endpointName,
    )
  )

  if (swagger.additionalTypes !== undefined) {
    defineAdditionalTypes(adapterName, swagger.additionalTypes, definedTypes, types)
  }
  fixTypes(definedTypes, types, typeDefaults)

  addServiceIdAnnotations(definedTypes, types, typeDefaults)

  // including all recurseInto types, regardless of whether they are listed or not
  const recurseIntoTypes = Object.values(types)
    .flatMap(def => def.request?.recurseInto ?? [])
    .map(def => def.type)

  const typesToFetch = [
    ...Object.values(supportedTypes).flat(),
    ...recurseIntoTypes,
  ]

  const extendedSupportedTypes = _.uniq([
    ...typesToFetch,
    ...getDependencies(typesToFetch, types),
  ])

  const filteredTypes = await filterTypes(
    adapterName,
    Object.values(definedTypes),
    _.uniq([...extendedSupportedTypes, ...additionalTypesFromConfig]),
  )

  return {
    allTypes: _.keyBy(filteredTypes, type => type.elemID.name),
    parsedConfigs,
  }
}
