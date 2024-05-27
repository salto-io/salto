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
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import {
  SchemaOrReference,
  SwaggerRefs,
  extractProperties,
  getSwaggerVersion,
  isArraySchemaObject,
  isReferenceObject,
  toNormalizedRefName,
  toSchema,
} from './swagger_parser'
import { LoadedSwagger } from '../load'
import { InstanceFetchApiDefinitions } from '../../definitions/system/fetch'

const log = logger(module)
const { isDefined } = values

const isSingleItemEndpoint = (endpoint: string): boolean => new RegExp(/\/\{[^}]+\}$/).test(endpoint)

const isDependentEndpoint = (endpoint: string): boolean => new RegExp(/\{[^}]+\}/).test(endpoint)

const getParentEndpoint = (endpoint: string): string => {
  const parts = endpoint.split('/')
  const lastParam = _(parts).findLastIndex(part => new RegExp(/\{[^}]+\}/).test(part))
  if (lastParam !== -1) {
    return parts.slice(0, lastParam).join('/')
  }
  return endpoint
}

const toMatchingSchemaName = (schema: SchemaOrReference): string | undefined => {
  if (isArraySchemaObject(schema)) {
    return toMatchingSchemaName(schema.items)
  }
  if (isReferenceObject(schema)) {
    return toNormalizedRefName(schema)
  }
  log.error(`unsupported schema type ${safeJsonStringify(schema)}`)
  return undefined
}

const areEqualSchemas = (first: SchemaOrReference, second: SchemaOrReference, refs: SwaggerRefs): boolean =>
  _.isEqualWith(first, second, (f, s) => {
    if (isReferenceObject(f) || isReferenceObject(s)) {
      const firstResolved = isReferenceObject(f) ? refs.get(f.$ref) : f
      const secondResolved = isReferenceObject(s) ? refs.get(s.$ref) : s
      // call areEqualSchemas recursively with resolved schemas
      return areEqualSchemas(firstResolved, secondResolved, refs)
    }
    return undefined
  })

const extractLastArg = (endpoint: string): string | undefined => {
  const parts = endpoint.split('/')
  const lastParamIdx = _(parts).findLastIndex(part => new RegExp(/\{[^}]+\}/).test(part))
  if (lastParamIdx !== -1) {
    const match = parts[lastParamIdx].match(/\{([^}]+)\}/)
    return match ? match[1] : undefined
  }
  return undefined
}

/*
 * Util function to get the inner schema of a schema or reference
 */
const getInnerSchemaOrRef = ({
  schemaOrRef,
  path = [],
  refs,
  knownPageFieldsToIgnore,
}: {
  schemaOrRef: SchemaOrReference
  path?: string[]
  refs: SwaggerRefs
  knownPageFieldsToIgnore?: string[]
}): { schemaOrRef: SchemaOrReference; path: string[] } => {
  const schema = isReferenceObject(schemaOrRef) ? refs.get(schemaOrRef.$ref) : schemaOrRef
  if (isArraySchemaObject(schema)) {
    return getInnerSchemaOrRef({ schemaOrRef: schema.items, path, refs, knownPageFieldsToIgnore })
  }

  const { allProperties } = extractProperties(schema, refs)
  const nonPrimitiveProperties = _.pickBy(allProperties, p => isReferenceObject(p) || p.type === 'object' || p.type === 'array')
  const potentialDataProperties =
    (knownPageFieldsToIgnore ? _.omit(nonPrimitiveProperties, knownPageFieldsToIgnore) : nonPrimitiveProperties) ?? {}
  if (Object.keys(potentialDataProperties).length === 1) {
    return getInnerSchemaOrRef({
      schemaOrRef: Object.values(potentialDataProperties)[0] as SchemaOrReference,
      path: path.concat(Object.keys(potentialDataProperties)[0]),
      refs,
      knownPageFieldsToIgnore,
    })
  }

  return { schemaOrRef, path: path.length === 0 ? ['.'] : path }
}

