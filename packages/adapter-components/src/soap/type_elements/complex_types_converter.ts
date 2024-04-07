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
import { ElemID, ObjectType, Values } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { strings, values } from '@salto-io/lowerdash'
import {
  ComplexTypeElement,
  ExtensionElement,
  SchemaElement,
  Element,
  ElementElement,
  ComplexContentElement,
} from 'soap/lib/wsdl/elements'
import { convertToNamespaceName, searchInElement } from './utils'

const log = logger(module)

export type UnresolvedField = {
  resolveType: 'field'
  name: string
  type: string
  isList: boolean
  annotations: Values
}

export type UnresolvedExtension = {
  resolveType: 'extension'
  type: string
}

type FieldType = UnresolvedField | UnresolvedExtension

export type UnresolvedType = {
  objectType: ObjectType
  fields: FieldType[]
  namespace?: string
}

const convertComplexContent = (
  element: ComplexContentElement,
  typeName: string,
  camelCase: boolean,
  namespace?: string,
): FieldType | undefined => {
  const extension = element.children.find(child => child instanceof ExtensionElement)
  if (!(extension instanceof ExtensionElement)) {
    log.warn(`Received unexpected complex element extension in type ${typeName}: ${extension?.name}`)
    return undefined
  }
  return {
    resolveType: 'extension',
    type: convertToNamespaceName(extension.$base, element.schemaXmlns ?? {}, camelCase, namespace),
  }
}

const convertField = (
  element: Element,
  typeName: string,
  camelCase: boolean,
  namespace?: string,
): FieldType | undefined => {
  if (element instanceof ComplexContentElement) {
    return convertComplexContent(element, typeName, camelCase, namespace)
  }

  const isAttribute = element.name === 'attribute'

  if (!(element instanceof ElementElement) && !isAttribute) {
    log.warn(`Received unexpected element in type ${typeName}: ${element?.name}`)
    return undefined
  }

  const elementWithProperties = element as { $type?: string; $name?: string; $maxOccurs?: string }
  if (elementWithProperties.$name === undefined || elementWithProperties.$type === undefined) {
    // This is debug because it currently happen for types we don't need
    // due to that we don't support 'ref' attribute
    log.debug(`Received element with missing properties in type ${typeName}: ${element?.name}`)
    return undefined
  }

  const fieldTypeName = convertToNamespaceName(
    elementWithProperties.$type,
    element.schemaXmlns ?? {},
    camelCase,
    namespace,
  )
  const isList = elementWithProperties.$maxOccurs !== undefined && elementWithProperties.$maxOccurs !== '1'
  const annotations = isAttribute ? { isAttribute: true } : {}

  return {
    resolveType: 'field',
    name: elementWithProperties.$name,
    type: fieldTypeName,
    isList,
    annotations,
  }
}

const convertComplexType = (
  adapterName: string,
  type: ComplexTypeElement,
  camelCase: boolean,
  namespace?: string,
): UnresolvedType | undefined => {
  const typeName = type.$name
  if (typeName === undefined) {
    return undefined
  }

  const objectTypeName = camelCase ? strings.lowerCaseFirstLetter(naclCase(typeName)) : naclCase(typeName)
  const objectType = new ObjectType({ elemID: new ElemID(adapterName, objectTypeName) })
  const fields = searchInElement(type, ['element', 'attribute', 'complexContent'])
    .map(element => convertField(element, typeName, camelCase, namespace))
    .filter(values.isDefined)

  return {
    objectType,
    fields,
    namespace,
  }
}

export const convertComplexTypes = (
  adapterName: string,
  schema: SchemaElement,
  camelCase = false,
): UnresolvedType[] => {
  const namespace = schema.$targetNamespace
  return Object.values(schema.complexTypes)
    .map(type => convertComplexType(adapterName, type, camelCase, namespace))
    .filter(values.isDefined)
}
