/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { InstanceElement, ObjectType, Element, BuiltinTypes, ReferenceExpression, ElemIdGetter, ADAPTER, OBJECT_SERVICE_ID, toServiceIdsString, OBJECT_NAME, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { elements as elementsComponents } from '@salto-io/adapter-components'
import _ from 'lodash'
import { naclCase, pathNaclCase, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { NETSUITE, RECORDS_PATH } from '../constants'
import { NetsuiteQuery } from '../query'
import { TYPE_TO_IDENTIFIER } from './types'
import NetsuiteClient from '../client/client'
import { castFieldValue } from './custom_fields'
import { addIdentifierToValues, addIdentifierToType } from './multi_fields_identifiers'

const { awu } = collections.asynciterable
const log = logger(module)

export type DataTypeConfig = Record<string, string[]>

const setTypeSourceAnnotation = (type: ObjectType): void => {
  type.annotationRefTypes.source = new ReferenceExpression(
    BuiltinTypes.HIDDEN_STRING.elemID,
    BuiltinTypes.HIDDEN_STRING
  )
  type.annotations.source = 'soap'
}

export const getDataTypes = async (
  client: NetsuiteClient
): Promise<ObjectType[]> => {
  if (!client.isSuiteAppConfigured()) {
    return []
  }

  const wsdl = await client.getNetsuiteWsdl()
  if (wsdl === undefined) {
    log.warn('Failed to get WSDL, skipping data elements')
    return []
  }
  const types = await elementsComponents.soap.extractTypes(NETSUITE, wsdl)

  types.forEach(type => {
    setTypeSourceAnnotation(type)
    addIdentifierToType(type)
  })

  types
    .filter(type => TYPE_TO_IDENTIFIER[type.elemID.name] !== undefined)
    .forEach(type => {
      const field = type.fields[TYPE_TO_IDENTIFIER[type.elemID.name]]
      if (field !== undefined) {
        field.refType = new ReferenceExpression(
          BuiltinTypes.SERVICE_ID.elemID,
          BuiltinTypes.SERVICE_ID
        )
      } else {
        log.warn(`Identifier field ${TYPE_TO_IDENTIFIER[type.elemID.name]} does not exists on type ${type.elemID.getFullName()}`)
      }
    })
  return types
}

const getType = (
  values: Values,
  typesMap: Record<string, ObjectType>
): ObjectType => {
  const typeNames: string[] = Object.entries(values.attributes ?? {})
    .filter(([key, value]) => key.split(':')[1] === 'type' && typeof value === 'string')
    .map(([_key, value]) => {
      const valueStr = value as string
      return valueStr.includes(':') ? valueStr.split(':')[1] : valueStr
    })

  if (typeNames.length !== 1 || !(typeNames[0] in typesMap)) {
    log.warn(`Got invalid instance from SOAP request: ${JSON.stringify(values, undefined, 2)}`)
    throw new Error('Got invalid instance from SOAP request')
  }
  return typesMap[typeNames[0]]
}

const createInstance = async (
  values: Values,
  typesMap: Record<string, ObjectType>,
  elemIdGetter?: ElemIdGetter,
): Promise<InstanceElement> => {
  const type = getType(values, typesMap)
  const fixedValues = await transformValues({
    values,
    type,
    strict: false,
    transformFunc: async ({ value, field }) => castFieldValue(value, field),
  }) ?? values

  addIdentifierToValues(fixedValues, type)

  const serviceIdFieldName = TYPE_TO_IDENTIFIER[type.elemID.name]
  const identifierValue = fixedValues[serviceIdFieldName]
  const defaultName = naclCase(identifierValue)

  const name = elemIdGetter !== undefined ? elemIdGetter(
    NETSUITE,
    {
      [ADAPTER]: NETSUITE,
      [serviceIdFieldName]: identifierValue,
      [OBJECT_SERVICE_ID]: toServiceIdsString({
        [ADAPTER]: NETSUITE,
        [OBJECT_NAME]: type.elemID.getFullName(),
      }),
    },
    defaultName
  ).name : defaultName

  return new InstanceElement(
    name,
    type,
    fixedValues,
    [NETSUITE, RECORDS_PATH, type.elemID.name, pathNaclCase(name)],
  )
}

export const getDataElements = async (
  client: NetsuiteClient,
  query: NetsuiteQuery,
  elemIdGetter?: ElemIdGetter,
): Promise<Element[]> => {
  const types = await getDataTypes(client)

  const typesToFetch = Object.keys(TYPE_TO_IDENTIFIER).filter(query.isTypeMatch)
  if (typesToFetch.length === 0) {
    return types
  }

  const typesMap = _.keyBy(types, e => e.elemID.name)

  const availableTypesToFetch = typesToFetch.filter(typeName => typeName in typesMap)

  if (availableTypesToFetch.length === 0) {
    return types
  }

  const instances = await Promise.all((await client.getAllRecords(availableTypesToFetch))
    .map(record => createInstance(record, typesMap, elemIdGetter)))

  return [
    ...types,
    ...await awu(instances).filter(async instance => {
      const type = await instance.getType()
      return query.isObjectMatch({
        type: type.elemID.name,
        instanceId: instance.value[TYPE_TO_IDENTIFIER[type.elemID.name]],
      })
    }).toArray(),
  ]
}
