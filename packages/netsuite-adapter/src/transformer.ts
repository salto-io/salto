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
  PrimitiveType, PrimitiveTypes, PrimitiveValue, Value, Values,
} from '@salto-io/adapter-api'
import { bpCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Attributes, Element as XmlElement } from 'xml-js'
import _ from 'lodash'
import { IS_NAME, NETSUITE, RECORDS_PATH } from './constants'

const log = logger(module)

const transformPrimitive = (val?: PrimitiveValue, type?: PrimitiveType): Value => {
  if (_.isUndefined(type) || _.isUndefined(val)) {
    return undefined
  }
  switch (type.primitive) {
    case PrimitiveTypes.NUMBER:
      return Number(val)
    case PrimitiveTypes.BOOLEAN:
      return val === 'T'
    default:
      return val
  }
}

const transformXmlElements = (elements: XmlElement[], type: ObjectType, attributes?: Attributes):
  Values | undefined => {
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

  const loweredFieldMap = _.fromPairs(
    _.entries(type.fields).map(([name, field]) => [name.toLowerCase(), field])
  )

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
    return bpCase((findInnerElement(nameField.name.toLowerCase()).elements)?.[0].text as string)
  }

  const instanceName = getInstanceName()
  return new InstanceElement(instanceName, type,
    transformXmlElements(rootXmlElement.elements as XmlElement[], type, rootXmlElement.attributes),
    [NETSUITE, RECORDS_PATH, type.elemID.name, instanceName])
}
