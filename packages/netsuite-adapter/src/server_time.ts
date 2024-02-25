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
import _ from 'lodash'
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  InstanceElement,
  ReadOnlyElementsSource,
  isInstanceElement,
  MapType,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { NETSUITE } from './constants'

const log = logger(module)

export const SERVER_TIME_TYPE_NAME = 'server_time'

const SERVER_TIME_TYPE_ID = new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME)
const SERVER_TIME_INSTANCE_ID = new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)

const serverTimeType = new ObjectType({
  elemID: SERVER_TIME_TYPE_ID,
  isSettings: true,
  fields: {
    serverTime: { refType: BuiltinTypes.STRING },
    instancesFetchTime: { refType: new MapType(BuiltinTypes.STRING) },
  },
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})

export const createServerTimeElements = (time: Date): [ObjectType, InstanceElement] => {
  log.debug(`Creating server time elements with time: ${time.toJSON()}`)
  const instance = new InstanceElement(ElemID.CONFIG_NAME, serverTimeType, { serverTime: time.toJSON() }, undefined, {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  })

  return [serverTimeType, instance]
}

const getExistingServerTimeElements = async (
  time: Date,
  elementsSource: ReadOnlyElementsSource,
): Promise<[ObjectType, InstanceElement]> => {
  const instance = await elementsSource.get(SERVER_TIME_INSTANCE_ID)
  if (!isInstanceElement(instance)) {
    log.warn('Server time instance not found in elements source')
    return createServerTimeElements(time)
  }
  // Resolve the type of the instance cause it's used inside the adapter that assumes resolved types
  instance.refType = createRefToElmWithValue(serverTimeType)

  return [serverTimeType, instance]
}

export const getOrCreateServerTimeElements = async (
  time: Date,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<[ObjectType, InstanceElement]> =>
  isPartial ? getExistingServerTimeElements(time, elementsSource) : createServerTimeElements(time)

export const getLastServiceIdToFetchTime = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<Record<string, Date>> => {
  const serverTimeElement = await elementsSource.get(SERVER_TIME_INSTANCE_ID)

  if (!isInstanceElement(serverTimeElement)) {
    log.warn('Server time instance not found in elements source')
    return {}
  }

  const { instancesFetchTime } = serverTimeElement.value
  if (instancesFetchTime === undefined) {
    log.warn('instancesFetchTime value does not exists in server time instance')
    return {}
  }
  return _.mapValues(instancesFetchTime, timeJson => new Date(timeJson))
}

export const getLastServerTime = async (elementsSource: ReadOnlyElementsSource): Promise<Date | undefined> => {
  log.debug('Getting server time')
  const serverTimeInstance = await elementsSource.get(SERVER_TIME_INSTANCE_ID)

  if (!isInstanceElement(serverTimeInstance)) {
    log.warn('Server time instance not found in elements source')
    return undefined
  }

  const { serverTime } = serverTimeInstance.value
  if (serverTime === undefined) {
    log.warn('serverTime value does not exists in server time instance')
    return undefined
  }

  log.info(`Last server time is ${serverTime}`)
  return new Date(serverTime)
}
