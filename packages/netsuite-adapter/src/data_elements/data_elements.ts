/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  InstanceElement,
  ObjectType,
  BuiltinTypes,
  ElemIdGetter,
  OBJECT_SERVICE_ID,
  toServiceIdsString,
  OBJECT_NAME,
  Values,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { soap } from '@salto-io/adapter-components'
import _ from 'lodash'
import { naclCase, pathNaclCase, transformValues } from '@salto-io/adapter-utils'
import { collections, strings } from '@salto-io/lowerdash'
import { INTERNAL_ID, NETSUITE, RECORDS_PATH, SOAP } from '../constants'
import { NetsuiteQuery } from '../config/query'
import { getTypeIdentifier, SUPPORTED_TYPES } from './types'
import NetsuiteClient from '../client/client'
import { ATTRIBUTES } from '../client/suiteapp_client/constants'
import { DataElementsResult } from '../client/types'
import { castFieldValue } from './custom_fields'
import { addIdentifierToValues, addIdentifierToType } from './multi_fields_identifiers'

const { awu } = collections.asynciterable
const log = logger(module)

const setTypeSourceAnnotation = (type: ObjectType): void => {
  type.annotationRefTypes.source = createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING)
  type.annotations.source = SOAP
}

const setServiceIdField = (type: ObjectType): void => {
  if (type.fields[INTERNAL_ID] === undefined) {
    return
  }
  type.fields[INTERNAL_ID].refType = createRefToElmWithValue(BuiltinTypes.SERVICE_ID)
}

export const getDataTypes = async (client: NetsuiteClient): Promise<ObjectType[]> => {
  if (!client.isSuiteAppConfigured()) {
    return []
  }

  const wsdl = await client.getNetsuiteWsdl()
  if (wsdl === undefined) {
    log.warn('Failed to get WSDL, skipping data elements')
    return []
  }
  const types = await soap.extractTypes(NETSUITE, wsdl, { camelCase: true })

  types.forEach(type => {
    setTypeSourceAnnotation(type)
    addIdentifierToType(type)
    setServiceIdField(type)
  })

  return types
}

const getType = (values: Values, typesMap: Record<string, ObjectType>): ObjectType => {
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
  const fixedValuesList = await awu(valuesList)
    .map(async values => {
      const type = getType(values, typesMap)
      return {
        values:
          (await transformValues({
            values,
            type,
            strict: false,
            transformFunc: async ({ value, field }) => castFieldValue(value, field),
          })) ?? values,
        type,
      }
    })
    .toArray()

  addIdentifierToValues(fixedValuesList)

  return fixedValuesList.map(({ values, type }) => {
    const serviceIdFieldName = getTypeIdentifier(type)
    const identifierValue = values[serviceIdFieldName]
    const defaultName = naclCase(identifierValue)

    const name =
      elemIdGetter !== undefined
        ? elemIdGetter(
            NETSUITE,
            {
              [INTERNAL_ID]: values[ATTRIBUTES][INTERNAL_ID],
              [OBJECT_SERVICE_ID]: toServiceIdsString({
                [OBJECT_NAME]: type.elemID.getFullName(),
              }),
            },
            defaultName,
          ).name
        : defaultName

    return new InstanceElement(name, type, values, [NETSUITE, RECORDS_PATH, type.elemID.name, pathNaclCase(name)])
  })
}

export const getDataElements = async (
  client: NetsuiteClient,
  query: NetsuiteQuery,
  elemIdGetter?: ElemIdGetter,
): Promise<DataElementsResult> => {
  const types = await getDataTypes(client)

  const typesToFetch = SUPPORTED_TYPES.filter(query.isTypeMatch)
  if (typesToFetch.length === 0) {
    return { elements: types, requestedTypes: [], largeTypesError: [] }
  }

  const typesMap = _.keyBy(types, e => e.elemID.name)

  const availableTypesToFetch = typesToFetch.filter(typeName => typeName in typesMap)

  if (availableTypesToFetch.length === 0) {
    return { elements: types, requestedTypes: [], largeTypesError: [] }
  }

  const { records: allRecords, largeTypesError } = await client.getAllRecords(availableTypesToFetch)
  const instances = await createInstances(allRecords, typesMap, elemIdGetter)

  return {
    elements: [
      ...types,
      ...(await awu(instances)
        .filter(async instance => {
          const type = await instance.getType()
          return query.isObjectMatch({
            type: type.elemID.name,
            instanceId: instance.value[getTypeIdentifier(type)],
          })
        })
        .toArray()),
    ],
    requestedTypes: availableTypesToFetch,
    largeTypesError,
  }
}
