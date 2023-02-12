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
import wu from 'wu'
import { Element, isInstanceElement, isReferenceExpression, InstanceElement, ElemID,
  ElemIdGetter, ReferenceExpression, isTemplateExpression } from '@salto-io/adapter-api'
import { filter, references, getParents, transformElement, setPath,
  walkOnElement, WalkOnFunc, WALK_NEXT_STEP, resolvePath, createTemplateExpression } from '@salto-io/adapter-utils'
import { DAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter_utils'
import { AdapterApiConfig, getTransformationConfigByType,
  TransformationConfig, TransformationDefaultConfig, getConfigWithDefault,
  dereferenceFieldName, isReferencedIdField, NameMappingOptions } from '../config'
import { joinInstanceNameParts, getInstanceFilePath, getInstanceNaclName } from '../elements/instance_elements'

const { findDuplicates } = collections.array
const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues
const { getUpdatedReference, createReferencesTransformFunc } = references

type TransformationIdConfig = {
  idFields: string[]
  extendsParentId?: boolean
  nameMapping?: NameMappingOptions
}

const getFirstParentElemId = (instance: InstanceElement): ElemID | undefined => {
  const parentsElemIds = getParents(instance)
    .filter(parent => isReferenceExpression(parent) && isInstanceElement(parent.value))
    .map(parent => parent.elemID)
  // we are only using the first parent ElemId
  return parentsElemIds.length > 0 ? parentsElemIds[0] : undefined
}

const createInstanceReferencedNameParts = (
  instance: InstanceElement,
  idFields: string[],
): string[] => idFields.map(
  fieldName => {
    if (!isReferencedIdField(fieldName)) {
      return _.get(instance.value, fieldName)
    }
    const dereferenceFieldValue = (fieldValue: ReferenceExpression): string => {
      const { parent, path } = fieldValue.elemID.createTopLevelParentID()
      return [parent.name, ...path].join('.')
    }

    const fieldValue = _.get(instance.value, dereferenceFieldName(fieldName))
    if (isReferenceExpression(fieldValue)) {
      return dereferenceFieldValue(fieldValue)
    }
    if (isTemplateExpression(fieldValue)) {
      return fieldValue.parts.map(part => (isReferenceExpression(part) ? dereferenceFieldValue(part) : _.toString(part))).join('')
    }
    log.warn(`In instance: ${instance.elemID.getFullName()}, could not find reference for referenced idField: ${fieldName}, falling back to original value`)
    return _.toString(fieldValue)
  }
)

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
  const parentFullName = getFirstParentElemId(instance)?.getFullName()
  if (extendsParentId && parentFullName !== undefined) {
    referencedInstances.push(parentFullName)
  }
  return referencedInstances
}

/* Calculates the new instance name and file path */
const createInstanceNameAndFilePath = (
  instance: InstanceElement,
  idConfig: TransformationIdConfig,
  configByType: Record<string, TransformationConfig>,
  getElemIdFunc?: ElemIdGetter,
): { newNaclName: string; filePath: string[] } => {
  const { idFields, nameMapping } = idConfig
  const newNameParts = createInstanceReferencedNameParts(instance, idFields)
  const newName = joinInstanceNameParts(newNameParts) ?? instance.elemID.name
  const parentName = getFirstParentElemId(instance)?.name
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
    nameMapping,
  })

  const filePath = getInstanceFilePath({
    fileNameFields,
    entry: instance.value,
    naclName: newNaclName,
    typeName,
    isSettingType: configByType[typeName].isSingleton ?? false,
    nameMapping: configByType[typeName].nameMapping,
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

const isReferenceOfSomeElement = (
  reference: ReferenceExpression,
  instancesFullName: Set<string>
): boolean =>
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
    if (isReferenceExpression(value)
      && isReferenceOfSomeElement(value, instancesNamesToRename)) {
      refs.push({ path, value })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func: findReferences })
  return refs
}

/* Creates the same nested path under the updated instance */
const createUpdatedPath = (
  oldPath: ElemID,
  updatedInstance: InstanceElement
): ElemID => {
  const { path } = oldPath.createBaseID()
  return updatedInstance.elemID.createNestedID(...path)
}

