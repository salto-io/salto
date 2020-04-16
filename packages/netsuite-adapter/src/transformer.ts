/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  ElemID, Field, InstanceElement, isListType, isObjectType, isPrimitiveType, ObjectType,
  PrimitiveType, PrimitiveTypes, PrimitiveValue, TypeElement, Value, Values,
} from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Attributes, Element as XmlElement } from 'xml-js'
import _ from 'lodash'
import { IS_ATTRIBUTE, IS_NAME, NETSUITE, RECORDS_PATH } from './constants'

const log = logger(module)
const XML_TRUE_VALUE = 'T'
const XML_FALSE_VALUE = 'F'

const transformXmlElements = (elements: XmlElement[], type: ObjectType, attributes?: Attributes):
  Values | undefined => {
  const transformPrimitive = (val?: PrimitiveValue, primitiveType?: PrimitiveType): Value => {
    if (_.isUndefined(primitiveType) || _.isUndefined(val)) {
      return undefined
    }
    switch (primitiveType.primitive) {
      case PrimitiveTypes.NUMBER:
        return Number(val)
      case PrimitiveTypes.BOOLEAN:
        return val === XML_TRUE_VALUE
      default:
        return val
    }
  }

  const transformXmlElement = (element: XmlElement, field: Field): Values | undefined => {
    if (field === undefined) {
      log.warn('Unknown field with name=%. Skipping its transformation', element.name)
      return undefined
    }
    const fieldType = field.type

    if (isObjectType(fieldType)) {
      if (!_.isArray(element.elements)) {
        log.warn('Expected to have inner xml elements for object type %s. Skipping its transformation',
          fieldType.elemID.name)
        return undefined
      }
      const transformed = _.omitBy(
        transformXmlElements(element.elements, fieldType, element.attributes),
        _.isUndefined
      )
      return _.isEmpty(transformed) ? undefined : transformed
    }

    if (isListType(fieldType)) {
      if (!_.isArray(element.elements)) {
        log.warn('Expected to have inner xml elements for list type %s. Skipping its transformation',
          fieldType.elemID.name)
        return undefined
      }
      const transformed = element.elements
        .map(e => transformXmlElement(e,
          new Field(new ElemID(''), fieldType.innerType.elemID.name, fieldType.innerType)))
        .filter((val: Value) => !_.isUndefined(val))
      return transformed.length === 0 ? undefined : { [field.name]: transformed }
    }

    if (isPrimitiveType(fieldType)) {
      return { [field.name]:
          _.isArray(element.elements)
            ? transformPrimitive(element.elements[0].text, fieldType)
            : undefined }
    }
    return undefined
  }

  const loweredFieldMap = _.mapKeys(type.fields, (_field, name) => name.toLowerCase())

  const transformAttributes = (): Values =>
    _(attributes)
      .entries()
      .map(([lowerAttrName, val]) =>
        [loweredFieldMap[lowerAttrName]?.name,
          transformPrimitive(val, loweredFieldMap[lowerAttrName]?.type as PrimitiveType)])
      .filter(([name, val]) => !_.isUndefined(name) && !_.isUndefined(val))
      .fromPairs()
      .value()

  const result = _(Object.assign(
    transformAttributes(),
    ...elements.map(e => transformXmlElement(e, loweredFieldMap[e.name as string]))
  )).omitBy(_.isUndefined).value()
  return _.isEmpty(result) ? undefined : result
}

export const createInstanceElement = (rootXmlElement: XmlElement, type: ObjectType):
  InstanceElement => {
  const findInnerElement = (name: string): XmlElement =>
    rootXmlElement.elements?.find(e => e.name === name) as XmlElement

  const getInstanceName = (): string => {
    const nameField = Object.values(type.fields)
      .find(f => f.annotations[IS_NAME]) as Field
    return naclCase((findInnerElement(nameField.name.toLowerCase()).elements)?.[0].text as string)
  }

  const instanceName = getInstanceName()
  return new InstanceElement(instanceName, type,
    transformXmlElements(rootXmlElement.elements as XmlElement[], type, rootXmlElement.attributes),
    [NETSUITE, RECORDS_PATH, type.elemID.name, instanceName])
}

const isXmlElement = (element: XmlElement | undefined): element is XmlElement =>
  element !== undefined

const isAttribute = (field: Field): boolean => field.annotations[IS_ATTRIBUTE]

const transformValues = (values: Values, type: ObjectType): XmlElement[] =>
  Object.entries(values)
    .map(([key, val]) => {
      const field = type.fields[key]
      if (_.isUndefined(field) || isAttribute(field)) {
        return undefined
      }
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return transformValue(val, field.type, field.name.toLowerCase())
    })
    .filter(isXmlElement)

const transformValue = (value: Value, type: TypeElement, elementName: string):
  XmlElement | undefined => {
  const transformPrimitive = (primitiveValue: PrimitiveValue, primitiveType: PrimitiveType):
    string => {
    if (primitiveType.primitive === PrimitiveTypes.BOOLEAN) {
      return primitiveValue ? XML_TRUE_VALUE : XML_FALSE_VALUE
    }
    return String(primitiveValue)
  }

  const transformAttributes = (values: Values, objType: ObjectType): Attributes =>
    _(Object.values(objType.fields)
      .filter(isAttribute)
      .map(f => f.name)
      .map(name => [name.toLowerCase(), values[name]]))
      .fromPairs()
      .omitBy(_.isUndefined)
      .value()

  if (isObjectType(type)) {
    if (!_.isPlainObject(value)) {
      return undefined
    }
    return {
      type: 'element',
      name: elementName,
      elements: transformValues(value, type),
      attributes: transformAttributes(value, type),
    }
  }

  if (isListType(type)) {
    if (!_.isArray(value)) {
      return undefined
    }
    return {
      type: 'element',
      name: elementName,
      elements: value.map(listValue =>
        transformValue(listValue, type.innerType, type.innerType.elemID.name.toLowerCase()))
        .filter(isXmlElement),
    }
  }

  if (isPrimitiveType(type)) {
    return {
      type: 'element',
      name: elementName,
      elements: [{
        type: 'text',
        text: transformPrimitive(value, type),
      }],
    }
  }
  return undefined
}

export const createXmlElement = (instance: InstanceElement): XmlElement =>
  ({
    elements: [
      transformValue(instance.value, instance.type, instance.type.elemID.name.toLowerCase()),
    ] as XmlElement[],
  })
