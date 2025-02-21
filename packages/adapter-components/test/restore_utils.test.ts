/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  AdditionChange,
  getChangeData,
  InstanceElement,
  ModificationChange,
  RemovalChange,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { getName, mockInstance } from './utils'
import { restoreChangeElement, RestoreValuesFunc } from '../src/restore_utils'

describe('restore/ResolveChangeElement functions', () => {
  let afterData: InstanceElement
  let beforeData: InstanceElement
  let removalChange: RemovalChange<InstanceElement>
  let additionChange: AdditionChange<InstanceElement>
  let modificationChange: ModificationChange<InstanceElement>
  beforeEach(() => {
    beforeData = mockInstance.clone()
    afterData = mockInstance.clone()
    additionChange = { action: 'add', data: { after: afterData } }
    removalChange = { action: 'remove', data: { before: beforeData } }
    modificationChange = { action: 'modify', data: { before: beforeData, after: afterData } }
  })

  describe('restoreChangeElement func', () => {
    let mockRestore: RestoreValuesFunc
    beforeEach(() => {
      mockRestore = jest
        .fn()
        .mockImplementation(
          <T extends Element>(_source: T, targetElement: T, _getLookUpName: GetLookupNameFunc) => targetElement,
        )
    })
    describe('with addition change', () => {
      let sourceChange: AdditionChange<InstanceElement>
      let restoredChange: AdditionChange<InstanceElement>
      beforeEach(async () => {
        sourceChange = { action: 'add', data: { after: afterData.clone() } }
        const sourceChanges = _.keyBy([sourceChange], c => getChangeData(c).elemID.getFullName())
        restoredChange = (await restoreChangeElement(
          additionChange,
          sourceChanges,
          getName,
          mockRestore,
        )) as AdditionChange<InstanceElement>
      })
      it('should call restore func on the after data', () => {
        expect(mockRestore).toHaveBeenCalledWith(sourceChange.data.after, afterData, getName)
      })
      it('should return the after data from the source change', () => {
        expect(restoredChange.data.after).toStrictEqual(sourceChange.data.after)
      })
    })
    describe('with removal change', () => {
      let sourceChange: RemovalChange<InstanceElement>
      let restoredChange: RemovalChange<InstanceElement>
      beforeEach(async () => {
        sourceChange = { action: 'remove', data: { before: beforeData.clone() } }
        const sourceChanges = _.keyBy([sourceChange], c => getChangeData(c).elemID.getFullName())
        restoredChange = (await restoreChangeElement(
          removalChange,
          sourceChanges,
          getName,
          mockRestore,
        )) as RemovalChange<InstanceElement>
      })
      it('should not call restore func on the before data', () => {
        expect(mockRestore).not.toHaveBeenCalled()
      })
      it('should return the before data from the source change', () => {
        expect(restoredChange.data.before).toBe(sourceChange.data.before)
      })
    })
    describe('with modification change', () => {
      let sourceChange: ModificationChange<InstanceElement>
      let restoredChange: ModificationChange<InstanceElement>
      beforeEach(async () => {
        sourceChange = {
          action: 'modify',
          data: { before: beforeData.clone(), after: afterData.clone() },
        }
        const sourceChanges = _.keyBy([sourceChange], c => getChangeData(c).elemID.getFullName())
        restoredChange = (await restoreChangeElement(
          modificationChange,
          sourceChanges,
          getName,
          mockRestore,
        )) as ModificationChange<InstanceElement>
      })
      it('should call the restore func only on the after data', () => {
        expect(mockRestore).toHaveBeenCalledTimes(1)
        expect(mockRestore).toHaveBeenCalledWith(sourceChange.data.after, afterData, getName)
      })
      it('should return the before data from the source change', () => {
        expect(restoredChange.data.before).toBe(sourceChange.data.before)
      })
    })
  })
})
