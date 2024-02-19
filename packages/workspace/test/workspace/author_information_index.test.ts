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
import {
  AdditionChange,
  AuthorInformation,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  RemovalChange,
  Value,
  getChangeData,
  toChange,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { RemoteMap } from '../../src/workspace/remote_map'
import { createMockRemoteMap } from '../utils'
import {
  AUTHOR_INFORMATION_INDEX_VERSION,
  updateAuthorInformationIndex,
} from '../../src/workspace/author_information_index'

describe('author information index', () => {
  let authorInformationIndex: MockInterface<RemoteMap<AuthorInformation>>
  let mapVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource
  let modifiedObjectChange: ModificationChange<ObjectType>
  let addedInstanceChange: AdditionChange<InstanceElement>
  let addedInstanceWithoutAuthorChange: AdditionChange<InstanceElement>
  let modifiedInstanceChange: ModificationChange<InstanceElement>
  let modifiedInstanceWithoutAuthorChange: ModificationChange<InstanceElement>
  let modifiedInstanceWithSameAuthorChange: ModificationChange<InstanceElement>
  let modifiedToEmptyChange: ModificationChange<InstanceElement>
  let deletedInstanceChange: RemovalChange<InstanceElement>
  let expectedSetAllCalledWith: Value[]

  beforeEach(() => {
    jest.resetAllMocks()
    authorInformationIndex = createMockRemoteMap<AuthorInformation>()
    mapVersions = createMockRemoteMap<number>()
    mapVersions.get.mockResolvedValue(AUTHOR_INFORMATION_INDEX_VERSION)
    elementsSource = createInMemoryElementSource()

    modifiedObjectChange = {
      action: 'modify',
      data: {
        before: new ObjectType({
          elemID: new ElemID('test', 'object'),
          fields: {
            removedField: {
              refType: BuiltinTypes.STRING,
              annotations: {
                [CORE_ANNOTATIONS.CHANGED_AT]: '2022-03-18 11:00:00',
                [CORE_ANNOTATIONS.CHANGED_BY]: 'Old Salto User',
              },
            },
            modifiedField: {
              refType: BuiltinTypes.STRING,
              annotations: {
                [CORE_ANNOTATIONS.CHANGED_AT]: '2022-03-18 12:00:00',
                [CORE_ANNOTATIONS.CHANGED_BY]: 'Old Salto User',
              },
            },
          },
          annotations: {
            [CORE_ANNOTATIONS.CHANGED_AT]: '2022-03-18 10:00:00',
            [CORE_ANNOTATIONS.CHANGED_BY]: 'Old Salto User',
          },
        }),
        after: new ObjectType({
          elemID: new ElemID('test', 'object'),
          fields: {
            modifiedField: {
              refType: BuiltinTypes.STRING,
              annotations: {
                [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-18 12:00:00',
                [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
              },
            },
            addedField: {
              refType: BuiltinTypes.STRING,
              annotations: {
                [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-18 13:00:00',
                [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
              },
            },
          },
          annotations: {
            [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-18 10:00:00',
            [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
          },
        }),
      },
    }
    addedInstanceChange = {
      action: 'add',
      data: {
        after: new InstanceElement('instance1', getChangeData(modifiedObjectChange), {}, undefined, {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-19 10:00:00',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
        }),
      },
    }
    addedInstanceWithoutAuthorChange = {
      action: 'add',
      data: {
        after: new InstanceElement('instance2', getChangeData(modifiedObjectChange), {}, undefined, {}),
      },
    }
    modifiedInstanceChange = {
      action: 'modify',
      data: {
        before: new InstanceElement('instance3', getChangeData(modifiedObjectChange), {}, undefined, {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2022-03-20 10:00:00',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Old Salto User',
        }),
        after: new InstanceElement('instance3', getChangeData(modifiedObjectChange), {}, undefined, {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-20 10:00:00',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
        }),
      },
    }
    modifiedInstanceWithoutAuthorChange = {
      action: 'modify',
      data: {
        before: new InstanceElement('instance4', getChangeData(modifiedObjectChange), {}, undefined, {}),
        after: new InstanceElement('instance4', getChangeData(modifiedObjectChange), {}, undefined, {}),
      },
    }
    modifiedInstanceWithSameAuthorChange = {
      action: 'modify',
      data: {
        before: new InstanceElement('instance5', getChangeData(modifiedObjectChange), {}, undefined, {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-24 10:00:00',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
        }),
        after: new InstanceElement('instance5', getChangeData(modifiedObjectChange), {}, undefined, {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-24 10:00:00',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
        }),
      },
    }
    modifiedToEmptyChange = {
      action: 'modify',
      data: {
        before: new InstanceElement('instance6', getChangeData(modifiedObjectChange), {}, undefined, {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2022-03-21 10:00:00',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Old Salto User',
        }),
        after: new InstanceElement('instance6', getChangeData(modifiedObjectChange), {}, undefined, {}),
      },
    }
    deletedInstanceChange = {
      action: 'remove',
      data: {
        before: new InstanceElement('instance7', getChangeData(modifiedObjectChange), {}, undefined, {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2022-03-22 10:00:00',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Old Salto User',
        }),
      },
    }
    expectedSetAllCalledWith = [
      {
        key: getChangeData(modifiedObjectChange).elemID.getFullName(),
        value: { changedBy: 'Salto User', changedAt: '2023-03-18 10:00:00' },
      },
      {
        key: getChangeData(addedInstanceChange).elemID.getFullName(),
        value: { changedBy: 'Salto User', changedAt: '2023-03-19 10:00:00' },
      },
      {
        key: getChangeData(modifiedInstanceChange).elemID.getFullName(),
        value: { changedBy: 'Salto User', changedAt: '2023-03-20 10:00:00' },
      },
      {
        key: getChangeData(modifiedObjectChange).elemID.createNestedID('field', 'modifiedField').getFullName(),
        value: { changedBy: 'Salto User', changedAt: '2023-03-18 12:00:00' },
      },
      {
        key: getChangeData(modifiedObjectChange).elemID.createNestedID('field', 'addedField').getFullName(),
        value: { changedBy: 'Salto User', changedAt: '2023-03-18 13:00:00' },
      },
    ]
  })

  describe('mixed changes', () => {
    beforeEach(async () => {
      const changes = [
        modifiedObjectChange,
        addedInstanceChange,
        addedInstanceWithoutAuthorChange,
        modifiedInstanceChange,
        modifiedInstanceWithoutAuthorChange,
        modifiedInstanceWithSameAuthorChange,
        modifiedToEmptyChange,
        deletedInstanceChange,
      ]
      await updateAuthorInformationIndex(changes, authorInformationIndex, mapVersions, elementsSource, true)
    })
    it('should add the new instances changed by values to index', () => {
      expect(authorInformationIndex.setAll).toHaveBeenCalledWith(expectedSetAllCalledWith)
      expect(authorInformationIndex.deleteAll).toHaveBeenCalledWith([
        getChangeData(deletedInstanceChange).elemID.getFullName(),
        getChangeData(modifiedObjectChange).elemID.createNestedID('field', 'removedField').getFullName(),
        getChangeData(modifiedToEmptyChange).elemID.getFullName(),
      ])
    })
  })

  describe('invalid indexes', () => {
    describe('When cache is invalid', () => {
      beforeEach(async () => {
        await updateAuthorInformationIndex(
          // all elements will be considered as new when cache is invalid
          [
            toChange({ after: getChangeData(modifiedObjectChange) }),
            toChange({ after: getChangeData(addedInstanceChange) }),
            toChange({ after: getChangeData(modifiedInstanceChange) }),
            toChange({ after: getChangeData(addedInstanceWithoutAuthorChange) }),
          ],
          authorInformationIndex,
          mapVersions,
          elementsSource,
          false,
        )
      })
      it('should update changed by index with all additions', () => {
        expect(authorInformationIndex.clear).toHaveBeenCalled()
        expect(authorInformationIndex.setAll).toHaveBeenCalledWith(expectedSetAllCalledWith)
        expect(authorInformationIndex.deleteAll).toHaveBeenCalledWith([])
      })
    })

    describe('When indexes are out of date', () => {
      beforeEach(async () => {
        await elementsSource.set(getChangeData(modifiedObjectChange))
        await elementsSource.set(getChangeData(addedInstanceChange))
        await elementsSource.set(getChangeData(modifiedInstanceChange))
        await elementsSource.set(getChangeData(addedInstanceWithoutAuthorChange))
        mapVersions.get.mockResolvedValue(0)
        await updateAuthorInformationIndex([], authorInformationIndex, mapVersions, elementsSource, true)
      })
      it('should update changed by index using the element source', () => {
        expect(authorInformationIndex.clear).toHaveBeenCalled()
        expect(authorInformationIndex.setAll).toHaveBeenCalledWith(expectedSetAllCalledWith)
        expect(authorInformationIndex.deleteAll).toHaveBeenCalledWith([])
      })
    })
  })
})
