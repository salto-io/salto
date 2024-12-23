/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, InstanceElement } from '@salto-io/adapter-api'
import { kanbanBoardBacklogValidator } from '../../../src/change_validators/boards/kanban_board_backlog'
import { BOARD_TYPE_NAME } from '../../../src/constants'
import { createEmptyType } from '../../utils'

const ERROR_TITLE = 'Unable to deploy a Kanban Board When the first column is not named "Backlog"'
const ERROR_MESSAGE =
  'A Kanban board must have a first column named Backlog. If you did not edit the board manually please fetch both envs and try again'
describe('kanbanBoardBacklogValidator', () => {
  let instance: InstanceElement
  let instance2: InstanceElement
  let noErrorInstance: InstanceElement
  const boardType = createEmptyType(BOARD_TYPE_NAME)

  beforeEach(() => {
    instance = new InstanceElement('instance', boardType, {
      type: 'kanban',
      columnConfig: {
        columns: [
          {
            name: 'column1',
          },
          {
            name: 'Backlog',
          },
        ],
      },
    })
    instance2 = new InstanceElement('instance2', boardType, {
      type: 'scrum',
      columnConfig: {
        columns: [
          {
            name: 'column1',
          },
        ],
      },
    })
    noErrorInstance = new InstanceElement('noErrorInstance', boardType, {
      type: 'kanban',
      columnConfig: {
        columns: [
          {
            name: 'Backlog',
          },
          {
            name: 'column2',
          },
        ],
      },
    })
  })

  it('should return an error when there is no column', async () => {
    instance.value.columnConfig.columns = []
    expect(
      await kanbanBoardBacklogValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: ERROR_TITLE,
        detailedMessage: ERROR_MESSAGE,
      },
    ])
  })

  it('should return an error when there is no column config', async () => {
    instance.value.columnConfig = undefined
    expect(
      await kanbanBoardBacklogValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: ERROR_TITLE,
        detailedMessage: ERROR_MESSAGE,
      },
    ])
  })

  it('should return an error when the first column is not Backlog', async () => {
    expect(
      await kanbanBoardBacklogValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: ERROR_TITLE,
        detailedMessage: ERROR_MESSAGE,
      },
    ])
  })

  it('should not return an error if the first column is Backlog', async () => {
    expect(
      await kanbanBoardBacklogValidator([
        toChange({
          after: noErrorInstance,
        }),
      ]),
    ).toEqual([])
  })
  it('should not return an error if the board is not kanban', async () => {
    expect(
      await kanbanBoardBacklogValidator([
        toChange({
          after: instance2,
        }),
      ]),
    ).toEqual([])
  })
  it('it should return several errors if they exist', async () => {
    const faultInstance = new InstanceElement('faultInstance', boardType, {
      type: 'kanban',
      columnConfig: {
        columns: [
          {
            name: 'column1',
          },
        ],
      },
    })
    expect(
      await kanbanBoardBacklogValidator([
        toChange({
          after: instance,
        }),
        toChange({
          before: instance,
          after: instance2,
        }),
        toChange({
          after: noErrorInstance,
        }),
        toChange({
          after: faultInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: ERROR_TITLE,
        detailedMessage: ERROR_MESSAGE,
      },
      {
        elemID: faultInstance.elemID,
        severity: 'Error',
        message: ERROR_TITLE,
        detailedMessage: ERROR_MESSAGE,
      },
    ])
  })
})