/* Update all references for all the renamed instances with the new elemIds */
const updateAllReferences = ({
  referenceIndex,
  instanceOriginalName,
  nameToInstance,
  newElemId,
}:{
  referenceIndex: Record<string, { path: ElemID; value: ReferenceExpression }[]>
  instanceOriginalName: string
  nameToInstance: Record<string, Element>
  newElemId: ElemID
}): void => {
  const referencesToChange = referenceIndex[instanceOriginalName]
  if (referencesToChange === undefined || referencesToChange.length === 0) {
    return
  }
  const updatedReferenceMap = new Map<string, ReferenceExpression>()
  referencesToChange
    .forEach(ref => {
      const referenceValueFullName = ref.value.elemID.getFullName()
      if (!updatedReferenceMap.has(referenceValueFullName)) {
        updatedReferenceMap.set(
          referenceValueFullName,
          getUpdatedReference(ref.value, newElemId)
        )
      }
      const updatedReference = updatedReferenceMap.get(referenceValueFullName)
      const topLevelInstance = nameToInstance[
        ref.path.createTopLevelParentID().parent.getFullName()
      ]
      if (topLevelInstance !== undefined) {
        // update the path so it would match the new instance
        const updatedPath = createUpdatedPath(ref.path, topLevelInstance as InstanceElement)
        const oldValue = resolvePath(topLevelInstance, updatedPath)
        if (isTemplateExpression(oldValue)) {
          // update only the relevant parts
          const updatedTemplate = createTemplateExpression({
            parts: oldValue.parts
              .map(part => ((isReferenceExpression(part) && part.elemID.getFullName() === instanceOriginalName)
                ? updatedReference
                : part
              ))
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
const createGraph = (
  instances: InstanceElement[],
  instanceToIdConfig: {instance: InstanceElement; idConfig: TransformationIdConfig}[]
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
  instanceToIdConfig.forEach(({ instance, idConfig }) => {
    const { idFields, extendsParentId } = idConfig
    if (hasReferencedIdFields(idFields) || extendsParentId) {
      // removing duplicate elemIDs to create a graph
      // we can traverse based on references to unique elemIDs
      if (!isDuplicateInstance(instance.elemID.getFullName())) {
        const nameDependencies = getInstanceNameDependencies(instance, idFields, extendsParentId)
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
  instancesNamesToRename: Set<string>,
) : Record<string, { path: ElemID; value: ReferenceExpression }[]> => {
  const allReferences = allInstances
    .flatMap(instance => getReferencesToElemIds(instance, instancesNamesToRename))
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

  const instancesToIdConfig = instances.map(instance => ({
    instance,
    idConfig: {
      idFields: configByType[instance.elemID.typeName].idFields,
      extendsParentId: configByType[instance.elemID.typeName].extendsParentId,
      nameMapping: configByType[instance.elemID.typeName].nameMapping,
    },
  }))

  const graph = createGraph(instances, instancesToIdConfig)

  const nameToInstanceIdConfig = _.keyBy(
    instancesToIdConfig,
    obj => obj.instance.elemID.getFullName()
  )
  const nameToInstance = _.keyBy(instances, i => i.elemID.getFullName())

  const elemIdsToRename = new Set(wu(graph.nodeData.keys())
    .map(instanceName => instanceName.toString()))
  const referenceIndex = createReferenceIndex(instances, elemIdsToRename)

  await awu(graph.evaluationOrder()).forEach(
    async graphNode => {
      const instanceIdConfig = nameToInstanceIdConfig[graphNode.toString()]
      if (instanceIdConfig !== undefined) {
        const { instance, idConfig } = instanceIdConfig
        const originalFullName = instance.elemID.getFullName()
        const { newNaclName, filePath } = createInstanceNameAndFilePath(
          instance,
          idConfig,
          configByType,
          getElemIdFunc,
        )
        const newInstance = await createNewInstance(instance, newNaclName, filePath)

        updateAllReferences({
          referenceIndex,
          instanceOriginalName: originalFullName,
          nameToInstance,
          newElemId: newInstance.elemID,
        })

        if (nameToInstance[originalFullName] !== undefined) {
          nameToInstance[originalFullName] = newInstance
        }

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
  name: 'referencedInstanceNames',
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
