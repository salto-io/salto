/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, isInstanceElement, isReferenceExpression, InstanceElement, ElemID,
  ElemIdGetter,
  ReferenceExpression } from '@salto-io/adapter-api'
import { filter, references, getParents, transformElement, setPath,
  walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { DAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter_utils'
import { AdapterApiConfig, getTransformationConfigByType,
  TransformationConfig, TransformationDefaultConfig, getConfigWithDefault,
  dereferenceFieldName, isReferencedIdField } from '../config'
import { joinInstanceNameParts, getInstanceFilePath, getInstanceNaclName } from '../elements/instance_elements'
import { findDuplicates } from '../config/validation_utils'

const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues
const { getUpdatedReference, createReferencesTransformFunc } = references

const createInstanceReferencedNameParts = (
  instance: InstanceElement,
  idFields: string[],
): string[] => idFields.map(
  fieldName => {
    if (!isReferencedIdField(fieldName)) {
      return _.get(instance.value, fieldName)
    }
    const fieldValue = _.get(instance.value, dereferenceFieldName(fieldName))
    if (isReferenceExpression(fieldValue)) {
      if (isInstanceElement(fieldValue.value)) {
        return fieldValue.elemID.name
      }
      log.warn(`In instance: ${instance.elemID.getFullName()},
        the reference expression: ${fieldValue.elemID.getFullName},
        of field ${fieldName} doesn't point to an instance element`)
    } else {
      log.warn(`In instance: ${instance.elemID.getFullName()},
      could not find reference for referenced idField: ${fieldName}, falling back to original value`)
    }
    return fieldValue
  }
)

/* Finds all elemIDs that the current instance relies on based on the idFields */
const getInstanceNameDependencies = (
  idFields: string[],
  instance: InstanceElement,
): string[] => {
  const referencedInstances = idFields
    .filter(isReferencedIdField)
    .map(fieldName => {
      const fieldValue = _.get(instance.value, dereferenceFieldName(fieldName))
      if (isReferenceExpression(fieldValue) && isInstanceElement(fieldValue.value)) {
        return fieldValue.elemID.getFullName()
      }
      return undefined
    })
    .filter(isDefined)
  return referencedInstances
}

/* Calculates the new instance name and file path */
const createInstanceNameAndFilePath = (
  instance: InstanceElement,
  idFields: string[],
  configByType: Record<string, TransformationConfig>,
  getElemIdFunc?: ElemIdGetter,
): { newNaclName: string; filePath: string[] } => {
  const newNameParts = createInstanceReferencedNameParts(instance, idFields)
  const newName = joinInstanceNameParts(newNameParts) ?? instance.elemID.name
  const parentIds = getParents(instance)
    .filter(parent => isReferenceExpression(parent) && isInstanceElement(parent.value))
    .map(parent => parent.value.elemID.name)
  const parentName = parentIds.length > 0 ? parentIds[0] : undefined

  const { typeName, adapter } = instance.elemID
  const { fileNameFields, serviceIdField } = configByType[typeName]

  const newNaclName = getInstanceNaclName({
    entry: instance.value,
    name: newName,
    parentName,
    adapterName: adapter,
    getElemIdFunc,
    serviceIdField,
    typeElemId: instance.refType.elemID,
  })

  const filePath = getInstanceFilePath({
    fileNameFields,
    entry: instance.value,
    naclName: newNaclName,
    typeName,
    isSettingType: configByType[typeName].isSingleton ?? false,
    adapterName: adapter,
  })
  return { newNaclName, filePath }
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

const isReferenceOfSomeElem = (
  reference: ReferenceExpression,
  instancesFullName: Set<string>
): boolean =>
  (instancesFullName.has(reference.elemID.getFullName())
  || instancesFullName.has(reference.elemID.createTopLevelParentID().parent.getFullName()))

const getReferencesToElemIds = (
  element: Element,
  instancesToRename: ElemID[],
): { path: ElemID; value: ReferenceExpression }[] => {
  const refs: { path: ElemID; value: ReferenceExpression }[] = []
  const instanceNamesToFind = new Set(instancesToRename.map(i => i.getFullName()))
  const func: WalkOnFunc = ({ path, value }) => {
    if (isReferenceExpression(value) && isReferenceOfSomeElem(value, instanceNamesToFind)) {
      refs.push({ path, value })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func })
  return refs
}

/* Update all references for all the renamed instances with the new elemIds */
const updateAllReferences = (
  referenceIndex: Record<string, { path: ElemID; value: ReferenceExpression }[]>,
  instanceOriginalName: string,
  allElements: Element[],
  newElemId: ElemID,
): void => {
  const referencesToChange = referenceIndex[instanceOriginalName]
  if (referencesToChange === undefined) {
    return
  }
  referencesToChange
    .forEach(ref => {
      const rootElemId = ref.path.createTopLevelParentID().parent
      const rootInstance = allElements
        .find(e => isInstanceElement(e) && e.elemID.isEqual(rootElemId))
      const updatedReference = getUpdatedReference(ref.value, newElemId)
      if (rootInstance !== undefined) {
        setPath(rootInstance, ref.path, updatedReference)
      }
    })
  referenceIndex[newElemId.getFullName()] = referenceIndex[instanceOriginalName]
  delete referenceIndex[instanceOriginalName]
}

/* Create a graph with instance names as nodes and instance name dependencies as edges */
const createGraph = (
  instances: InstanceElement[],
  instancesToIdFields: {instance: InstanceElement; idFields: string[]}[]
): DAG<InstanceElement> => {
  const hasReferencedIdFields = (idFields: string[]): boolean => (
    idFields.some(field => isReferencedIdField(field))
  )
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
  instancesToIdFields.forEach(({ instance, idFields }) => {
    if (hasReferencedIdFields(idFields)) {
      // removing duplicate elemIDs to create a graph
      // we can traverse based on references to unique elemIDs
      if (!isDuplicateInstance(instance.elemID.getFullName())) {
        const nameDependencies = getInstanceNameDependencies(idFields, instance)
          .filter(instanceName => !isDuplicateInstance(instanceName))
        graph.addNode(
          instance.elemID.getFullName(),
          nameDependencies,
          instance,
        )
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
  instancesToRename: ElemID[],
) : Record<string, { path: ElemID; value: ReferenceExpression }[]> => {
  const allReferences = allInstances
    .flatMap(instance => getReferencesToElemIds(instance, instancesToRename))
  const referenceIndex = _(allReferences)
    .groupBy(({ value }) => value.elemID.createTopLevelParentID().parent.getFullName())
    .value()
  return referenceIndex
}

/*
 * Utility function that finds instance elements whose id relies on the ids of other instances,
 * and replaces them with updated instances with the correct id and file path.
 */
export const addReferencesToInstanceNames = async (
  elements: Element[],
  transformationConfigByType: Record<string, TransformationConfig>,
  transformationDefaultConfig: TransformationDefaultConfig,
  getElemIdFunc?: ElemIdGetter
): Promise<Element[]> => {
  const instances = elements.filter(isInstanceElement)
  const instanceTypeNames = new Set(instances.map(instance => instance.elemID.typeName))
  const configByType = Object.fromEntries(
    [...instanceTypeNames]
      .map(typeName => [
        typeName,
        getConfigWithDefault(
          transformationConfigByType[typeName],
          transformationDefaultConfig
        ),
      ])
  )

  const instancesToIdFields = instances.map(instance => ({
    instance,
    idFields: configByType[instance.elemID.typeName].idFields,
  }))

  const graph = createGraph(instances, instancesToIdFields)

  const nameToInstanceIdFields = _.keyBy(
    instancesToIdFields,
    obj => obj.instance.elemID.getFullName()
  )

  const elemIdsToRename = wu(graph.keys())
    .map(name => nameToInstanceIdFields[name].instance.elemID)
    .toArray()
  const referenceIndex = createReferenceIndex(instances, elemIdsToRename)

  await awu(graph.evaluationOrder()).forEach(
    async graphNode => {
      const instanceIdFields = nameToInstanceIdFields[graphNode.toString()]
      if (instanceIdFields !== undefined) {
        const { instance, idFields } = instanceIdFields
        const originalFullName = instance.elemID.getFullName()
        const { newNaclName, filePath } = createInstanceNameAndFilePath(
          instance,
          idFields,
          configByType,
          getElemIdFunc,
        )
        const newInstance = await createNewInstance(instance, newNaclName, filePath)

        updateAllReferences(
          referenceIndex,
          originalFullName,
          elements,
          newInstance.elemID
        )

        const originalInstanceIdx = elements
          .findIndex(e => (e.elemID.getFullName()) === originalFullName)
        elements.splice(originalInstanceIdx, 1, newInstance)
      }
    }
  )
  return elements
}

export const referencedInstanceNamesFilterCreator: <
  TClient,
  TContext extends { apiDefinitions: AdapterApiConfig },
  TResult extends void | filter.FilterResult = void
>() => FilterCreator<TClient, TContext, TResult> = () => ({ config, getElemIdFunc }) => ({
  onFetch: async (elements: Element[]) => {
    const transformationDefault = config.apiDefinitions.typeDefaults.transformation
    const configByType = config.apiDefinitions.types
    const transformationByType = getTransformationConfigByType(configByType)
    await addReferencesToInstanceNames(
      elements,
      transformationByType,
      transformationDefault,
      getElemIdFunc
    )
  },
})
