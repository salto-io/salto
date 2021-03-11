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
import {
  Element, isInstanceElement, InstanceElement, ElemID, isReferenceExpression, ReferenceExpression,
  PostFetchOptions, isObjectType, ObjectType, Field, Value,
} from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { transformElement, TransformFunc, safeJsonStringify, setPath, extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { FETCH_CONFIG } from '../../config'
import { CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS } from '../../constants'
import { indexSalesforceByMetadataTypeAndApiName, indexNetsuiteByTypeAndScriptId, NetsuiteIndex, SalesforceIndex } from './element_indexes'
import { isNetsuiteBlock, isSalesforceBlock, NetsuiteBlock, SalesforceBlock } from './recipe_block_types'

const log = logger(module)
const { isDefined } = lowerdashValues
const { toNestedTypeName } = elementUtils.ducktype

type MappedReference = {
  srcPath: ElemID | undefined
  ref: ReferenceExpression
}

type ReferenceFinder<T extends SalesforceBlock | NetsuiteBlock> = (
  value: T,
  path: ElemID,
) => MappedReference[]

type FormulaReferenceFinder = (
  value: string,
  path: ElemID,
) => MappedReference[]

const addReferencesForService = <T extends SalesforceBlock | NetsuiteBlock>(
  inst: InstanceElement,
  typeGuard: (value: Value) => value is T,
  addReferences: ReferenceFinder<T>,
  addFormulaReferences?: FormulaReferenceFinder,
): boolean => {
  const dependencyMapping: MappedReference[] = []

  const findReferences: TransformFunc = ({ value, path }) => {
    if (typeGuard(value)) {
      dependencyMapping.push(...addReferences(
        value,
        path ?? inst.elemID,
      ))
    }
    if (
      addFormulaReferences !== undefined
      && path !== undefined
      && _.isString(value)
    ) {
      dependencyMapping.push(...addFormulaReferences(value, path))
    }
    return value
  }

  // used for traversal, the transform result is ignored
  transformElement({
    element: inst,
    transformFunc: findReferences,
    strict: false,
  })
  if (dependencyMapping.length === 0) {
    return false
  }
  log.debug('found the following references: %s', safeJsonStringify(dependencyMapping.map(dep => [dep.srcPath?.getFullName(), dep.ref.elemId.getFullName()])))
  dependencyMapping.forEach(({ srcPath, ref }) => {
    if (srcPath !== undefined) {
      setPath(inst, srcPath, ref)
    }
  })
  extendGeneratedDependencies(inst, dependencyMapping.map(dep => dep.ref))
  return true
}

const SALESFORCE_LABEL_ANNOTATION = 'label'

const addSalesforceRecipeReferences = (
  inst: InstanceElement,
  indexedElements: SalesforceIndex,
): boolean => {
  const getObjectDetails = (objectName: string): {
    id: ElemID
    fields: Record<string, Readonly<Field>>
    label?: string
   } | undefined => {
    const refObjectFragments = (
      indexedElements.CustomObject?.[objectName] ?? indexedElements[objectName]?.[objectName]
    )
    if (refObjectFragments !== undefined && refObjectFragments.every(isObjectType)) {
      const fields: Record<string, Field> = _.assign(
        {},
        ...(refObjectFragments as ObjectType[]).map(fragment => fragment.fields),
      )
      const label = refObjectFragments.map(
        ref => ref.annotations[SALESFORCE_LABEL_ANNOTATION]
      ).find(_.isString)
      return {
        id: refObjectFragments[0].elemID,
        fields,
        label,
      }
    }
    return undefined
  }

  const referenceFinder: ReferenceFinder<SalesforceBlock> = (blockValue, path) => {
    const { dynamicPickListSelection, input } = blockValue
    const objectDetails = getObjectDetails(input.sobject_name)
    if (objectDetails === undefined) {
      return []
    }

    const references: MappedReference[] = [{
      srcPath: path.createNestedID('input', 'sobject_name'),
      ref: new ReferenceExpression(objectDetails.id),
    }]

    const inputFieldNames = Object.keys(_.omit(input, 'sobject_name'))
    inputFieldNames.forEach(fieldName => {
      if (objectDetails.fields[fieldName] !== undefined) {
        references.push(
          {
            // no srcPath because we can't override the field keys in the current format
            srcPath: undefined,
            ref: new ReferenceExpression(objectDetails.fields[fieldName].elemID),
          },
        )
      }
    })

    // dynamicPickListSelection uses the label, not the api name
    if (dynamicPickListSelection.sobject_name === objectDetails.label) {
      references.push({
        srcPath: path.createNestedID('dynamicPickListSelection', 'sobject_name'),
        ref: new ReferenceExpression(objectDetails.id),
      })

      if (dynamicPickListSelection.field_list !== undefined) {
        const potentialFields: string[] = (dynamicPickListSelection.field_list).map(
          (f: { value: string }) => f.value
        )
        potentialFields.forEach((fieldName, idx) => {
          if (objectDetails.fields[fieldName] !== undefined) {
            references.push(
              {
                srcPath: path.createNestedID('dynamicPickListSelection', 'field_list', String(idx)),
                ref: new ReferenceExpression(objectDetails.fields[fieldName].elemID),
              },
            )
          }
        })
      }
      if (dynamicPickListSelection.table_list !== undefined) {
        const potentialReferencedTypes: string[] = (dynamicPickListSelection.table_list).map(
          (f: { value: string }) => f.value
        )
        potentialReferencedTypes.forEach((typeName, idx) => {
          const refObjectDetails = getObjectDetails(typeName)
          if (refObjectDetails !== undefined) {
            references.push(
              {
                srcPath: path.createNestedID('dynamicPickListSelection', 'table_list', String(idx)),
                ref: new ReferenceExpression(refObjectDetails.id),
              },
            )
          }
        })
      }
    }
    return references
  }

  return addReferencesForService<SalesforceBlock>(inst, isSalesforceBlock, referenceFinder)
}

const addNetsuiteRecipeReferences = (
  inst: InstanceElement,
  indexedElements: NetsuiteIndex,
): boolean => {
  const referenceFinder: ReferenceFinder<NetsuiteBlock> = (blockValue, path) => {
    const references: MappedReference[] = []

    const { dynamicPickListSelection, input } = blockValue

    const addPotentialReference = (value: unknown, separator: string, nestedPath: ElemID): void => {
      if (_.isString(value) && value.split(separator).length === 2) {
        const scriptId = _.last(value.toLowerCase().split(separator))
        if (scriptId !== undefined) {
          const referencedId = indexedElements[scriptId]
          if (referencedId !== undefined) {
            references.push({
              srcPath: nestedPath,
              ref: new ReferenceExpression(referencedId),
            })
          }
        }
      }
    }

    const netsuiteObject = input?.netsuite_object
    if (netsuiteObject !== undefined) {
      addPotentialReference(netsuiteObject, '@@', path.createNestedID('input', 'netsuite_object'))
    }
    (dynamicPickListSelection.custom_list ?? []).forEach(({ value }, idx) => {
      addPotentialReference(
        value,
        '@',
        path.createNestedID('dynamicPickListSelection', 'custom_list', String(idx)),
      )
    })
    return references
  }

  const formulaReferenceFinder: FormulaReferenceFinder = value => {
    function *fieldMatcher(): Iterable<string> {
      // note: for netsuite standard fields / salesforce fields we'd need to parse the block's id
      // to know which object to look for the field under - but for custom fields we have
      // the script id which is globally unique, so we can use it directly
      const matcher = /#\{_\('data\.netsuite\.(?:\w+\.)custom_fields\.f_?(?:[0-9]+_)*(?<field>\w*)'\)\}/g
      while (true) {
        const match = matcher.exec(value)?.groups?.field
        if (match === undefined || match === null) {
          break
        }
        yield match
      }
    }
    const potentialFields = [...fieldMatcher()]
    return potentialFields.map(fieldNameScriptId => {
      const referencedId = indexedElements[fieldNameScriptId]
      if (referencedId !== undefined) {
        return {
          srcPath: undefined,
          ref: new ReferenceExpression(referencedId),
        }
      }
      return undefined
    }).filter(isDefined)
  }

  return addReferencesForService<NetsuiteBlock>(
    inst,
    isNetsuiteBlock,
    referenceFinder,
    formulaReferenceFinder,
  )
}

const toKey = (first: string, second: string): string => `${first}:${second}`

const getServiceConnectionIDs = (
  serviceConnectionNames: Record<string, string>,
  connectionInstances: InstanceElement[],
): Record<string, ElemID> => {
  const unsupportedServiceNames = Object.keys(serviceConnectionNames).filter(
    name => !Object.keys(CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS).includes(name)
  )
  if (unsupportedServiceNames.length > 0) {
    log.error('the following services are not supported, and will be ignored: %s', unsupportedServiceNames)
  }

  const connections = new Set(connectionInstances.map(
    inst => toKey(inst.value.application, inst.value.name)
  ))
  const missingConnections = Object.entries(serviceConnectionNames).filter(
    ([adapterName, connectionName]) => !connections.has(
      toKey(CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS[adapterName] ?? '', connectionName)
    )
  )
  if (missingConnections.length > 0) {
    log.error('the following services do not have any workato connections in the fetch results: %s', missingConnections)
  }

  const serviceConnectionIDs = _.pickBy(
    _.mapValues(
      _.pickBy(
        serviceConnectionNames,
        (_connectionName, adapterName) =>
          Object.values(CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS).includes(adapterName)
      ),
      (connectionName, serviceName) => _.first(connectionInstances
        .filter(inst => inst.value.name === connectionName)
        .filter(inst =>
          inst.value.application === CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS[serviceName])
        .map(inst => inst.elemID))
    ),
    isDefined,
  )

  return serviceConnectionIDs
}

/**
 * Return the code parts of recipes that use the specified connection.
 * (at most one connection for each connector can be used in each recipe using standard connectors)
 */
const filterRelevantRecipeCodes = (
  connectionID: ElemID,
  recipeInstances: InstanceElement[],
  recipeCodeInstances: Record<string, InstanceElement>,
): InstanceElement[] => {
  const relevantRecipes = (
    recipeInstances
      .filter(recipe => isReferenceExpression(recipe.value.code))
      .filter(recipe => Array.isArray(recipe.value.config) && recipe.value.config.some(
        connectionConfig => (
          _.isObjectLike(connectionConfig)
          && isReferenceExpression(connectionConfig.account_id)
          && connectionID.isEqual(connectionConfig.account_id.elemId)
        )
      ))
  )
  return relevantRecipes.map(
    recipe => recipeCodeInstances[recipe.value.code.elemId.getFullName()]
  )
}

const addReferencesForConnectionRecipes = (
  relevantRecipeCodes: InstanceElement[],
  serviceName: string,
  serviceElements: ReadonlyArray<Readonly<Element>>,
): boolean => {
  if (serviceName === CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS.salesforce) {
    const index = indexSalesforceByMetadataTypeAndApiName(serviceElements)
    const res = relevantRecipeCodes.map(
      inst => addSalesforceRecipeReferences(inst, index)
    )
    return res.some(t => t)
  }
  if (serviceName === CROSS_SERVICE_REFERENCE_SUPPORTED_ADAPTERS.netsuite) {
    const index = indexNetsuiteByTypeAndScriptId(serviceElements)
    const res = relevantRecipeCodes.map(
      inst => addNetsuiteRecipeReferences(inst, index)
    )
    return res.some(t => t)
  }

  log.debug('unsupported service name %s, not resolving recipe references', serviceName)
  return false
}

/**
 * Find references from recipe code blocks to other adapters in the workspace.
 */
const filter: FilterCreator = ({ config }) => ({
  onPostFetch: async ({
    currentAdapterElements,
    elementsByAdapter,
  }: PostFetchOptions): Promise<boolean> => {
    const { serviceConnectionNames } = config[FETCH_CONFIG]
    if (serviceConnectionNames === undefined || _.isEmpty(serviceConnectionNames)) {
      return false
    }

    const serviceConnections = getServiceConnectionIDs(
      serviceConnectionNames,
      currentAdapterElements
        .filter(isInstanceElement)
        .filter(inst => inst.type.elemID.name === 'connection'),
    )
    const recipeInstances = (
      currentAdapterElements
        .filter(isInstanceElement)
        .filter(inst => inst.type.elemID.name === 'recipe')
    )
    const recipeCodeInstancesByElemID = _.keyBy(
      currentAdapterElements
        .filter(isInstanceElement)
        .filter(inst => inst.type.elemID.name === toNestedTypeName('recipe', 'code')),
      inst => inst.elemID.getFullName()
    )

    const updateResults = Object.entries(serviceConnections).map(([serviceName, connectionID]) => {
      const relevantRecipeCodes = filterRelevantRecipeCodes(
        connectionID,
        recipeInstances,
        recipeCodeInstancesByElemID,
      )
      return addReferencesForConnectionRecipes(
        relevantRecipeCodes,
        serviceName,
        elementsByAdapter[serviceName] ?? [],
      )
    })
    return updateResults.some(t => t)
  },
})

export default filter
