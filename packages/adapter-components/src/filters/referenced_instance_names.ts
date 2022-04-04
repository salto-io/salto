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
import { Element, isInstanceElement, isReferenceExpression, InstanceElement, ElemID, ElemIdGetter } from '@salto-io/adapter-api'
import { filter, setPath, references, getParents, transformElement } from '@salto-io/adapter-utils'
import { DAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter_utils'
import { AdapterApiConfig, getTransformationConfigByType,
  TransformationConfig, TransformationDefaultConfig, getConfigWithDefault,
  dereferenceFieldName, isReferencedIdField } from '../config'
import { joinInstanceNameParts, getInstanceFilePath, getInstanceNaclName } from '../elements/instance_elements'

const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues
const { getReferences, getUpdatedReference, createReferencesTransformFunc } = references

type InstanceIdFields = {
  instance: InstanceElement
  idFields: string[]
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
  const hasReferencedIdFields = (
    idFields: string[],
  ): boolean => idFields.some(field => isReferencedIdField(field))

  const instances = elements.filter(isInstanceElement)
  const instancesToIdFields: InstanceIdFields[] = instances.map(instance => ({
    instance,
    idFields: getConfigWithDefault(
      transformationConfigByType[instance.elemID.typeName],
      transformationDefaultConfig
    ).idFields,
  }))

  const graph = new DAG<InstanceElement>()
  instancesToIdFields.forEach(({ instance, idFields }) => {
    const getReferencedInstances = (): string[] => {
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
    graph.addNode(instance.elemID.getFullName(), getReferencedInstances(), instance)
  })

  await awu(graph.evaluationOrder()).forEach(
    async graphNode => {
      const instanceIdFields = instancesToIdFields
        .find(instanceF => instanceF.instance.elemID.getFullName() === graphNode.toString())
      if (instanceIdFields !== undefined) {
        const { instance, idFields } = instanceIdFields
        if (idFields !== undefined && hasReferencedIdFields(idFields)) {
          const originalName = instance.elemID.name
          const originalFullName = instance.elemID.getFullName()
          const newNameParts = idFields.map(
            fieldName => {
              if (isReferencedIdField(fieldName)) {
                const fieldValue = _.get(instance.value, dereferenceFieldName(fieldName))
                if (isReferenceExpression(fieldValue)) {
                  if (isInstanceElement(fieldValue.value)) {
                    return fieldValue.elemID.name
                  }
                  log.warn(`reference expression of field ${fieldName} doesn't point to an instance element`)
                }
                log.warn(`could not find reference for referenced idField: ${fieldName}, falling back to original value`)
                return fieldValue
              }
              return _.get(instance.value, fieldName)
            }
          )
          const newName = joinInstanceNameParts(newNameParts) ?? originalName
          const parentIds = getParents(instance)
            .filter(parent => isReferenceExpression(parent) && isInstanceElement(parent.value))
            .map(parent => parent.value.elemID.name)
          const parentName = joinInstanceNameParts(parentIds) ?? undefined

          const { typeName, adapter } = instance.elemID
          const { fileNameFields, serviceIdField } = getConfigWithDefault(
            transformationConfigByType[typeName],
            transformationDefaultConfig,
          )

          const newNaclName = getInstanceNaclName({
            entry: instance.value,
            name: newName,
            parentName,
            adapterName: adapter,
            getElemIdFunc,
            serviceIdField,
            typeElemId: instance.refType.elemID,
          })

          const filePath = transformationConfigByType[typeName].isSingleton
            ? instance.path
            : getInstanceFilePath({
              fileNameFields,
              entry: instance.value,
              naclName: newNaclName,
              typeName,
              isSettingType: false,
              adapterName: adapter,
            })

          const newElemId = new ElemID(adapter, typeName, 'instance', newNaclName)
          const updatedInstance = await transformElement({
            element: instance,
            transformFunc: createReferencesTransformFunc(instance.elemID, newElemId),
            strict: false,
          })

          const newInstance = new InstanceElement(
            newElemId.name,
            updatedInstance.refType,
            updatedInstance.value,
            filePath,
            updatedInstance.annotations,
          )

          elements
            .filter(isInstanceElement)
          // filtering out the renamed element,
          // its references are taken care of in getRenameElementChanges
            .filter(element => originalFullName !== element.elemID.getFullName())
            .forEach(element => {
              const refs = getReferences(element, instance.elemID)
              if (refs.length > 0) {
                refs.forEach(ref => {
                  const updatedReference = getUpdatedReference(ref.value, newElemId)
                  setPath(element, ref.path, updatedReference)
                })
              }
            })
          const instanceIdx = elements.findIndex(e => (e.elemID.getFullName()) === originalFullName)
          elements.splice(instanceIdx, 1, newInstance)
        }
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