const getTypeNameAndDataField = ({
  endpoint,
  schemaOrRef,
  refs,
  listEndpointToItemEndpoint,
  schemaByEndpoint,
  knownPageFieldsToIgnore,
}: {
  endpoint: string
  schemaOrRef: SchemaOrReference
  refs: SwaggerRefs
  listEndpointToItemEndpoint: Record<string, string>
  schemaByEndpoint: Record<string, SchemaOrReference>
  knownPageFieldsToIgnore?: string[]
}): { typeName: string; field: string } | undefined => {
  const schema = isReferenceObject(schemaOrRef) ? refs.get(schemaOrRef.$ref) : schemaOrRef
  if (schema === undefined) {
    // eslint-disable-next-line no-console
    console.log('Failed to get typeName for endpoint %s', endpoint)
    log.error('Failed to get typeName and data field for endpoint %s', endpoint)
    return undefined
  }

  const matchingItemEndpoint = listEndpointToItemEndpoint[endpoint]
  // if there's a matching single item endpoint, we look for a field that matches the single item schema
  if (matchingItemEndpoint !== undefined) {
    if (endpoint === '/event_orchestrations') {
      // eslint-disable-next-line no-console
      console.log('in matchingItemEndpoint stategy for edpoint %s, found matchin single', endpoint, matchingItemEndpoint) // TODOS remove
    }
    const itemSchemaOrRef = schemaByEndpoint[matchingItemEndpoint]
    const { schemaOrRef: innerItemSchemaOrRef } = getInnerSchemaOrRef({
      schemaOrRef: itemSchemaOrRef,
      refs,
      knownPageFieldsToIgnore,
    })
    const matching = Object.entries(extractProperties(schema, refs).allProperties).find(
      ([_propName, propSchemaOrRef]) => {
        if (endpoint === '/event_orchestrations') { // TODOS remove
          // eslint-disable-next-line no-console
          console.log('prop name is', _propName) // TODOS remove
        }
        const { schemaOrRef: propInnerSchemaOrRef } = getInnerSchemaOrRef({
          schemaOrRef: propSchemaOrRef as SchemaOrReference,
          refs,
          knownPageFieldsToIgnore,
        })
        return areEqualSchemas(propInnerSchemaOrRef, innerItemSchemaOrRef, refs)
      },
    )
    if (matching) {
      const typeName = toMatchingSchemaName(matching[1] as SchemaOrReference)
      return typeName ? { typeName, field: matching[0] } : undefined
    }
  }

  const { schemaOrRef: innerSchemaOrRef, path } = getInnerSchemaOrRef({ schemaOrRef, refs, knownPageFieldsToIgnore })
  const typeName = toMatchingSchemaName(innerSchemaOrRef)
  if (typeName) {
    return { typeName, field: path.join('') }
  }
  log.error('Failed to get typeName and data field for endpoint %s', endpoint)
  return undefined
}

/**
 * Util function to create fetch request definitions for provided list of types
 *
 * @param requestDefinitions if provided, the given request definitions will be updated with the extracted definitions
 * @param types if provided, only requests definitions for the given types will be created
 * @param includeSubResources whether to include sub resources
 * @param knownPageFieldsToIgnore list of fields that often seen in page to help identify the data field (e.g. 'limit', 'count')
 */
