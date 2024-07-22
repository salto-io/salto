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
import {
  Element,
  isObjectType,
  ReferenceExpression,
  ElemID,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  collections,
  values as lowerDashValues,
  multiIndex,
} from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  buildElementsSourceFromElements,
  extendGeneratedDependencies,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { getAllReferencedIds } from '@salto-io/adapter-components'
import { RemoteFilterCreator } from '../filter'
import {
  metadataType,
  apiName,
  isCustomObject,
} from '../transformers/transformer'
import SalesforceClient from '../client/client'
import {
  getInternalId,
  buildElementsSourceForFetch,
  extractFlatCustomObjectFields,
  hasInternalId,
  ensureSafeFilterFetch,
  isStandardObjectSync,
  apiNameSync,
} from './utils'

const { awu, toArrayAsync } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

const STANDARD_ENTITY_TYPES = ['StandardEntity', 'User']

// temporary workaround for SALTO-1162 until we switch to using bulk api v2 -
// there is a max of 2000 entries returned per query, so we separate the heavy
// types to their own queries to increase the limit (may extend / make this dynamic in the future)
const REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY = [
  'Layout',
  'Flow',
  'ApexClass',
  'ApexPage',
  'CustomField',
]

// The current limit for using Bulk API V1 to query Tooling Records
const TOOLING_QUERY_MAX_RECORDS = 2000
const INITIAL_QUERY_CHUNK_SIZE = 500

type DependencyDetails = {
  type: string
  id: string
  name: string
}

type DependencyGroup = {
  from: DependencyDetails
  to: DependencyDetails[]
}

type Dependency = {
  from: DependencyDetails
  to: DependencyDetails
}

type QueryDepsParams = {
  client: SalesforceClient
  elements: Element[]
}

/**
 * Get a list of known dependencies between metadata components.
 */

const createQueries = (
  whereClauses: string[],
  toolingDepsOfCurrentNamespace: boolean,
  orgNamespace: string | undefined,
): string[] => {
  const baseQueries = whereClauses.map(
    (clause) => `SELECT 
    MetadataComponentId, MetadataComponentType, MetadataComponentName, 
    RefMetadataComponentId, RefMetadataComponentType, RefMetadataComponentName 
  FROM MetadataComponentDependency WHERE ${clause}`,
  )
  if (!toolingDepsOfCurrentNamespace) {
    return baseQueries
  }
  const nonNamespaceDepsQueries = baseQueries.map(
    (query) => `${query} AND MetadataComponentNamespace = '${orgNamespace}'`,
  )
  const namespaceDepsQueries = baseQueries.map(
    (query) => `${query} AND MetadataComponentNamespace != '${orgNamespace}'`,
  )
  return nonNamespaceDepsQueries.concat(namespaceDepsQueries)
}

const getDependencies = async (
  client: SalesforceClient,
  toolingDepsOfCurrentNamespace: boolean,
): Promise<DependencyGroup[]> => {
  const allTypes = REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY.map(
    (t) => `'${t}'`,
  ).join(', ')
  const whereClauses = [
    ...REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY.map(
      (t) => `MetadataComponentType='${t}'`,
    ),
    `MetadataComponentType NOT IN (${allTypes})`,
  ]
  const allQueries = createQueries(
    whereClauses,
    toolingDepsOfCurrentNamespace,
    client.orgNamespace,
  )
  const allDepsIters = await Promise.all(
    allQueries.map((q) => client.queryAll(q, true)),
  )

  const queriesRecordsCount: number[] = []
  const allDepsResults = allDepsIters.map((iter) =>
    collections.asynciterable.mapAsync(iter, (recs) => {
      queriesRecordsCount.push(recs.length)
      return recs.map((rec) => ({
        from: {
          type: rec.MetadataComponentType,
          id: rec.MetadataComponentId,
          name: rec.MetadataComponentName,
        },
        to: {
          type: rec.RefMetadataComponentType,
          id: rec.RefMetadataComponentId,
          name: rec.RefMetadataComponentName,
        },
      }))
    }),
  )

  const deps = (
    await Promise.all(
      allDepsResults.map(async (res) =>
        (await collections.asynciterable.toArrayAsync(res)).flat(),
      ),
    )
  ).flat()

  log.debug('extra dependencies queries info: %o', {
    queries: allQueries,
    counts: queriesRecordsCount,
  })

  return _.values(_.groupBy(deps, (dep) => Object.entries(dep.from))).map(
    (depArr) => ({
      from: depArr[0].from,
      to: depArr.map((dep) => dep.to),
    }),
  )
}

