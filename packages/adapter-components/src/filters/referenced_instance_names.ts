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
  pathNaclCase,
  invertNaclCase,
} from '@salto-io/adapter-utils'
import { DAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { AdapterFilterCreator } from '../filter_utils'
import {
  APIDefinitionsOptions,
  DefQuery,
  NameMappingFunctionMap,
  ResolveCustomNameMappingOptionsType,
  queryWithDefault,
} from '../definitions'
import { FieldIDPart, InstanceFetchApiDefinitions } from '../definitions/system/fetch'
import { getInstanceCreationFunctions } from '../fetch/element/instance_utils'

const { findDuplicates } = collections.array
const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues
const { createReferencesTransformFunc } = references

const getFirstParent = (instance: InstanceElement): InstanceElement | undefined => {
  const parentsInstances = getParents(instance)
    .filter(parent => isReferenceExpression(parent) && isInstanceElement(parent.value))
    .map(parent => parent.value)
  return parentsInstances.length > 0 ? parentsInstances[0] : undefined
}

/* Finds all elemIDs that the current instance relies on based on the idFields */
const getInstanceNameDependencies = <TOptions extends APIDefinitionsOptions = {}>(
  instance: InstanceElement,
  fieldIdParts: FieldIDPart<ResolveCustomNameMappingOptionsType<TOptions>>[],
  extendsParentId?: boolean,
): string[] => {
  const referencedInstances = fieldIdParts
    .filter(fieldIdPart => fieldIdPart.isReference)
    .map(fieldIdPart => {
      const fieldValue = _.get(instance.value, fieldIdPart.fieldName)
      if (isReferenceExpression(fieldValue) && fieldValue.elemID.idType === 'instance') {
        return fieldValue.elemID.createTopLevelParentID().parent.getFullName()
      }
      log.warn(
        `Instance ${instance.elemID.getFullName()} has a reference field ${fieldIdPart.fieldName} that is not a reference expression`,
      )
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
const createGraph = <TOptions extends APIDefinitionsOptions = {}>(
  instances: InstanceElement[],
  fetchDefinitionInstanceName: Record<string, InstanceFetchApiDefinitions<TOptions>>,
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
    const { elemID } = fetchDefinitionInstanceName[instance.elemID.getFullName()]?.element?.topLevel ?? {}
    const parts = elemID?.parts ?? []
    const extendsParent = elemID?.extendsParent
    if (extendsParent || parts.some(part => part.isReference)) {
      // removing duplicate elemIDs to create a graph
      // we can traverse based on references to unique elemIDs
      if (!isDuplicateInstance(instance.elemID.getFullName())) {
        const nameDependencies = getInstanceNameDependencies(instance, parts, extendsParent).filter(
          instanceName => !isDuplicateInstance(instanceName),
        )
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

const getPathToNestUnder = <TOptions extends APIDefinitionsOptions = {}>(
  fetchDefinitionByType: Record<string, InstanceFetchApiDefinitions<TOptions>>,
  instance: InstanceElement,
  parent: InstanceElement,
): string[] | undefined => {
  const [fieldName, fieldCustomizations] =
    Object.entries(fetchDefinitionByType[parent.elemID.typeName]?.element?.fieldCustomizations ?? {}).find(
      ([, def]) => def.standalone?.typeName === instance.elemID.typeName,
    ) ?? []
  return fieldCustomizations?.standalone?.nestPathUnderParent
    ? [...(parent.path?.slice(2, parent.path?.length - 1) ?? []), pathNaclCase(fieldName)]
    : undefined
}

const calculateInstanceNewNameAndPath = <TOptions extends APIDefinitionsOptions = {}>(
  instance: InstanceElement,
  defQuery: DefQuery<InstanceFetchApiDefinitions<TOptions>, string>,
  getElemIdFunc?: ElemIdGetter,
  customNameMappingFunctions?: NameMappingFunctionMap<ResolveCustomNameMappingOptionsType<TOptions>>,
): { newName: string; newPath: string[] } => {
  const parent = getFirstParent(instance)
  const nestUnderPath = parent ? getPathToNestUnder(defQuery.getAll(), instance, parent) : undefined
  const { toElemName, toPath } = getInstanceCreationFunctions({
    defQuery,
    type: instance.getTypeSync(),
    getElemIdFunc,
    nestUnderPath,
    customNameMappingFunctions,
  })

  const nameAndPathCreationArgs = {
    entry: instance.value,
    defaultName: invertNaclCase(instance.elemID.name),
    parent,
  }
  return { newName: toElemName(nameAndPathCreationArgs), newPath: toPath(nameAndPathCreationArgs) }
}

/*
 * Utility function that finds instance elements whose id relies on the ids of other instances,
 * and replaces them with updated instances with the correct id and file path.
 */
export const addReferencesToInstanceNames = async <TOptions extends APIDefinitionsOptions = {}>(
  elements: Element[],
  defQuery: DefQuery<InstanceFetchApiDefinitions<TOptions>, string>,
  getElemIdFunc?: ElemIdGetter,
  customNameMappingFunctions?: NameMappingFunctionMap<ResolveCustomNameMappingOptionsType<TOptions>>,
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
      const { newName, newPath } = calculateInstanceNewNameAndPath(
        instance,
        defQuery,
        getElemIdFunc,
        customNameMappingFunctions,
      )
      const newInstance = await createNewInstance(instance, newName, newPath)

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

export const referencedInstanceNamesFilterCreator =
  <TResult extends void | filter.FilterResult, TOptions extends APIDefinitionsOptions = {}>(): AdapterFilterCreator<
    {},
    TResult,
    {},
    TOptions
  > =>
  ({ definitions, getElemIdFunc }) => {
    if (definitions.fetch === undefined) {
      log.warn('No fetch definitions were found, skipping referencedInstanceNames filter')
      return () => ({})
    }
    const { instances } = definitions.fetch
    return {
      name: 'referencedInstanceNames',
      onFetch: async elements => {
        await addReferencesToInstanceNames(
          elements,
          queryWithDefault(instances),
          getElemIdFunc,
          definitions.fetch?.customNameMappingFunctions,
        )
      },
    }
  }
