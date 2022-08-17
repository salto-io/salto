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
import { ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, InstanceElement, ReadOnlyElementsSource, isInstanceElement, MapType, createRefToElmWithValue } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { NETSUITE } from './constants'

const log = logger(module)

export const SERVER_TIME_TYPE_NAME = 'server_time'

type ServerTypeElements = {
  type: ObjectType
  instance: InstanceElement
}

const serverTimeElemID = new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME)
const serverTimeInstanceElemID = new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)

export const createServerTimeElements = (time: Date): ServerTypeElements => {
  log.debug(`Creating server time elements with time: ${time.toJSON()}`)
  const type = new ObjectType({
    elemID: serverTimeElemID,
    isSettings: true,
    fields: {
      serverTime: { refType: BuiltinTypes.STRING },
      instancesFetchTime: { refType: new MapType(BuiltinTypes.STRING) },
    },
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
  })

  const instance = new InstanceElement(
    ElemID.CONFIG_NAME,
    type,
    {
      serverTime: time.toJSON(),
      instancesFetchTime: {},
    },
    undefined,
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )

  return { type, instance }
}

const getExistingServerTimeElements = async (
  time: Date,
  elementsSource: ReadOnlyElementsSource,
): Promise<ServerTypeElements> => {
  const type = await elementsSource.get(serverTimeElemID)
  const instance = await elementsSource.get(serverTimeInstanceElemID)
  if (type === undefined || !isInstanceElement(instance)) {
    log.warn('Server time not found in elements source')
    return createServerTimeElements(time)
  }
  // Resolve the type of the instance cause it's used inside the adapter that assumes resolved types
  instance.refType = createRefToElmWithValue(type)
  return { type, instance }
}

export const getServerTimeElements = async (
  time: Date,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<ServerTypeElements> => (isPartial
  ? getExistingServerTimeElements(time, elementsSource)
  : createServerTimeElements(time)
)

export const getLastServiceIdToFetchTime = async (elementsSource: ReadOnlyElementsSource):
  Promise<Record<string, Date>> => {
  const serverTimeElement = await elementsSource.get(serverTimeInstanceElemID)

  if (!isInstanceElement(serverTimeElement)) {
    log.warn('Server time instance not found in elements source')
    return {}
  }

  const { instancesFetchTime } = serverTimeElement.value
  if (instancesFetchTime === undefined) {
    log.warn('instancesFetchTime value does not exists in server time instance')
    return {}
  }
  return _.mapValues(
    instancesFetchTime,
    timeJson => new Date(timeJson),
  )
}

export const getLastServerTime = async (elementsSource: ReadOnlyElementsSource):
  Promise<Date | undefined> => {
  log.debug('Getting server time')
  const serverTimeElement = await elementsSource.get(serverTimeInstanceElemID)

  if (!isInstanceElement(serverTimeElement)) {
    log.warn('Server time not found in elements source')
    return undefined
  }

  const { serverTime } = serverTimeElement.value
  if (serverTime === undefined) {
    log.warn('serverTime value does not exists in server time instance')
    return undefined
  }

  log.info(`Last server time is ${serverTime}`)
  return new Date(serverTime)
}
