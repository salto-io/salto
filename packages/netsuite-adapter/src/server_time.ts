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
import { NETSUITE } from './constants'

const log = logger(module)

export const SERVER_TIME_TYPE_NAME = 'server_time'


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
  })

  const instance = new InstanceElement(
    ElemID.CONFIG_NAME,
    type,
    { serverTime: time.toJSON() },
    undefined,
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )

  return [type, instance]
}

export const getLastServerTime = async (elementsSource: ReadOnlyElementsSource):
  Promise<Date | undefined> => {
  log.debug('Getting server time')
  const serverTimeElement = await elementsSource.get(new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME, 'instance', ElemID.CONFIG_NAME))

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
