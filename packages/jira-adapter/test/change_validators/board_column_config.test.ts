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
import { toChange, InstanceElement } from '@salto-io/adapter-api'
import { boardColumnConfigValidator } from '../../src/change_validators/board_culomn_config'
import { BOARD_TYPE_NAME } from '../../src/constants'
import { createEmptyType } from '../utils'

describe('boardColumnConfigValidator', () => {
  let instance: InstanceElement

  beforeEach(() => {
    instance = new InstanceElement('instance', createEmptyType(BOARD_TYPE_NAME), {
      columnConfig: {
        columns: [
          {
            name: 'column1',
            statuses: ['status1'],
          },
        ],
      },
    })
  })

  it('should return an error when there is no column', async () => {
    instance.value.columnConfig.columns = []
    expect(
      await boardColumnConfigValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Unable to deploy Board without Columns and Statuses.',
        detailedMessage:
          'The board must have at least one column, and at least one of these columns must include a status. Please verify that these conditions are met before deploying it.',
      },
    ])
  })

  it('should return an error when there is no column config', async () => {
    instance.value.columnConfig = undefined
    expect(
      await boardColumnConfigValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Unable to deploy Board without Columns and Statuses.',
        detailedMessage:
          'The board must have at least one column, and at least one of these columns must include a status. Please verify that these conditions are met before deploying it.',
      },
    ])
  })

  it('should return an error when there is no at least one column with statuses', async () => {
    instance.value.columnConfig.columns[0].statuses = undefined
    expect(
      await boardColumnConfigValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Unable to deploy Board without Columns and Statuses.',
        detailedMessage:
          'The board must have at least one column, and at least one of these columns must include a status. Please verify that these conditions are met before deploying it.',
      },
    ])
  })

  it('should not return an error if there is at least one column with statuses', async () => {
    instance.value.columnConfig.columns.push({
      name: 'column2',
    })
    expect(
      await boardColumnConfigValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })
})