const queryDeps = async ({
  client,
  elements,
}: QueryDepsParams): Promise<Dependency[]> => {
  const elementsByMetadataComponentId = _.keyBy(
    elements.filter(hasInternalId),
    getInternalId,
  )
  // The MetadataComponentId of standard objects is the object name
  elements.filter(isStandardObjectSync).forEach((standardObject) => {
    const objectName = apiNameSync(standardObject)
    if (objectName !== undefined) {
      elementsByMetadataComponentId[objectName] = standardObject
    }
  })
  if (Object.keys(elementsByMetadataComponentId).length === 0) {
    log.debug('No elements to query dependencies for')
    return []
  }
  let queriesExecuted = 0
  const errorIds = new Set<string>()
  const chunkedQuery = async (
    ids: string[],
    chunkSize: number,
  ): Promise<Dependency[]> =>
    (
      await Promise.all(
        _.chunk(ids, chunkSize).map(async (idsChunk) => {
          const query = `SELECT 
    MetadataComponentId, MetadataComponentType, MetadataComponentName, 
    RefMetadataComponentId, RefMetadataComponentType, RefMetadataComponentName 
  FROM MetadataComponentDependency WHERE MetadataComponentId IN (${idsChunk.map((id) => `'${id}'`).join(', ')})`
          const allRecords = (
            await toArrayAsync(await client.queryAll(query, true))
          ).flat()
          queriesExecuted += 1
          if (allRecords.length === TOOLING_QUERY_MAX_RECORDS) {
            // A single Element has more than 2000 dependencies
            if (chunkSize === 1) {
              errorIds.add(idsChunk[0])
            } else {
              return chunkedQuery(
                idsChunk,
                Math.ceil(Math.ceil(idsChunk.length / 2)),
              )
            }
          }
          return allRecords.map((rec) => ({
            from: {
              type: rec.MetadataComponentType,
              id: rec.MetadataComponentId,
              name: rec.MetadataComponentName,
            },
            to: {
              type: rec.RefMetadataComponentType,
              id: rec.RefMetadataComponentId,
              name: rec.RefMetadataComponentName,
            },
          }))
        }),
      )
    ).flat()
  const deps = await chunkedQuery(
    Object.keys(elementsByMetadataComponentId),
    INITIAL_QUERY_CHUNK_SIZE,
  )
  if (errorIds.size > 0) {
    log.error(
      'Could not add all the dependencies on the following elements since they have more than 2000 dependencies: %s',
      Array.from(errorIds)
        .map((id) => elementsByMetadataComponentId[id]?.elemID.getFullName())
        .join(', '),
    )
  }
  log.debug(
    'query extra dependencies info: %s',
    safeJsonStringify({
      queriesExecuted,
      idsCount: Object.keys(elementsByMetadataComponentId).length,
      totalQueriedDependencies: deps.length,
    }),
  )
  return deps
}

const getDependenciesV2 = async (
  params: QueryDepsParams,
): Promise<DependencyGroup[]> => {
  const deps = await queryDeps(params)
  return _.values(_.groupBy(deps, (dep) => Object.entries(dep.from))).map(
    (depArr) => ({
      from: depArr[0].from,
      to: depArr.map((dep) => dep.to),
    }),
  )
}

/**
 * Add references to the generated-dependencies annotation,
 * except for those already referenced elsewhere.
 *
 * @param elem        The element to modify
 * @param refElemIDs  The reference ids to add
 */
const addGeneratedDependencies = async (
  elem: Element,
  refElemIDs: ElemID[],
): Promise<ReferenceExpression[]> => {
  if (refElemIDs.length === 0) {
    return []
  }

  const existingReferences = await getAllReferencedIds(elem)
  const newDependencies = refElemIDs
    .filter((elemId) => !existingReferences.has(elemId.getFullName()))
    .map((elemId) => new ReferenceExpression(elemId))

  if (newDependencies.length !== 0) {
    extendGeneratedDependencies(
      elem,
      newDependencies.map((reference) => ({ reference })),
    )
  }
  return newDependencies
}

