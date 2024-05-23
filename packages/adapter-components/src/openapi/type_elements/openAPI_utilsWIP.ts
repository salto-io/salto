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

// import _ from 'lodash'
// import wu from 'wu'
// import { values } from '@salto-io/lowerdash'
// import { logger } from '@salto-io/logging'
// import { DAG } from '@salto-io/dag'
// import { safeJsonStringify } from '@salto-io/adapter-utils'
// import {
//   SchemaOrReference,
//   getSwaggerVersion,
//   isArraySchemaObject,
//   isReferenceObject,
//   toNormalizedRefName,
//   toSchema,
// } from '../../../elements/swagger/type_elements/swagger_parser'
// import { LoadedSwagger } from '../../../elements/swagger/swagger'
// import { InstanceFetchApiDefinitions } from '../../definitions/system/fetch'

// const log = logger(module)
// const { isDefined } = values

// const isSingleItemEndpoint = (endpoint: string): boolean => new RegExp(/\/\{[^}]+\}$/).test(endpoint)

// const isDependentEndpoint = (endpoint: string): boolean => new RegExp(/\{[^}]+\}/).test(endpoint)

// const getParentEndpoint = (endpoint: string): string => {
//   const parts = endpoint.split('/')
//   const lastParam = _(parts).findLastIndex(part => new RegExp(/\{[^}]+\}/).test(part))
//   if (lastParam !== -1) {
//     return parts.slice(0, lastParam).join('/')
//   }
//   return endpoint
// }

// const extractLastArg = (endpoint: string): string | undefined => {
//   const parts = endpoint.split('/')
//   const lastParamIdx = _(parts).findLastIndex(part => new RegExp(/\{[^}]+\}/).test(part))
//   if (lastParamIdx !== -1) {
//     const match = parts[lastParamIdx].match(/\{([^}]+)\}/)
//     return match ? match[1] : undefined
//   }
//   return undefined
// }

// const toMatchingSchemaName = (schema: SchemaOrReference): string | undefined => {
//   if (schema === undefined) {
//     // TODOS check how do we get here
//     return undefined
//   }
//   if (isArraySchemaObject(schema)) {
//     return toMatchingSchemaName(schema.items)
//   }
//   if (isReferenceObject(schema)) {
//     return toNormalizedRefName(schema)
//   }
//   log.error(`unsupported schema type ${safeJsonStringify(schema)}`)
//   return undefined
// }

// // const createDependencyGraph = (endpointsByParent: Record<string, string[]>): DAG<undefined> => {
// //   const graph = new DAG<undefined>()
// //   Object.entries(endpointsByParent).forEach(([parent, children]) => {
// //     const childrenEndpoints = children.filter(child => child !== parent)
// //     graph.addNode(parent, childrenEndpoints, undefined)
// //   })
// //   return graph
// // }

// const createDependencyGraphV2 = (endpointsByParent: Record<string, string[]>): DAG<undefined> => {
//   const graph = new DAG<undefined>()
//   Object.entries(endpointsByParent).forEach(([parent, children]) => {
//     const childrenEndpoints = children.filter(child => child !== parent)
//     childrenEndpoints.forEach(child => graph.addEdge(child, parent))
//   })
//   return graph
// }

// // export const getSwaggerDependencies = async (swaggerPath: string): Promise<SwaggerRefs> => {

// //   // const getRecurseIntoDefs = (dependencies: string[]): unknown => {
// //   //   // TODOSSSS implement!
// //   //   const recurseInto = dependencies.map(dep => {
// //   //     const paramName = dep.split('/').pop() ?? '' // TODO modify
// //   //     return ({
// //   //     typeName: '',
// //   //     context: {
// //   //       args: { [paramName]: { fromField: 'id' } },
// //   //     }
// //   //   })})
// //   //   return {}
// //   // }

// //   const swagger = await loadSwagger(swaggerPath)
// //   const swaggerVersion = getSwaggerVersion(swagger)
// //   const endpoints = Object.fromEntries(
// //     Object.entries(swagger.document.paths).filter(([url, def]) => isDefined(def.get) && !isSingleItemEndpoint(url)),
// //   )

// //   const endpointsByParent = _.groupBy(Object.keys(endpoints), getParentEndpoint)
// //   log.debug('parsing swagger dependencies', endpointsByParent.length, swaggerVersion)

