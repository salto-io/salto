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
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { APP_OWNED_TYPE_NAME } from '../constants'

const log = logger(module)

const turnParametersFieldToMap = (element: InstanceElement): void => {
  element.value.parameters = _.keyBy(element.value.parameters, 'name')
}

/**
 * Converts app_owned parameters field to map object
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async elements => log.time(async () => {
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === APP_OWNED_TYPE_NAME)
      .filter(e => !_.isEmpty(e.value.parameters))
      .map(turnParametersFieldToMap)
  }, 'App_owned parameters filter'),
})

export default filterCreator
