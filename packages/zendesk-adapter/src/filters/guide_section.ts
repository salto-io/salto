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

/* eslint-disable no-console */

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { SECTION_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { maybeModifySourceLocaleInGuideObject } from './article/utils'

const log = logger(module)

/**
 * Deploys sections in a guide
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'sectionFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [parentChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME,
    )
    console.log(changes)
    const deployResult = await deployChanges(parentChanges, async change => {
      console.log('in_changes: ')
      const res = await maybeModifySourceLocaleInGuideObject(change, client, 'sections')
      console.log('in_changes: ', res)
      if (!res) {
        log.error(`Attempting to modify the source_locale field in ${getChangeData(change).elemID.name} has failed `)
      }

      await deployChange(change, client, config.apiDefinitions, ['source_locale'])
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
