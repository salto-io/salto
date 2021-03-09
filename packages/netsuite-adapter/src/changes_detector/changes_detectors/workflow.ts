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
import { logger } from '@salto-io/logging'
import { TypeChangesDetector } from '../types'

const log = logger(module)

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const results = await client.runSavedSearchQuery({
      type: 'systemnote',
      filters: [
        ['recordtype', 'is', '-129'],
        'and',
        ['date', 'within', ...dateRange.toSavedSearchRange()],
      ],
      columns: ['recordid'],
    })

    if (results === undefined) {
      log.warn('workflow changes query failed')
      return []
    }

    if (results.length === 0) {
      return []
    }

    return [
      {
        type: 'type',
        name: 'workflow',
      },
    ]
  },
  getTypes: () => ([
    'workflow',
  ]),
}

export default changesDetector
