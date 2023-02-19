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
import { InstanceElement, ObjectType, BuiltinTypes, ElemIdGetter, OBJECT_SERVICE_ID, toServiceIdsString, OBJECT_NAME, Values, createRefToElmWithValue } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { naclCase, pathNaclCase, transformValues } from '@salto-io/adapter-utils'
import { collections, strings } from '@salto-io/lowerdash'
import { NETSUITE, RECORDS_PATH, SOAP } from '../constants'
import { NetsuiteQuery } from '../query'
import { getTypeIdentifier, SUPPORTED_TYPES } from './types'
import NetsuiteClient from '../client/client'
import { castFieldValue } from './custom_fields'
import { addIdentifierToValues, addIdentifierToType } from './multi_fields_identifiers'

const { awu } = collections.asynciterable
const log = logger(module)

export type DataTypeConfig = Record<string, string[]>

const setTypeSourceAnnotation = (type: ObjectType): void => {
  type.annotationRefTypes.source = createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING)
  type.annotations.source = SOAP
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
  const types = await elementUtils.soap.extractTypes(NETSUITE, wsdl, { camelCase: true })

  types.forEach(type => {
    setTypeSourceAnnotation(type)
    addIdentifierToType(type)
  })

  types
    .filter(type => getTypeIdentifier(type) !== undefined)
    .forEach(type => {
      const identifierField = getTypeIdentifier(type)
      const field = type.fields[identifierField]
      if (field !== undefined) {
        field.refType = createRefToElmWithValue(BuiltinTypes.SERVICE_ID)
      } else {
        log.warn(`Identifier field ${identifierField} does not exists on type ${type.elemID.getFullName()}`)
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

  if (typeNames.length !== 1 || !(strings.lowerCaseFirstLetter(typeNames[0]) in typesMap)) {
    log.warn(`Got invalid instance from SOAP request: ${JSON.stringify(values, undefined, 2)}`)
    throw new Error('Got invalid instance from SOAP request')
  }
  return typesMap[strings.lowerCaseFirstLetter(typeNames[0])]
}

const createInstances = async (
  valuesList: Values[],
  typesMap: Record<string, ObjectType>,
  elemIdGetter?: ElemIdGetter,
): Promise<InstanceElement[]> => {
  const fixedValuesList = await awu(valuesList).map(async values => {
    const type = getType(values, typesMap)
    return {
      values: await transformValues({
        values,
        type,
        strict: false,
        transformFunc: async ({ value, field }) => castFieldValue(value, field),
      }) ?? values,
      type,
    }
  }).toArray()

  addIdentifierToValues(fixedValuesList)

  return fixedValuesList.map(({ values, type }) => {
    const serviceIdFieldName = getTypeIdentifier(type)
    const identifierValue = values[serviceIdFieldName]
    const defaultName = naclCase(identifierValue)

    const name = elemIdGetter !== undefined ? elemIdGetter(
      NETSUITE,
      {
        [serviceIdFieldName]: identifierValue,
        [OBJECT_SERVICE_ID]: toServiceIdsString({
          [OBJECT_NAME]: type.elemID.getFullName(),
        }),
      },
      defaultName
    ).name : defaultName

    return new InstanceElement(
      name,
      type,
      values,
      [NETSUITE, RECORDS_PATH, type.elemID.name, pathNaclCase(name)],
    )
  })
}

export const getDataElements = async (
  client: NetsuiteClient,
  query: NetsuiteQuery,
  elemIdGetter?: ElemIdGetter,
): Promise<(ObjectType | InstanceElement)[]> => {
  const types = await getDataTypes(client)

  const typesToFetch = SUPPORTED_TYPES.filter(query.isTypeMatch)
  if (typesToFetch.length === 0) {
    return types
  }

  const typesMap = _.keyBy(types, e => e.elemID.name)

  const availableTypesToFetch = typesToFetch.filter(typeName => typeName in typesMap)

  if (availableTypesToFetch.length === 0) {
    return types
  }

  const instances = await createInstances(
    await client.getAllRecords(availableTypesToFetch),
    typesMap,
    elemIdGetter,
  )

  return [
    ...types,
    ...await awu(instances).filter(async instance => {
      const type = await instance.getType()
      return query.isObjectMatch({
        type: type.elemID.name,
        instanceId: instance.value[getTypeIdentifier(type)],
      })
    }).toArray(),
  ]
}
