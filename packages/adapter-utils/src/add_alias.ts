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
import { InstanceElement, CORE_ANNOTATIONS,
  ElemID, INSTANCE_ANNOTATIONS,
  isReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'

const log = logger(module)
type AliasComponent = {
  fieldName: string
  referenceFieldName?: string
}

type ConstantComponent = {
  constant: string
}

export type AliasData = {
  aliasComponents: (AliasComponent | ConstantComponent)[]
  separator?: string
}

const isInstanceAnnotation = (field: string): boolean =>
  Object.values(INSTANCE_ANNOTATIONS).includes(field?.split(ElemID.NAMESPACE_SEPARATOR)[0])

const isValidAlias = (aliasParts: (string | undefined)[], instance: InstanceElement): boolean =>
  aliasParts.every((val, index) => {
    if (val === undefined) {
      log.debug(`for instance ${instance.elemID.getFullName()}, component number ${index} in the alias map resulted in undefined`)
      return false
    }
    return true
  })

const getFieldVal = ({ instance, component, elementPart, instById }:{
  instance: InstanceElement
  component: AliasComponent
  elementPart: 'value'|'annotations'
  instById: Record<string, InstanceElement>
}): string | undefined => {
  const fieldValue = _.get(instance[elementPart], component.fieldName)
  if (component.referenceFieldName === undefined) {
    return _.isString(fieldValue) ? fieldValue : undefined
  }
  if (!isReferenceExpression(fieldValue)) {
    log.error(`${component.fieldName} is treated as a reference expression but it is not`)
    return undefined
  }
  const referencedInstance = instById[fieldValue.elemID.getFullName()]
  if (referencedInstance === undefined) {
    log.error(`could not find ${fieldValue.elemID.getFullName()} in instById`)
    return undefined
  }
  return isInstanceAnnotation(component.referenceFieldName)
    ? _.get(referencedInstance.annotations, component.referenceFieldName)
    : _.get(referencedInstance.value, component.referenceFieldName)
}

const isConstantComponent = (component: AliasComponent | ConstantComponent): component is ConstantComponent => 'constant' in component

const isAliasComponent = (component: AliasComponent | ConstantComponent): component is AliasComponent => 'fieldName' in component


const calculateAlias = ({ instance, instById, aliasMap }: {
  instance: InstanceElement
  instById: Record<string, InstanceElement>
  aliasMap: Record<string, AliasData>
}): string | undefined => {
  const currentType = instance.elemID.typeName
  const { aliasComponents } = aliasMap[currentType]
  const separator = aliasMap[currentType].separator ?? ' '
  const aliasParts = aliasComponents
    .map(component => {
      if (isConstantComponent(component)) {
        return component.constant
      }
      if (isAliasComponent(component) && isInstanceAnnotation(component.fieldName)) {
        return getFieldVal({ instance, component, elementPart: 'annotations', instById })
      }
      return getFieldVal({ instance, component, elementPart: 'value', instById })
    })
  if (!isValidAlias(aliasParts, instance)) {
    return undefined
  }
  return aliasParts.join(separator)
}


export const addAliasToInstance = ({ instances, aliasMap, secondIterationTypeNames }: {
  instances: InstanceElement[]
  aliasMap: Record<string, AliasData>
  secondIterationTypeNames: string[]
}): void => {
  const elementById = _.keyBy(instances, elem => elem.elemID.getFullName())
  const relevantInstancesByType = _.groupBy(
    instances.filter(inst => aliasMap[inst.elemID.typeName] !== undefined),
    inst => inst.elemID.typeName
  )

  const addAlias = (typeName: string): void => {
    relevantInstancesByType[typeName].forEach(inst => {
      const alias = calculateAlias({ instance: inst, instById: elementById, aliasMap })
      if (alias !== undefined) {
        inst.annotations[CORE_ANNOTATIONS.ALIAS] = alias
      }
    })
  }
  const [firstIterationTypes, secondIterationTypes] = _.partition(
    Object.keys(relevantInstancesByType),
    typeName => !secondIterationTypeNames.includes(typeName)
  )
  // first iteration
  firstIterationTypes.forEach(addAlias)

  // second iteration
  secondIterationTypes.forEach(addAlias)
}