export const createFetchRequestDef = ({
  loadedSwagger,
  requestDefinitions = {},
  types,
  includeSubResources = false,
  knownPageFieldsToIgnore,
}: {
  loadedSwagger: LoadedSwagger
  requestDefinitions?: Record<string, Pick<InstanceFetchApiDefinitions, 'requests'>>
  types?: string[]
  includeSubResources?: boolean
  knownPageFieldsToIgnore?: string[]
}): Record<string, Pick<InstanceFetchApiDefinitions, 'requests'>> => {
  const swaggerVersion = getSwaggerVersion(loadedSwagger)

  const schemaByEndpoint: Record<string, SchemaOrReference> = Object.fromEntries(
    Object.entries(loadedSwagger.document.paths)
      .filter(([_url, def]) => isDefined(def.get))
      .map(([url, def]) => [url, toSchema(swaggerVersion, def.get.responses[200] ?? def.get.responses['2XX'])])
      .filter(([_url, schema]) => isDefined(schema)),
  )

  const [itemEndpoints, listEndpoints] = _.partition(Object.entries(schemaByEndpoint), ([url, _schema]) =>
    isSingleItemEndpoint(url),
  )
  const listEndpointToMatchingItemEndpoint = Object.fromEntries(
    itemEndpoints.map(([url, _schema]) => [getParentEndpoint(url), url]),
  )

  const updatedDefs = { ...requestDefinitions }
  listEndpoints
    .filter(([endpoint]) => includeSubResources || !isDependentEndpoint(endpoint))
    .forEach(([endpoint, schema]) => {
      // eslint-disable-next-line no-console
      console.log('current endpoint is %s', endpoint)
      try {
        const res = getTypeNameAndDataField({
          endpoint,
          schemaOrRef: schema,
          refs: loadedSwagger.parser.$refs,
          listEndpointToItemEndpoint: listEndpointToMatchingItemEndpoint,
          schemaByEndpoint,
          knownPageFieldsToIgnore
        })
        if(endpoint === '/event_orchestrations'){
          // eslint-disable-next-line no-console
          console.log('res is %s', safeJsonStringify(res)) // TODOS remove
        }
        if (!res) {
          // eslint-disable-next-line no-console
          console.log('failed to find matching schema name for endpoint %s', endpoint) // TODOS remove
          log.error('failed to find matching schema name for schema %s', safeJsonStringify(schema))
          return
        }
        const { typeName, field: dataField } = res
        if (!types || types.includes(typeName)) {
          const requestDef = { endpoint: { path: endpoint }, transformation: { root: dataField } }
          if (updatedDefs[typeName] === undefined) {
            Object.assign(updatedDefs, { [typeName]: { requests: [requestDef] } })
            return
          }
          updatedDefs[typeName].requests?.push(requestDef)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('failed to update fetch definitions for endpoint %s', endpoint)
        log.error('failed to create fetch request definition for endpoint %s', endpoint)
      }
    })
  log.debug('created fetch request definitions: %o', safeJsonStringify(updatedDefs))
  return updatedDefs
}


/*
 * Converts swagger spec to request definitions
 * if includeSubResources is true, recurseInto definitions will be added
 */
export const getResourceDef = ({
  loadedSwagger,
  resourceDefinitions,
  types,
  includeSubResources,
  // TODOS add optional pre calculated data field
}: {
  loadedSwagger: LoadedSwagger
  resourceDefinitions?: Record<string, Pick<InstanceFetchApiDefinitions, 'resource'>>
  types?: string[]
  includeSubResources?: boolean
}): Record<string, Pick<InstanceFetchApiDefinitions, 'resource'>> => {
  log.debug('creating fetch resource definitions for types %o, %s', types, includeSubResources)
  const swaggerVersion = getSwaggerVersion(loadedSwagger)
  const endpointsBySchema: Record<string, SchemaOrReference> = Object.fromEntries(
    Object.entries(loadedSwagger.document.paths)
      .filter(([url, def]) => isDefined(def.get) && !isSingleItemEndpoint(url))
      .map(([url, def]) => [url, toSchema(swaggerVersion, def.get.responses[200] ?? def.get.responses['2XX'])])
      .filter(([_url, schema]) => isDefined(schema)),
  )

  // const [dependentEndpoints, independentEndpoints] = _.partition(Object.entries(endpointsBySchema), ([url, _schema]) =>
  //   isDependentEndpoint(url),
  // )
  const independentEndpoints = Object.entries(endpointsBySchema).filter(([ url, _schema ]) => !isDependentEndpoint(url))

  const endpointsByParentEndpoint = _.groupBy(Object.keys(endpointsBySchema), endpoint => getParentEndpoint(endpoint))
  // eslint-disable-next-line no-console
  // console.log('endpointsByParentEndpoint %s', safeJsonStringify(endpointsByParentEndpoint)) // TODOS remove, just for debug

  const updatedDefs = { ...resourceDefinitions }
  independentEndpoints.forEach(([url, schema]) => {
    try {
      const typeName = getTypeNameAndDataField({
        endpoint: url,
        schemaOrRef: schema,
        refs: loadedSwagger.parser.$refs,
        listEndpointToItemEndpoint: {}, // TODOS should be empty ???
        schemaByEndpoint: endpointsBySchema,
      })?.typeName
      if (!typeName) {
        return
      }
      if (updatedDefs[typeName] === undefined) {
        Object.assign(updatedDefs, { [typeName]: { resource: { directFetch: true } } })
      }
      updatedDefs[typeName].resource = { directFetch: true, ...updatedDefs[typeName].resource }

      if (includeSubResources && endpointsByParentEndpoint[url] !== undefined) {
        const recurseIntoEndpoints = endpointsByParentEndpoint[url]
        recurseIntoEndpoints.forEach(subResourceEndpoint => {
          // add recurse into info to request (TODOS - extract to function)
          try {
            const subResourceDetails = getTypeNameAndDataField({
              endpoint: subResourceEndpoint,
              schemaOrRef: endpointsBySchema[subResourceEndpoint],
              refs: loadedSwagger.parser.$refs,
              listEndpointToItemEndpoint: {}, // TODOS should be empty ???
              schemaByEndpoint: endpointsBySchema,
            })
            const subResourceTypeName = subResourceDetails?.typeName
            const lastEndpointParam = extractLastArg(subResourceEndpoint)
            if (subResourceTypeName === undefined || lastEndpointParam === undefined) {
              // eslint-disable-next-line no-console
              console.log('Failed to extract subresource defs for subresource %s and parent %s', subResourceEndpoint, url)
              return // TODOS log error and etc
            }

            // set recurseInto def in the parent type
            _.set(
              updatedDefs,
              [typeName, 'resource', 'recurseInto'],
              {
                [subResourceTypeName]: {
                  typeName: subResourceTypeName,
                  context: { 
                    args: { [lastEndpointParam]: { root: 'id'}}
                  }
                }
              }
            )

            // set request def in the sub resource type definitions
            // TODOSSS
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('failed to get type name and data field for subresource %s', subResourceEndpoint)
            log.error('failed to get type name and data field for subresource %s', subResourceEndpoint)
          }
        })
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('failed to update resource definitions for endpoint %s', url)
    }
  })

  // TODOS  - this part if implemented correctly will handle all level of subresources
  // the above implementation is only for the first level of subresources
  // if (!includeSubResources) {
  //   return updatedDefs
  // }
  // const dependentEndpointsByParent = _.groupBy(Object.keys(endpointsBySchema), endpoint => getParentEndpoint(endpoint))
  // const graph = createDependencyGraphV2(dependentEndpointsByParent)
  // wu(graph.evaluationOrder()).forEach(nodeId => {
  //   const schema = endpointsBySchema[nodeId.toString()]
  //   const resourceTypeName = toMatchingSchemaName(schema)
  //   if (!resourceTypeName) {
  //     return
  //   }
  //   const dependencies = graph.getReverse(nodeId)
  //   dependencies.forEach(dep => {
  //     // update sub resource defeinitions
  //     const dependencyTypeName = toMatchingSchemaName(endpointsBySchema[dep])
  //     if (!dependencyTypeName) {
  //       return
  //     }
  //     if (updatedDefs[dependencyTypeName] === undefined) {
  //       Object.assign(updatedDefs, { [dependencyTypeName]: { resource: { directFetch: false } } })
  //     }
  //     updatedDefs[dependencyTypeName].resource = { directFetch: false, ...updatedDefs[dependencyTypeName].resource }
  //     const lastEndpointParam = extractLastArg(dep.toString())
  //     if (lastEndpointParam !== undefined) {
  //       // update the parent resource definition
  //       const recurseIntoDef = {
  //         [dependencyTypeName]: {
  //           typeName: dependencyTypeName,
  //           context: { args: { [lastEndpointParam]: { fromField: 'id' } } },
  //         },
  //       }
  //       // TODO add to resourceDef.resource.recurseInto the new recurseIntoDef
  //       const nodeResouceDef = updatedDefs[resourceTypeName].resource
  //       if (nodeResouceDef !== undefined) {
  //         Object.assign(nodeResouceDef, {
  //           ...nodeResouceDef,
  //           recurseInto: { ...nodeResouceDef.recurseInto, ...recurseIntoDef },
  //         })
  //       }
  //     }
  //   })
  // })
  // log.debug('creating subresource fetch request definitions for types %o', dependentEndpoints)
  return updatedDefs
}