/**
 * Add an annotation with the references that are not already represented more granularly
 * in the element.
 *
 * @param groupedDeps         All dependencies, grouped by src
 * @param elemLookup          Element lookup by type and internal salesforce id
 * @param customObjectLookup  Element lookup for custom objects
 */
const addExtraReferences = async (
  groupedDeps: DependencyGroup[],
  fetchedElements: ReadOnlyElementsSource,
  elemLookup: multiIndex.Index<[string, string], ElemID>,
  customObjectLookup: multiIndex.Index<[string], ElemID>,
): Promise<void> => {
  const getElemId = ({ type, id }: DependencyDetails): ElemID | undefined => {
    // Special case handling:
    // - standard entities are returned with type=StandardEntity and id=<entity name>
    // - User is returned with type=User and id=User
    if (STANDARD_ENTITY_TYPES.includes(type)) {
      return customObjectLookup.get(id)
    }
    return elemLookup.get(type, id)
  }

  const getFetchedElement = async (
    elemId: ElemID,
  ): Promise<Element | undefined> => {
    if (elemId.idType !== 'field') {
      return fetchedElements.get(elemId)
    }
    const elem = await fetchedElements.get(elemId.createParentID())
    return isObjectType(elem) ? elem.fields[elemId.name] : undefined
  }

  const addedDeps: ReferenceExpression[] = (
    await awu(groupedDeps)
      .map(async (edge) => {
        const elemId = getElemId(edge.from)
        if (elemId === undefined) {
          log.debug(
            'Element %s:%s (%s) no found, skipping %d dependencies',
            edge.from.type,
            edge.from.id,
            edge.from.name,
            edge.to.length,
          )
          return []
        }
        const elem = await getFetchedElement(elemId)
        if (elem === undefined) {
          log.debug(
            'Element %s was not fetched in this operation, skipping %d dependencies',
            elemId.getFullName(),
            edge.to.length,
          )
          return []
        }
        const dependencies = edge.to.map((dst) => ({
          dep: dst,
          elemId: getElemId(dst),
        }))
        const missingDeps = dependencies
          .filter((item) => item.elemId === undefined)
          .map((item) => item.dep)
        missingDeps.forEach((dep) => {
          log.debug(
            `Referenced element ${dep.type}:${dep.id} (${dep.name}) not found for ${elem.elemID.getFullName()}`,
          )
        })

        return addGeneratedDependencies(
          elem,
          dependencies.map((item) => item.elemId).filter(isDefined),
        )
      })
      .toArray()
  ).flat()
  log.debug('Added %d extra dependencies', addedDeps.length)
}

export const WARNING_MESSAGE =
  'Encountered an error while trying to query your salesforce account for additional configuration dependencies.'

/**
 * Add references using the tooling API.
 */
const creator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'extraDependenciesFilter',
  remote: true,
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'extraDependencies',
    fetchFilterFunc: async (elements: Element[]) => {
      const groupedDeps = config.fetchProfile.isFeatureEnabled(
        'extraDependenciesV2',
      )
        ? await getDependenciesV2({ client, elements })
        : await getDependencies(
            client,
            config.fetchProfile.isFeatureEnabled(
              'toolingDepsOfCurrentNamespace',
            ),
          )
      const fetchedElements = buildElementsSourceFromElements(elements)
      const allElements = buildElementsSourceForFetch(elements, config)

      const { elemLookup, customObjectLookup } = await multiIndex
        .buildMultiIndex<Element>()
        .addIndex({
          name: 'elemLookup',
          filter: hasInternalId,
          key: async (elem) => [await metadataType(elem), getInternalId(elem)],
          map: (elem) => elem.elemID,
        })
        .addIndex({
          name: 'customObjectLookup',
          filter: async (elem) => isCustomObject(elem),
          key: async (elem) => [await apiName(elem)],
          map: (elem) => elem.elemID,
        })
        .process(
          awu(await allElements.getAll()).flatMap(
            extractFlatCustomObjectFields,
          ),
        )

      await addExtraReferences(
        groupedDeps,
        fetchedElements,
        elemLookup,
        customObjectLookup,
      )
    },
  }),
})

export default creator