// //   const graph = createDependencyGraph(endpointsByParent)
// //   const defs: Record<string, unknown> = {}
// //   graph.walkSync(nodeId => {
// //     const swaggerDefs = endpoints[nodeId.toString()]?.get?.responses?.[200]
// //     const schema = toSchema(swaggerVersion, swaggerDefs)
// //     const dependencies = graph.get(nodeId)
// //     log.debug('node %s has dependencies %o', nodeId, dependencies)
// //     if (schema === undefined) {
// //       return
// //     }
// //     // create single item definitions
// //     const typeName = toMatchingSchemaName(schema)
// //     if (!typeName) {
// //       return
// //     }
// //     defs[typeName] = {
// //       requests: [
// //         {
// //           endpoint: { path: nodeId.toString() },
// //           transformation: {
// //             // TODOS get dataField
// //             // root: '.'
// //           },
// //         },
// //       ],
// //       resource: {
// //         directFetch: graph.isFreeNode(nodeId),
// //         recurseInto: {
// //           // TODO
// //           // ...(dependencies.length > 0 ? getRecurseIntoDefs(dependencies) : {}),
// //         },
// //       },
// //       element: {
// //         topLevel: {
// //           isTopLevel: true,
// //         },
// //         fieldCustomizations: {
// //           // TODO
// //           // getStandaloneInstanceDefs,
// //         },
// //       },
// //     }
// //   })
// //   // const fetchDefs =
// //   return swagger.parser.$refs
// // }

// /*
//  * Converts swagger spec to request definitions
//  * if includeSubResources is true, recurseInto definitions will be added
//  */
// // TODOS - use getDataSchema inorder to recurseInto to the correct type
// export const getResourceDef = ({
//   loadedSwagger,
//   defs = {},
//   types,
//   includeSubResources,
// }: {
//   loadedSwagger: LoadedSwagger
//   defs?: Record<string, InstanceFetchApiDefinitions>
//   types?: string[]
//   includeSubResources?: boolean
// }): Record<string, Pick<InstanceFetchApiDefinitions, 'resource'>> => {
//   log.debug('creating fetch request definitions for types %o, %s', types, includeSubResources)
//   const swaggerVersion = getSwaggerVersion(loadedSwagger)
//   const endpointsBySchema: Record<string, SchemaOrReference> = Object.fromEntries(
//     Object.entries(loadedSwagger.document.paths)
//       .filter(([url, def]) => isDefined(def.get) && !isSingleItemEndpoint(url))
//       .map(([url, def]) => [url, toSchema(swaggerVersion, def.get.responses[200])])
//       .filter(([_url, schema]) => isDefined(schema)),
//   )

//   const [dependentEndpoints, independentEndpoints] = _.partition(Object.entries(endpointsBySchema), ([url, _schema]) =>
//     isDependentEndpoint(url),
//   )
//   const updatedDefs = { ...defs }
//   independentEndpoints.forEach(([_url, schema]) => {
//     const typeName = toMatchingSchemaName(schema)
//     if (!typeName) {
//       return
//     }
//     if (updatedDefs[typeName] === undefined) {
//       Object.assign(updatedDefs, { [typeName]: { resource: { directFetch: true } } })
//     }
//     updatedDefs[typeName].resource = { directFetch: true, ...updatedDefs[typeName].resource }
//   })

//   if (!includeSubResources) {
//     return updatedDefs
//   }

//   // const dependentEndpointsByParent = _.groupBy(Object.keys(Object.fromEntries(dependentEndpoints)), endpoint => getParentEndpoint(endpoint))
//   const dependentEndpointsByParent = _.groupBy(Object.keys(endpointsBySchema), endpoint => getParentEndpoint(endpoint))
//   const graph = createDependencyGraphV2(dependentEndpointsByParent)
//   wu(graph.evaluationOrder()).forEach(nodeId => {
//     const schema = endpointsBySchema[nodeId.toString()]
//     const resourceTypeName = toMatchingSchemaName(schema)
//     if (!resourceTypeName) {
//       return
//     }
//     const dependencies = graph.getReverse(nodeId)
//     dependencies.forEach(dep => {
//       // update sub resource defeinitions
//       const dependencyTypeName = toMatchingSchemaName(endpointsBySchema[dep])
//       if (!dependencyTypeName) {
//         return
//       }
//       if (updatedDefs[dependencyTypeName] === undefined) {
//         Object.assign(updatedDefs, { [dependencyTypeName]: { resource: { directFetch: false } } })
//       }
//       updatedDefs[dependencyTypeName].resource = { directFetch: false, ...updatedDefs[dependencyTypeName].resource }
//       const lastEndpointParam = extractLastArg(dep.toString())
//       if (lastEndpointParam !== undefined) {
//         // update the parent resource definition
//         const recurseIntoDef = {
//           [dependencyTypeName]: {
//             typeName: dependencyTypeName,
//             context: { args: { [lastEndpointParam]: { fromField: 'id' } } },
//           },
//         }
//         // TODO add to resourceDef.resource.recurseInto the new recurseIntoDef
//         const nodeResouceDef = updatedDefs[resourceTypeName].resource
//         if (nodeResouceDef !== undefined) {
//           Object.assign(nodeResouceDef, {
//             ...nodeResouceDef,
//             recurseInto: { ...nodeResouceDef.recurseInto, ...recurseIntoDef },
//           })
//         }
//       }
//     })
//   })
//   log.debug('creating subresource fetch request definitions for types %o', dependentEndpoints)
//   return updatedDefs
// }
