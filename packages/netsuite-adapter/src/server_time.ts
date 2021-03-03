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
import { ObjectType, Element, ElemID, BuiltinTypes, CORE_ANNOTATIONS, InstanceElement, ReadOnlyElementsSource, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { NETSUITE, RECORDS_PATH, TYPES_PATH } from './constants'

const log = logger(module)

// The random suffix is to avoid collisions with netsuite types
export const SERVER_TIME_TYPE_NAME = 'server_time5a2ca8777a7743c3814ec83e3c4f0147'


export const createServerTimeElements = (time: Date): Element[] => {
  log.debug(`Creating server time elements with time: ${time.toJSON()}`)
  const type = new ObjectType({
    elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME),
    isSettings: true,
    fields: {
      serverTime: { type: BuiltinTypes.STRING },
    },
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
    path: [NETSUITE, TYPES_PATH, SERVER_TIME_TYPE_NAME],
  })

  const instance = new InstanceElement(
    ElemID.CONFIG_NAME,
    type,
    { serverTime: time.toJSON() },
    [NETSUITE, RECORDS_PATH, SERVER_TIME_TYPE_NAME],
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )

  return [type, instance]
}

export const getLastServerTime = async (elementsSource: ReadOnlyElementsSource):
  Promise<Date | undefined> => {
  log.debug('Getting server time')
  const serverTimeElement = await elementsSource.get(new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME))

  if (!isInstanceElement(serverTimeElement)) {
    log.info('Server time not found in elements source')
    return undefined
  }

  if (serverTimeElement.value.serverTime === undefined) {
    log.info('serverTime value does not exists in server time instance')
    return undefined
  }

  log.info(`Server time is ${serverTimeElement.value.serverTime}`)
  return new Date(serverTimeElement.value.serverTime)
}
