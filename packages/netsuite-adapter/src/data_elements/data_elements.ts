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
import { InstanceElement, ObjectType, Element, BuiltinTypes, ReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { elements as elementsComponents } from '@salto-io/adapter-components'
import _ from 'lodash'
import { naclCase, pathNaclCase, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { NETSUITE, RECORDS_PATH } from '../constants'
import { NetsuiteQuery } from '../query'
import { TYPE_TO_IDENTIFIER } from './types'
import NetsuiteClient from '../client/client'

const { awu } = collections.asynciterable
const log = logger(module)

export type DataTypeConfig = Record<string, string[]>

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
    type.annotationRefTypes.source = new ReferenceExpression(
      BuiltinTypes.HIDDEN_STRING.elemID,
      BuiltinTypes.HIDDEN_STRING
    )
    type.annotations.source = 'soap'
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
  record: Record<string, unknown>,
  typesMap: Record<string, ObjectType>
): ObjectType => {
  const attributes = record.attributes as Record<string, unknown> | undefined

  const typeNames: string[] = Object.entries(attributes ?? {})
    .filter(([key, value]) => key.split(':')[1] === 'type' && typeof value === 'string')
    .map(([_key, value]) => {
      const valueStr = value as string
      return valueStr.includes(':') ? valueStr.split(':')[1] : valueStr
    })

  if (typeNames.length !== 1 || !(typeNames[0] in typesMap)) {
    log.warn(`Got invalid instance from SOAP request: ${JSON.stringify(record, undefined, 2)}`)
    throw new Error('Got invalid instance from SOAP request')
  }
  return typesMap[typeNames[0]]
}

const createInstance = async (
  record: Record<string, unknown>,
  typesMap: Record<string, ObjectType>,
): Promise<InstanceElement> => {
  const type = getType(record, typesMap)
  const fixedRecord = await transformValues({
    values: record,
    type,
    strict: false,
    transformFunc: async ({ value, field }) => {
      if (typeof value === 'object' && 'attributes' in value) {
        _.assign(value, value.attributes)
        delete value.attributes
        delete value['xsi:type']
      }

      if (value instanceof Date) {
        return value.toString()
      }

      if (typeof value === 'string') {
        const fieldType = await field?.getType()
        if (fieldType?.elemID.isEqual(BuiltinTypes.BOOLEAN.elemID)) {
          return value === 'true'
        }
        if (fieldType?.elemID.isEqual(BuiltinTypes.NUMBER.elemID)) {
          return parseInt(value, 10)
        }
      }
      return value
    },
  })
  const id = naclCase(fixedRecord?.[TYPE_TO_IDENTIFIER[type.elemID.name]])
  return new InstanceElement(
    id,
    type,
    fixedRecord,
    [NETSUITE, RECORDS_PATH, type.elemID.name, pathNaclCase(id)],
  )
}

export const getDataElements = async (
  client: NetsuiteClient,
  query: NetsuiteQuery,
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

  const instances = await awu(await client.getAllRecords(availableTypesToFetch))
    .map(record => createInstance(record, typesMap))
    .toArray()

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
