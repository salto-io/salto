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
import { InstanceElement, CORE_ANNOTATIONS, ElemID, INSTANCE_ANNOTATIONS, isReferenceExpression, ObjectType, isInstanceElement, Value } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'

const log = logger(module)
export type AliasComponent = {
  fieldName: string
  referenceFieldName?: string
}

export type ConstantComponent = {
  constant: string
}

type Component = AliasComponent | ConstantComponent
export type AliasData<T extends Component[] = Component[]> = {
  aliasComponents: T
  separator?: string
}

type SupportedElement = ObjectType | InstanceElement

const isInstanceAnnotation = (field: string): boolean =>
  Object.values(INSTANCE_ANNOTATIONS).includes(field.split(ElemID.NAMESPACE_SEPARATOR)[0])

const isValidAlias = (aliasParts: (string | undefined)[], element: SupportedElement): boolean =>
  aliasParts.every((val, index) => {
    if (val === undefined) {
      log.debug(`for element ${element.elemID.getFullName()}, component number ${index} in the alias map resulted in undefined`)
      return false
    }
    return true
  })

const getFieldValue = (element: SupportedElement, fieldName: string): Value => (
  !isInstanceElement(element) || isInstanceAnnotation(fieldName)
    ? _.get(element.annotations, fieldName)
    : _.get(element.value, fieldName)
)

const getAliasFromField = ({ element, component, elementsById }:{
  element: SupportedElement
  component: AliasComponent
  elementsById: Record<string, SupportedElement>
}): string | undefined => {
  const { fieldName, referenceFieldName } = component

  const fieldValue = getFieldValue(element, fieldName)
  if (referenceFieldName === undefined) {
    return _.isString(fieldValue) ? fieldValue : undefined
  }
  if (!isReferenceExpression(fieldValue)) {
    log.error(`${fieldName} is treated as a reference expression but it is not`)
    return undefined
  }
  const topLevelReferenceFullName = fieldValue.elemID.createTopLevelParentID().parent.getFullName()
  const referencedElement = elementsById[topLevelReferenceFullName]
  if (referencedElement === undefined) {
    log.error(`could not find ${topLevelReferenceFullName} in elementById`)
    return undefined
  }
  const referencedFieldValue = getFieldValue(referencedElement, referenceFieldName)
  return _.isString(referencedFieldValue) ? referencedFieldValue : undefined
}

const isConstantComponent = (
  component: AliasComponent | ConstantComponent
): component is ConstantComponent => 'constant' in component

const calculateAlias = ({ element, elementsById, aliasData }: {
  element: SupportedElement
  elementsById: Record<string, SupportedElement>
  aliasData: AliasData
}): string | undefined => {
  const { aliasComponents, separator = ' ' } = aliasData
  const aliasParts = aliasComponents.map(component => (
    isConstantComponent(component)
      ? component.constant
      : getAliasFromField({ element, component, elementsById })
  ))
  if (!isValidAlias(aliasParts, element)) {
    return undefined
  }
  return aliasParts.join(separator)
}


export const addAliasToElements = ({
  elementsMap,
  aliasMap,
  secondIterationGroupNames = [],
}: {
  elementsMap: Record<string, SupportedElement[]>
  aliasMap: Record<string, AliasData>
  secondIterationGroupNames?: string[]
}): void => {
  const allElements = Object.values(elementsMap).flat()
  const elementsById = _.keyBy(allElements, elem => elem.elemID.getFullName())
  const relevantElementsMap = _.pick(elementsMap, Object.keys(aliasMap))

  const addAlias = (group: string): void => {
    const aliasData = aliasMap[group]
    relevantElementsMap[group].forEach(element => {
      const alias = calculateAlias({ element, elementsById, aliasData })
      if (alias !== undefined) {
        element.annotations[CORE_ANNOTATIONS.ALIAS] = alias
      }
    })
  }
  const [firstIterationGroups, secondIterationGroups] = _.partition(
    Object.keys(relevantElementsMap),
    group => !secondIterationGroupNames.includes(group)
  )
  // first iteration
  firstIterationGroups.forEach(addAlias)

  // second iteration
  secondIterationGroups.forEach(addAlias)
}
