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
import { ElemID, isObjectType, ObjectType, Element } from '@salto-io/adapter-api'
import { toNestedTypeName } from './type_elements'
import { DATA_FIELD_ENTIRE_OBJECT } from '../../config/transformation'
import { TypeDuckTypeConfig } from '../../config'

export const addRemainingTypes = ({
  elements, typesConfig, adapterName,
}: {
  elements: Element[]
  typesConfig: Record<string, TypeDuckTypeConfig>
  adapterName: string
}): void => {
  const sourceTypeNameToTypeName = _(typesConfig)
    .pickBy(typeConfig => typeConfig.transformation?.sourceTypeName !== undefined)
    .entries()
    .map(([typeName, typeConfig]) => [typeConfig?.transformation?.sourceTypeName, typeName])
    .fromPairs()
    .value()
  const typeNames = _(typesConfig)
    .entries()
    .flatMap(([typeName, typeConfig]) => {
      const dataField = typeConfig.transformation?.dataField
      const standAloneFields = typeConfig.transformation?.standaloneFields
      const nestedFields = [
        ...((dataField && dataField !== DATA_FIELD_ENTIRE_OBJECT) ? [dataField] : []),
        ...(standAloneFields ?? []).map(field => field.fieldName),
      ].map(fieldName => toNestedTypeName(typeName, fieldName))
      return [typeName, ...nestedFields]
    })
    .map(typeName => sourceTypeNameToTypeName[typeName] ?? typeName)
    .uniq()
    .value()
  const existingTypeNames = new Set(elements
    .filter(isObjectType)
    .map(e => e.elemID.typeName))
  const typesToAdd = typeNames
    .filter(typeName => !existingTypeNames.has(typeName))
    .map(typeName => new ObjectType({ elemID: new ElemID(adapterName, typeName) }))
  elements.push(...typesToAdd)
}
