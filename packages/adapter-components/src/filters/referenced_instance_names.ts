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
import { Element, isInstanceElement, isReferenceExpression, InstanceElement, ElemID, ElemIdGetter, isObjectType } from '@salto-io/adapter-api'
import { filter, setPath, references, getParents, transformElement } from '@salto-io/adapter-utils'
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
const { getReferences, getUpdatedReference, createReferencesTransformFunc } = references

const getInstanceReferencedNameParts = (
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
        reference expression of field ${fieldName} doesn't point to an instance element`)
    }
    log.warn(`In instance: ${instance.elemID.getFullName()},
      could not find reference for referenced idField: ${fieldName}, falling back to original value`)
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

/* Create new instance with the new naclName and file path */
const getNewInstance = async (
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

/* Update all references for the renamed instance with the new elemId */
export const updateAllReferences = (
  allInstances: InstanceElement[],
  oldElemId: ElemID,
  newElemId: ElemID,
): void => {
  allInstances
  // filtering out the renamed element,
  // its references are taken care of in getNewInstance
    .filter(instance => oldElemId.getFullName() !== instance.elemID.getFullName())
    .forEach(instance => {
      const refs = getReferences(instance, oldElemId)
      if (refs.length > 0) {
        refs.forEach(ref => {
          const updatedReference = getUpdatedReference(ref.value, newElemId)
          setPath(instance, ref.path, updatedReference)
        })
      }
    })
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
  const hasReferencedIdFields = (idFields: string[]): boolean => (
    idFields.some(field => isReferencedIdField(field))
  )

  const instances = elements.filter(isInstanceElement)
  const duplicateElemIds = new Set(findDuplicates(instances.map(i => i.elemID.getFullName())))
  if (duplicateElemIds.size > 0) {
    log.warn(`Duplicate instance names were found:${Array.from(duplicateElemIds).join(', ')}`)
    _.remove(instances, instance => duplicateElemIds.has(instance.elemID.getFullName()))
  }

  const configByType = Object.fromEntries(
    elements
      .filter(isObjectType)
      .map(type => [
        type.elemID.name,
        getConfigWithDefault(
          transformationConfigByType[type.elemID.name],
          transformationDefaultConfig
        ),
      ])
  )
  const instancesToIdFields = instances.map(instance => ({
    instance,
    idFields: configByType[instance.elemID.typeName].idFields,
  }))
  const nameToInstanceIdFields = _.keyBy(
    instancesToIdFields,
    obj => obj.instance.elemID.getFullName()
  )

  const graph = new DAG<InstanceElement>()
  instancesToIdFields.forEach(({ instance, idFields }) => {
    if (hasReferencedIdFields(idFields)) {
      graph.addNode(
        instance.elemID.getFullName(),
        getInstanceNameDependencies(idFields, instance),
        instance,
      )
    }
  })

  await awu(graph.evaluationOrder()).forEach(
    async graphNode => {
      const instanceIdFields = nameToInstanceIdFields[graphNode.toString()]
      if (instanceIdFields !== undefined) {
        const { instance, idFields } = instanceIdFields
        const originalFullName = instance.elemID.getFullName()
        const newNameParts = getInstanceReferencedNameParts(instance, idFields)
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
          isSettingType: transformationConfigByType[typeName].isSingleton ?? false,
          adapterName: adapter,
        })

        const newInstance = await getNewInstance(instance, newNaclName, filePath)
        updateAllReferences(instances, instance.elemID, newInstance.elemID)
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
