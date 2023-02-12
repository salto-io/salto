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
import {
  Element, isObjectType, ReferenceExpression, ElemID, ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { collections, values as lowerDashValues, multiIndex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { getAllReferencedIds, buildElementsSourceFromElements, extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { RemoteFilterCreator } from '../filter'
import { metadataType, apiName, isCustomObject } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { getInternalId, buildElementsSourceForFetch, extractFlatCustomObjectFields, hasInternalId, ensureSafeFilterFetch } from './utils'

const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues
const log = logger(module)

const STANDARD_ENTITY_TYPES = ['StandardEntity', 'User']

// temporary workaround for SALTO-1162 until we switch to using bulk api v2 -
// there is a max of 2000 entries returned per query, so we separate the heavy
// types to their own queries to increase the limit (may extend / make this dynamic in the future)
const REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY = ['Layout', 'Flow', 'ApexClass', 'ApexPage', 'CustomField']

type DependencyDetails = {
  type: string
  id: string
  name: string
}

type DependencyGroup = {
  from: DependencyDetails
  to: DependencyDetails[]
}

/**
 * Get a list of known dependencies between metadata components.
 *
 * @param client  The client to use to run the query
 */
const getDependencies = async (client: SalesforceClient): Promise<DependencyGroup[]> => {
  const allTypes = REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY.map(t => `'${t}'`).join(', ')
  const whereClauses = [
    ...REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY.map(t => `MetadataComponentType='${t}'`),
    `MetadataComponentType NOT IN (${allTypes})`,
  ]
  const allQueries = whereClauses.map(clause => `SELECT 
    MetadataComponentId, MetadataComponentType, MetadataComponentName, 
    RefMetadataComponentId, RefMetadataComponentType, RefMetadataComponentName 
  FROM MetadataComponentDependency WHERE ${clause}`)
  const allDepsIters = await Promise.all(allQueries.map(q => client.queryAll(q, true)))

  const allDepsResults = allDepsIters.map(iter => collections.asynciterable.mapAsync(
    iter,
    recs => recs.map(rec => ({
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
  ))

  const deps = (await Promise.all(allDepsResults.map(
    async res => (await collections.asynciterable.toArrayAsync(res)).flat()
  ))).flat()
  return _.values(
    _.groupBy(deps, dep => Object.entries(dep.from))
  ).map(depArr => ({
    from: depArr[0].from,
    to: depArr.map(dep => dep.to),
  }))
}

/**
 * Add references to the generated-dependencies annotation,
 * except for those already referenced elsewhere.
 *
 * @param elem        The element to modify
 * @param refElemIDs  The reference ids to add
 */
const addGeneratedDependencies = (elem: Element, refElemIDs: ElemID[]): void => {
  if (refElemIDs.length === 0) {
    return
  }

  const existingReferences = getAllReferencedIds(elem)
  const newDependencies = refElemIDs
    .filter(elemId => !existingReferences.has(elemId.getFullName()))
    .map(elemId => new ReferenceExpression(elemId))

  if (newDependencies.length !== 0) {
    extendGeneratedDependencies(
      elem,
      newDependencies.map(reference => ({ reference })),
    )
  }
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

  const getFetchedElement = async (elemId: ElemID): Promise<Element | undefined> => {
    if (elemId.idType !== 'field') {
      return fetchedElements.get(elemId)
    }
    const elem = await fetchedElements.get(elemId.createParentID())
    return isObjectType(elem)
      ? elem.fields[elemId.name]
      : undefined
  }

  await awu(groupedDeps).forEach(async edge => {
    const elemId = getElemId(edge.from)
    if (elemId === undefined) {
      log.debug(
        'Element %s:%s (%s) no found, skipping %d dependencies',
        edge.from.type, edge.from.id, edge.from.name, edge.to.length,
      )
      return
    }
    const elem = await getFetchedElement(elemId)
    if (elem === undefined) {
      log.debug(
        'Element %s was not fetched in this operation, skipping %d dependencies',
        elemId.getFullName(), edge.to.length,
      )
      return
    }
    const dependencies = edge.to.map(dst => ({ dep: dst, elemId: getElemId(dst) }))
    const missingDeps = dependencies
      .filter(item => item.elemId === undefined)
      .map(item => item.dep)
    missingDeps.forEach(dep => {
      log.debug(`Referenced element ${dep.type}:${dep.id} (${dep.name}) not found for ${
        elem.elemID.getFullName()}`)
    })

    addGeneratedDependencies(
      elem,
      dependencies.map(item => item.elemId).filter(isDefined),
    )
  })
}

export const WARNING_MESSAGE = 'Encountered an error while trying to query your salesforce account for additional configuration dependencies.'

/**
 * Add references using the tooling API.
 */
const creator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'extraDependenciesFilter',
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'extraDependencies',
    fetchFilterFunc: async (elements: Element[]) => {
      const groupedDeps = await getDependencies(client)
      const fetchedElements = buildElementsSourceFromElements(elements)
      const allElements = buildElementsSourceForFetch(elements, config)

      const { elemLookup, customObjectLookup } = await multiIndex.buildMultiIndex<Element>()
        .addIndex({
          name: 'elemLookup',
          filter: hasInternalId,
          key: async elem => [await metadataType(elem), getInternalId(elem)],
          map: elem => elem.elemID,
        })
        .addIndex({
          name: 'customObjectLookup',
          filter: async elem => isCustomObject(elem),
          key: async elem => [await apiName(elem)],
          map: elem => elem.elemID,
        })
        .process(awu(await allElements.getAll()).flatMap(extractFlatCustomObjectFields))

      await addExtraReferences(groupedDeps, fetchedElements, elemLookup, customObjectLookup)
    },
  }),
})

export default creator
