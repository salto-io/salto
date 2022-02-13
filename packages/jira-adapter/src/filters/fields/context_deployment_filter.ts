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
import { Element, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { deployContextChange, setContextDeploymentAnnotations } from './contexts'
import { deployChanges } from '../../deployment/deployment'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from './constants'
import { findObject, setDeploymentAnnotations } from '../../utils'

const log = logger(module)

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    const fieldType = findObject(elements, FIELD_TYPE_NAME)
    if (fieldType === undefined) {
      log.warn(`Could not find type ${FIELD_TYPE_NAME}`)
    } else {
      setDeploymentAnnotations(fieldType, 'contexts')
    }

    const fieldContextType = findObject(elements, FIELD_CONTEXT_TYPE_NAME)
    if (fieldContextType === undefined) {
      log.warn(`Could not find type ${FIELD_CONTEXT_TYPE_NAME}`)
    } else {
      await setContextDeploymentAnnotations(fieldContextType)
    }
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      change => deployContextChange(change, client, config.apiDefinitions)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
