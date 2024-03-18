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
import wu from 'wu'
import {
  Element,
  isInstanceElement,
  isReferenceExpression,
  InstanceElement,
  ElemID,
  ElemIdGetter,
  ReferenceExpression,
  isTemplateExpression,
} from '@salto-io/adapter-api'
import {
  filter,
  getParents,
  setPath,
  walkOnElement,
  WalkOnFunc,
  WALK_NEXT_STEP,
  resolvePath,
  createTemplateExpression,
  transformElement,
  references,
} from '@salto-io/adapter-utils'
import { DAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { FilterOptions } from '../filter_utils'
import { dereferenceFieldName, isReferencedIdField } from '../config'
import { DefQuery, queryWithDefault } from '../definitions'
import { InstanceFetchApiDefinitions } from '../definitions/system/fetch'
import { getInstanceCreationFunctions } from '../fetch/element/instance_utils'

const { findDuplicates } = collections.array
const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues
const { createReferencesTransformFunc } = references

const getFirstParent = (instance: InstanceElement): InstanceElement | undefined => {
  const parentsElemIds = getParents(instance)
    .filter(parent => isReferenceExpression(parent) && isInstanceElement(parent.value))
    .map(parent => parent.value)
  // we are only using the first parent ElemId
  return parentsElemIds.length > 0 ? parentsElemIds[0] : undefined
}

/* Finds all elemIDs that the current instance relies on based on the idFields */
const getInstanceNameDependencies = (
  instance: InstanceElement,
  idFields: string[],
  extendsParentId?: boolean,
): string[] => {
  const referencedInstances = idFields
    .filter(isReferencedIdField)
    .map(fieldName => {
      const fieldValue = _.get(instance.value, dereferenceFieldName(fieldName))
      if (isReferenceExpression(fieldValue) && fieldValue.elemID.idType === 'instance') {
        return fieldValue.elemID.createTopLevelParentID().parent.getFullName()
      }
      return undefined
    })
    .filter(isDefined)
  const parentFullName = getFirstParent(instance)?.elemID?.getFullName()
  if (extendsParentId && parentFullName !== undefined) {
    referencedInstances.push(parentFullName)
  }
  return referencedInstances
}

const isReferenceOfSomeElement = (reference: ReferenceExpression, instancesFullName: Set<string>): boolean =>
  instancesFullName.has(reference.elemID.createTopLevelParentID().parent.getFullName())

const getReferencesToElemIds = (
  element: Element,
  instancesNamesToRename: Set<string>,
): { path: ElemID; value: ReferenceExpression }[] => {
  const refs: { path: ElemID; value: ReferenceExpression }[] = []
  const findReferences: WalkOnFunc = ({ path, value }) => {
    if (isTemplateExpression(value)) {
      const partsWithReferences = value.parts
        .filter(isReferenceExpression)
        .filter(part => isReferenceOfSomeElement(part, instancesNamesToRename))
      if (partsWithReferences.length > 0) {
        partsWithReferences.forEach(part => refs.push({ path, value: part }))
        return WALK_NEXT_STEP.SKIP
      }
    }
    if (isReferenceExpression(value) && isReferenceOfSomeElement(value, instancesNamesToRename)) {
      refs.push({ path, value })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func: findReferences })
  return refs
}

/* Create new instance with the new naclName and file path */
const createNewInstance = async (
  currentInstance: InstanceElement,
  newNaclName: string,
  newFilePath: string[],
): Promise<InstanceElement> => {
  const { adapter, typeName } = currentInstance.elemID
  const newElemId = new ElemID(adapter, typeName, 'instance', newNaclName)
  const updatedInstance = await transformElement({
    element: currentInstance,
    transformFunc: createReferencesTransformFunc(currentInstance.elemID, newElemId),
    strict: false,
  })
  return new InstanceElement(
    newElemId.name,
    updatedInstance.refType,
    updatedInstance.value,
    newFilePath,
    updatedInstance.annotations,
  )
}

/* Creates the same nested path under the updated instance */
const createUpdatedPath = (oldPath: ElemID, updatedInstance: InstanceElement): ElemID => {
  const { path } = oldPath.createBaseID()
  return updatedInstance.elemID.createNestedID(...path)
}

/* Update all references for all the renamed instances with the new elemIds */
const updateAllReferences = ({
  referenceIndex,
  instanceOriginalName,
  nameToInstance,
  newInstance,
}: {
  referenceIndex: Record<string, { path: ElemID; value: ReferenceExpression }[]>
  instanceOriginalName: string
  nameToInstance: Record<string, InstanceElement>
  newInstance: InstanceElement
}): void => {
  const referencesToChange = referenceIndex[instanceOriginalName]
  if (referencesToChange === undefined || referencesToChange.length === 0) {
    return
  }
  const updatedReferenceMap = new Map<string, ReferenceExpression>()
  referencesToChange.forEach(ref => {
    const referenceValueFullName = ref.value.elemID.getFullName()
    if (!updatedReferenceMap.has(referenceValueFullName)) {
      updatedReferenceMap.set(
        referenceValueFullName,
        new ReferenceExpression(
          // reference might not be to the top level instance
          newInstance.elemID.createNestedID(...ref.value.elemID.createTopLevelParentID().path),
          newInstance,
        ),
      )
    }
    const updatedReference = updatedReferenceMap.get(referenceValueFullName)
    const topLevelInstance = nameToInstance[ref.path.createTopLevelParentID().parent.getFullName()]
    if (topLevelInstance !== undefined) {
      // update the path so it would match the new instance
      const updatedPath = createUpdatedPath(ref.path, topLevelInstance as InstanceElement)
      const oldValue = resolvePath(topLevelInstance, updatedPath)
      if (isTemplateExpression(oldValue)) {
        // update only the relevant parts
        const updatedTemplate = createTemplateExpression({
          parts: oldValue.parts
            .map(part =>
              isReferenceExpression(part) && part.elemID.getFullName() === instanceOriginalName
                ? updatedReference
                : part,
            )
            .filter(isDefined),
        })
        setPath(topLevelInstance, updatedPath, updatedTemplate)
        return
      }
      setPath(topLevelInstance, updatedPath, updatedReference)
    }
  })
  // We changed all the references to the original instance, so this entry can be removed
  delete referenceIndex[instanceOriginalName]
}

/* Create a graph with instance names as nodes and instance name dependencies as edges */
const createGraph = <ClientOptions extends string = 'main'>(
  instances: InstanceElement[],
  fetchDefinitionInstanceName: Record<string, InstanceFetchApiDefinitions<ClientOptions>>,
): DAG<InstanceElement> => {
  const duplicateElemIds = new Set(findDuplicates(instances.map(i => i.elemID.getFullName())))
  const duplicateIdsToLog = new Set<string>()
  const isDuplicateInstance = (instanceFullName: string): boolean => {
    if (duplicateElemIds.has(instanceFullName)) {
      duplicateIdsToLog.add(instanceFullName)
      return true
    }
    return false
  }

  const graph = new DAG<InstanceElement>()
  instances.forEach(instance => {
    const def = fetchDefinitionInstanceName[instance.elemID.getFullName()]
    const parts = def?.element?.topLevel?.elemID?.parts ?? []
    const extendsParent = def?.element?.topLevel?.elemID?.extendsParent
    if (extendsParent || parts.some(part => part.isReference)) {
      // removing duplicate elemIDs to create a graph
      // we can traverse based on references to unique elemIDs
      if (!isDuplicateInstance(instance.elemID.getFullName())) {
        const nameDependencies = getInstanceNameDependencies(
          instance,
          parts.map(part => part.fieldName),
          extendsParent,
        ).filter(instanceName => !isDuplicateInstance(instanceName))
        graph.addNode(instance.elemID.getFullName(), nameDependencies, instance)
      }
    }
  })

  if (duplicateIdsToLog.size > 0) {
    log.warn(`Duplicate instance names were found:${Array.from(duplicateIdsToLog).join(', ')}`)
  }
  return graph
}

export const createReferenceIndex = (
  allInstances: InstanceElement[],
  instancesNamesToRename: Set<string>,
): Record<string, { path: ElemID; value: ReferenceExpression }[]> => {
  const allReferences = allInstances.flatMap(instance => getReferencesToElemIds(instance, instancesNamesToRename))
  const referenceIndex = _(allReferences)
    .groupBy(({ value }) => value.elemID.createTopLevelParentID().parent.getFullName())
    .value()
  return referenceIndex
}

/*
 * Utility function that finds instance elements whose id relies on the ids of other instances,
 * and replaces them with updated instances with the correct id and file path.
 */
export const addReferencesToInstanceNames = async <ClientOptions extends string = 'main'>(
  elements: Element[],
  defQuery: DefQuery<InstanceFetchApiDefinitions<ClientOptions>, string>,
  getElemIdFunc?: ElemIdGetter,
): Promise<Element[]> => {
  const instances = elements.filter(isInstanceElement)
  const fetchDefinitionByType = defQuery.getAll()
  const nameToInstance = _.keyBy(instances, i => i.elemID.getFullName())
  const instanceNameToDefinition = _(nameToInstance)
    .mapValues(value => fetchDefinitionByType[value.elemID.typeName])
    .value()

  const graph = createGraph(instances, instanceNameToDefinition)

  const elemIdsToRename = new Set(wu(graph.nodeData.keys()).map(instanceName => instanceName.toString()))
  const referenceIndex = createReferenceIndex(instances, elemIdsToRename)
  await awu(graph.evaluationOrder()).forEach(async graphNode => {
    if (!elemIdsToRename.has(graphNode.toString())) {
      return
    }
    const instanceFetchDefinitions = instanceNameToDefinition[graphNode.toString()]
    if (instanceFetchDefinitions !== undefined) {
      const instance = graph.getData(graphNode)
      const originalFullName = instance.elemID.getFullName()
      const instanceType = instance.getTypeSync()
      const { toElemName, toPath } = getInstanceCreationFunctions({
        defQuery,
        type: instanceType,
        getElemIdFunc,
      })

      const nameAndPathCreationArgs = {
        entry: instance.value,
        defaultName: instance.elemID.name,
        parent: getFirstParent(instance),
      }
      const newInstance = await createNewInstance(
        instance,
        toElemName(nameAndPathCreationArgs),
        toPath(nameAndPathCreationArgs),
      )

      updateAllReferences({
        referenceIndex,
        instanceOriginalName: originalFullName,
        nameToInstance,
        newInstance,
      })

      if (nameToInstance[originalFullName] !== undefined) {
        nameToInstance[originalFullName] = newInstance
      }

      const originalInstanceIdx = elements.findIndex(e => e.elemID.getFullName() === originalFullName)
      elements.splice(originalInstanceIdx, 1, newInstance)
    }
  })
  return elements
}

export const referencedInstanceNamesFilterCreator: <
  TContext,
  TResult extends void | filter.FilterResult = void,
  TAdditional = {},
  ClientOptions extends string = 'main',
  PaginationOptions extends string | 'none' = 'none',
  AdditionalAction extends string = never,
>() => filter.FilterCreator<
  TResult,
  FilterOptions<TContext, TAdditional, ClientOptions, PaginationOptions, AdditionalAction>
> =
  () =>
  ({ definitions, getElemIdFunc }) => {
    if (definitions.fetch === undefined) {
      log.warn('No fetch definitions were found, skipping referencedInstanceNames filter')
      return () => ({})
    }
    const { instances } = definitions.fetch
    const defQuery = queryWithDefault(instances)
    return {
      name: 'referencedInstanceNames',
      onFetch: async elements => {
        await addReferencesToInstanceNames(elements, defQuery, getElemIdFunc)
      },
    }
  }
