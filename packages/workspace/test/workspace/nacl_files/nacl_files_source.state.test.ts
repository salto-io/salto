/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ModificationChange,
  InstanceElement,
  RemovalChange,
  ObjectType,
  ElemID,
  AdditionChange,
  BuiltinTypes,
  TypeReference,
  toChange,
  getChangeData,
  isEqualElements,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { detailedCompare, getDetailedChanges } from '@salto-io/adapter-utils'
import { DirectoryStore } from '../../../src/workspace/dir_store'

import { NaclFile, naclFilesSource, NaclFilesSource } from '../../../src/workspace/nacl_files'
import { StaticFilesSource } from '../../../src/workspace/static_files'

import { mockStaticFilesSource } from '../../utils'
import { mockDirStore as createMockDirStore } from '../../common/nacl_file_store'
import { inMemRemoteMapCreator } from '../../../src/workspace/remote_map'

const { awu } = collections.asynciterable

describe('Nacl Files Source', () => {
  let mockDirStore: DirectoryStore<string>
  let mockedStaticFilesSource: StaticFilesSource

  beforeEach(async () => {
    mockDirStore = createMockDirStore([], true)
    mockedStaticFilesSource = mockStaticFilesSource()
  })

  describe('change inner state', () => {
    let naclFileSourceTest: NaclFilesSource
    const objectTypeElemID = ElemID.fromFullName('dummy.test')
    const objectTypeObjectMatcher = {
      elemID: objectTypeElemID,
      fields: {
        a: { refType: { elemID: BuiltinTypes.STRING.elemID } },
        b: { refType: { elemID: BuiltinTypes.NUMBER.elemID } },
      },
    }
    const instanceElementValue = { a: 'me', b: 5 }
    const instanceElementElemID = ElemID.fromFullName('dummy.test.instance.inst')
    const instanceElementObjectMatcher = {
      elemID: instanceElementElemID,
      value: instanceElementValue,
    }
    const newInstanceElementValue = { a: 'me again', b: 6 }
    const newInstanceElementElemID = ElemID.fromFullName('dummy.test.instance.inst2')
    const newInstanceElementObjectMatcher = {
      elemID: newInstanceElementElemID,
      value: newInstanceElementValue,
    }
    const file1 = {
      filename: 'file1.nacl',
      buffer: `
        type dummy.test {
          string a {}
        }
      `,
    }
    const file2 = {
      filename: 'file2.nacl',
      buffer: `
        type dummy.test {
          number b {}
        }
        dummy.test inst {
          a = "me"
          b = 5
        }
      `,
    }
    beforeEach(async () => {
      await mockDirStore.set(file1)
      await mockDirStore.set(file2)
      naclFileSourceTest = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        inMemRemoteMapCreator(),
        true,
      )
      await naclFileSourceTest.load({})
      await naclFileSourceTest.getAll()
    })
    it('should includes expected elements', async () => {
      const elements = await awu(await naclFileSourceTest.getAll()).toArray()
      expect(elements).toHaveLength(2)
    })
    describe('setNaclFiles', () => {
      it('should change existing element in one file', async () => {
        const newFile = {
          filename: 'file2.nacl',
          buffer: `
            type dummy.test {
              number b {}
            }
            dummy.test inst {
              a = "me again"
              b = 6
            }
          `,
        }
        const res = (await naclFileSourceTest.setNaclFiles([newFile])).changes
        expect(res).toHaveLength(1)
        const change = res[0] as unknown as ModificationChange<InstanceElement>
        expect(change).toMatchObject({
          action: 'modify',
          data: {
            before: { value: instanceElementValue },
            after: { value: newInstanceElementValue },
          },
        })
        expect(await awu(await naclFileSourceTest.getAll()).toArray()).toHaveLength(2)
        expect(await naclFileSourceTest.get(change.data.before.elemID)).toMatchObject({
          elemID: instanceElementElemID,
          value: newInstanceElementValue,
        })
        expect(await naclFileSourceTest.get(objectTypeElemID)).toMatchObject(objectTypeObjectMatcher)
      })
      it('should remove an element from a file', async () => {
        const newFile = {
          filename: 'file2.nacl',
          buffer: `
            type dummy.test {
              number b {}
            }
          `,
        }
        const res = (await naclFileSourceTest.setNaclFiles([newFile])).changes
        expect(res).toHaveLength(1)
        expect(res[0] as unknown as RemovalChange<InstanceElement>).toMatchObject({
          action: 'remove',
          data: { before: instanceElementObjectMatcher },
        })
        const allElements = await awu(await naclFileSourceTest.getAll()).toArray()
        expect(allElements).toHaveLength(1)
        expect(allElements[0] as ObjectType).toMatchObject(objectTypeObjectMatcher)
      })
      it('should add an element from a file', async () => {
        const newFile = {
          filename: 'file1.nacl',
          buffer: `
            type dummy.test {
              string a {}
            }
            dummy.test inst2 {
              a = "me again"
              b = 6
            }
          `,
        }
        const res = (await naclFileSourceTest.setNaclFiles([newFile])).changes
        expect(res).toHaveLength(1)
        expect(res[0] as unknown as AdditionChange<InstanceElement>).toMatchObject({
          action: 'add',
          data: { after: { value: { a: 'me again', b: 6 } } },
        })
        const allElements = await awu(await naclFileSourceTest.getAll()).toArray()
        expect(allElements).toHaveLength(3)
        expect(await naclFileSourceTest.get(objectTypeElemID)).toMatchObject(objectTypeObjectMatcher)
        expect(await naclFileSourceTest.get(instanceElementElemID)).toMatchObject(instanceElementObjectMatcher)
        expect(await naclFileSourceTest.get(newInstanceElementElemID)).toMatchObject(newInstanceElementObjectMatcher)
      })
      it('should not return changes if there is no change', async () => {
        const newFile = {
          filename: 'file1.nacl',
          buffer: `
            type dummy.test {
              string a {
              }
            }
          `,
        }
        const res = (await naclFileSourceTest.setNaclFiles([newFile])).changes
        expect(res).toHaveLength(0)
        const allElements = await awu(await naclFileSourceTest.getAll()).toArray()
        expect(allElements).toHaveLength(2)
        expect(await naclFileSourceTest.get(objectTypeElemID)).toMatchObject(objectTypeObjectMatcher)
        expect(await naclFileSourceTest.get(instanceElementElemID)).toMatchObject(instanceElementObjectMatcher)
      })
      it('should return correct elements upon update of multiple files', async () => {
        const newFile1 = {
          filename: 'file1.nacl',
          buffer: `
            type dummy.test {
              string a {}
              string c {}
            }
            dummy.test inst2 {
              a = "me again"
              b = 6
            }
          `,
        }
        const newFile2 = {
          filename: 'file2.nacl',
          buffer: ' ',
        }
        const res = (await naclFileSourceTest.setNaclFiles([newFile1, newFile2])).changes
        expect(res).toHaveLength(3)
        const newObjectTypeObjectMatcher = {
          elemID: objectTypeElemID,
          fields: {
            a: { refType: { elemID: BuiltinTypes.STRING.elemID } },
            c: { refType: { elemID: BuiltinTypes.STRING.elemID } },
          },
        }
        expect(res).toMatchObject([
          {
            action: 'modify',
            data: { before: objectTypeObjectMatcher, after: newObjectTypeObjectMatcher },
          },
          {
            action: 'remove',
            data: { before: instanceElementObjectMatcher },
          },
          {
            action: 'add',
            data: { after: newInstanceElementObjectMatcher },
          },
        ])
      })
      it('should update the type of an instance upon type update', async () => {
        const newFile = {
          filename: 'file2.nacl',
          buffer: `
            dummy.test inst {
              a = "me"
              b = 5
            }
          `,
        }
        const res = (await naclFileSourceTest.setNaclFiles([newFile])).changes
        expect(res).toHaveLength(1)
        const elements = await awu(await naclFileSourceTest.getAll()).toArray()
        expect(elements).toHaveLength(2)
        const instance = (await awu(elements).find(
          e => e.elemID.getFullName() === 'dummy.test.instance.inst',
        )) as InstanceElement
        const objType = (await awu(elements).find(e => e.elemID.getFullName() === 'dummy.test')) as ObjectType
        expect(objType).toBeDefined()
        expect(instance.refType.elemID.isEqual(objType.elemID)).toBeTruthy()
      })
      it('should remove elements from list result upon element removal', async () => {
        const newFile = {
          filename: 'file2.nacl',
          buffer: `
            type dummy.test {
              number b {}
            }
          `,
        }
        expect(
          await awu(await naclFileSourceTest.list())
            .map(e => e.getFullName())
            .toArray(),
        ).toEqual(['dummy.test', 'dummy.test.instance.inst'])
        await naclFileSourceTest.setNaclFiles([newFile])
        expect(
          await awu(await naclFileSourceTest.list())
            .map(e => e.getFullName())
            .toArray(),
        ).toEqual(['dummy.test'])
      })
      it('should remove elements from the indexes upon element removal', async () => {
        const newFile = {
          filename: 'file2.nacl',
          buffer: '',
        }
        const removedElemId = new ElemID('dummy', 'test')
        expect(await naclFileSourceTest.getElementNaclFiles(removedElemId)).toEqual(['file1.nacl', 'file2.nacl'])
        await naclFileSourceTest.setNaclFiles([newFile])
        expect(await naclFileSourceTest.getElementNaclFiles(removedElemId)).toEqual(['file1.nacl'])
      })
      describe('splitted elements', () => {
        describe('fragmented in all files', () => {
          let naclFileSourceWithFragments: NaclFilesSource
          const splitFile1 = {
            filename: 'file1.nacl',
            buffer: `
              type dummy.test2 {
                number a {}
              }
              type dummy.test1 {
                string a {}
              }
            `,
          }
          const splitFile2 = {
            filename: 'file2.nacl',
            buffer: `
              type dummy.test1 {
                number b {}
              }
              type dummy.test2 {
                string c {}
              }
            `,
          }
          beforeEach(async () => {
            await mockDirStore.set(splitFile1)
            await mockDirStore.set(splitFile2)
            naclFileSourceWithFragments = await naclFilesSource(
              '',
              mockDirStore,
              mockedStaticFilesSource,
              inMemRemoteMapCreator(),
              true,
            )
            await naclFileSourceWithFragments.load({})
          })
          it('should change splitted element correctly', async () => {
            const newFile = {
              filename: 'file1.nacl',
              buffer: `
                type dummy.test2 {
                  string d {}
                }
              `,
            }
            const currentElements = await awu(await naclFileSourceWithFragments.getAll()).toArray()
            const res = (await naclFileSourceWithFragments.setNaclFiles([newFile])).changes
            expect(res).toHaveLength(2)
            const objType1ElemID = new ElemID('dummy', 'test1')
            const objType2ElemID = new ElemID('dummy', 'test2')
            const objType1 = {
              before: new ObjectType({
                elemID: objType1ElemID,
                fields: {
                  a: { refType: new TypeReference(BuiltinTypes.STRING.elemID) },
                  b: { refType: new TypeReference(BuiltinTypes.NUMBER.elemID) },
                },
              }),
              after: new ObjectType({
                elemID: objType1ElemID,
                fields: {
                  b: {
                    refType: new TypeReference(BuiltinTypes.NUMBER.elemID),
                  },
                },
              }),
            }
            const objType2 = {
              before: new ObjectType({
                elemID: objType2ElemID,
                fields: {
                  a: {
                    refType: new TypeReference(BuiltinTypes.NUMBER.elemID),
                  },
                  c: {
                    refType: new TypeReference(BuiltinTypes.STRING.elemID),
                  },
                },
              }),
              after: new ObjectType({
                elemID: objType2ElemID,
                fields: {
                  d: {
                    refType: new TypeReference(BuiltinTypes.STRING.elemID),
                  },
                  c: {
                    refType: new TypeReference(BuiltinTypes.STRING.elemID),
                  },
                },
              }),
            }
            expect(res).toEqual([
              { action: 'modify', data: objType2 },
              { action: 'modify', data: objType1 },
            ])
            expect(currentElements).toEqual([objType1.before, objType2.before])
            expect(await awu(await naclFileSourceWithFragments.getAll()).toArray()).toEqual([
              objType1.after,
              objType2.after,
            ])
          })
        })
      })
    })
    describe('removeNaclFiles', () => {
      it('should not change anything if the file does not exist', async () => {
        expect((await naclFileSourceTest.removeNaclFiles(['blabla'])).changes).toHaveLength(0)
        expect(await awu(await naclFileSourceTest.getAll()).toArray()).toMatchObject([
          objectTypeObjectMatcher,
          instanceElementObjectMatcher,
        ])
      })
      it('should remove one file correctly', async () => {
        const { changes } = await naclFileSourceTest.removeNaclFiles(['file2.nacl'])
        expect(changes).toHaveLength(2)
        expect((changes[0] as unknown as ModificationChange<ObjectType>).data.after.fields.b).toBeUndefined()
        const newObjectTypeObjectMatcher = {
          elemID: objectTypeElemID,
          fields: { a: { refType: { elemID: BuiltinTypes.STRING.elemID } } },
        }
        expect(changes).toMatchObject([
          {
            action: 'modify',
            data: {
              before: objectTypeObjectMatcher,
              after: newObjectTypeObjectMatcher,
            },
          },
          {
            action: 'remove',
            data: { before: instanceElementObjectMatcher },
          },
        ])
        const currentElements = await awu(await naclFileSourceTest.getAll()).toArray()
        expect(currentElements).toHaveLength(1)
        const typeElement = currentElements[0] as ObjectType
        expect(Object.keys(typeElement.fields)).toHaveLength(1)
        expect(typeElement).toMatchObject(newObjectTypeObjectMatcher)
      })
      it('should remove multiple files correctly', async () => {
        const { changes } = await naclFileSourceTest.removeNaclFiles(['file1.nacl', 'file2.nacl'])
        expect(changes).toMatchObject([
          {
            action: 'remove',
            data: { before: objectTypeObjectMatcher },
          },
          {
            action: 'remove',
            data: { before: instanceElementObjectMatcher },
          },
        ])
        expect(await awu(await naclFileSourceTest.getAll()).toArray()).toEqual([])
      })
    })
    describe('updateNaclFiles', () => {
      it('should not change anything if there are no changes', async () => {
        expect((await naclFileSourceTest.updateNaclFiles([])).changes).toHaveLength(0)
        expect(await awu(await naclFileSourceTest.getAll()).toArray()).toMatchObject([
          objectTypeObjectMatcher,
          instanceElementObjectMatcher,
        ])
      })
      it('should update one element correctly', async () => {
        const before = (await naclFileSourceTest.get(instanceElementElemID)) as InstanceElement
        const after = before.clone()
        after.value = newInstanceElementValue
        const changesToApply = getDetailedChanges(toChange({ before, after }))
        const { changes } = await naclFileSourceTest.updateNaclFiles(changesToApply)
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject(changesToApply[0].baseChange)
        expect(
          _.sortBy(await awu(await naclFileSourceTest.getAll()).toArray(), e => e.elemID.getFullName()),
        ).toMatchObject(
          _.sortBy(
            [
              {
                elemID: instanceElementElemID,
                value: newInstanceElementValue,
              },
              objectTypeObjectMatcher,
            ],
            e => e.elemID.getFullName(),
          ),
        )
      })
      it('should add an element correctly', async () => {
        const currentObjectType = await naclFileSourceTest.get(objectTypeElemID)
        const newInstanceElement = new InstanceElement('inst2', currentObjectType, newInstanceElementValue, ['file1'])
        const changesToApply = getDetailedChanges(toChange({ after: newInstanceElement }))
        const { changes } = await naclFileSourceTest.updateNaclFiles(changesToApply)
        expect(changes).toHaveLength(1)
        expect(changes[0]).toHaveProperty('action', 'add')
        const additionChange = changes[0] as AdditionChange<InstanceElement>
        expect(isEqualElements(additionChange.data.after, newInstanceElement)).toBeTrue()
        expect(getChangeData(changes[0]).isEqual(getChangeData(changesToApply[0]))).toBeTruthy()

        const sortedAll = _.sortBy(await awu(await naclFileSourceTest.getAll()).toArray(), e => e.elemID.getFullName())
        expect(sortedAll).toMatchObject(
          _.sortBy([instanceElementObjectMatcher, objectTypeObjectMatcher, newInstanceElementObjectMatcher], e =>
            e.elemID.getFullName(),
          ),
        )
      })
      it('should remove an element correctly', async () => {
        const currentInstanceElement = await naclFileSourceTest.get(instanceElementElemID)
        const changesToApply = getDetailedChanges(toChange({ before: currentInstanceElement }))
        const { changes } = await naclFileSourceTest.updateNaclFiles(changesToApply)
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject(changesToApply[0].baseChange)
        expect(await awu(await naclFileSourceTest.getAll()).toArray()).toMatchObject([objectTypeObjectMatcher])
      })
      describe('when adding a nested value to an element which exists in multiple files', () => {
        beforeEach(async () => {
          const before = (await naclFileSourceTest.get(objectTypeElemID)) as ObjectType
          const after = before.clone()
          after.fields.b.annotations.new_annotation = 'value'
          const changesToApply = detailedCompare(before, after, { createFieldChanges: true })
          await naclFileSourceTest.updateNaclFiles(changesToApply)
        })
        it('should add the value to the file where the parent is defined', async () => {
          const nacl = await naclFileSourceTest.getParsedNaclFile('file2.nacl')
          const naclElements = await nacl?.elements()
          const object = naclElements?.find(elem => elem.elemID.isEqual(objectTypeElemID)) as ObjectType
          expect(object).toBeInstanceOf(ObjectType)
          expect(object.fields.b).toBeDefined()
          expect(object.fields.b.annotations).toHaveProperty('new_annotation', 'value')
        })
      })
      describe('when updating multiple files at the same time', () => {
        // Intentionally mixing multiple scenarios into one test to test the grouping logic in the update process
        let source: NaclFilesSource
        let deletedElementIDs: ElemID[]
        let newInstanceInNewFileID: ElemID
        let newInstanceInExistingFileID: ElemID
        let modifiedInstanceID: ElemID
        beforeEach(async () => {
          const fileA: NaclFile = {
            filename: 'file_a.nacl',
            buffer: `type dummy.SplitObjToDelete {
                val = 1
              }
              dummy.test Inst1 {
              }`,
          }
          const fileB: NaclFile = {
            filename: 'file_b.nacl',
            buffer: `type dummy.SplitObjToDelete {
                other = 1
              }
              dummy.test Inst2 {
              }
              dummy.test Inst3 {
                a = "asd"
              }`,
          }

          await mockDirStore.set(file1)
          await mockDirStore.set(file2)
          await mockDirStore.set(fileA)
          await mockDirStore.set(fileB)

          source = await naclFilesSource('', mockDirStore, mockedStaticFilesSource, inMemRemoteMapCreator(), true)
          await source.load({})

          // Prepare and apply changes
          const objToDeleteID = new ElemID('dummy', 'SplitObjToDelete')
          const objToDelete = (await source.get(objToDeleteID)) as ObjectType

          const instToDelete = (await source.get(new ElemID('dummy', 'test', 'instance', 'Inst1'))) as InstanceElement
          deletedElementIDs = [objToDeleteID, instToDelete.elemID]

          const objType = (await source.get(objectTypeElemID)) as ObjectType
          const newInstInNewFile = new InstanceElement('new_1', objType, { a: 'c' }, ['file_c'])
          newInstanceInNewFileID = newInstInNewFile.elemID
          const newInstInExistingFile = new InstanceElement('new_2', objType, { a: 'b' }, ['file_b'])
          newInstanceInExistingFileID = newInstInExistingFile.elemID

          const existingInstance = (await source.get(
            new ElemID('dummy', 'test', 'instance', 'Inst3'),
          )) as InstanceElement
          const updatedInstance = existingInstance.clone()
          updatedInstance.value.a = 'bla'
          modifiedInstanceID = updatedInstance.elemID

          const changesToApply = [
            ...getDetailedChanges(toChange({ before: objToDelete })),
            ...getDetailedChanges(toChange({ before: instToDelete })),
            ...getDetailedChanges(toChange({ after: newInstInExistingFile })),
            ...getDetailedChanges(toChange({ after: newInstInNewFile })),
            ...getDetailedChanges(toChange({ before: existingInstance, after: updatedInstance })),
          ]
          await source.updateNaclFiles(changesToApply)
        })
        it('should remove all deleted elements from the source', async () => {
          const deletedElements = await Promise.all(deletedElementIDs.map(id => source.get(id)))
          expect(deletedElements).toEqual(deletedElementIDs.map(() => undefined))
        })
        it('should remove files that no longer contain elements', () => {
          expect(mockDirStore.delete).toHaveBeenCalledWith('file_a.nacl')
        })
        it('should add new instance to existing file', async () => {
          await expect(source.getElementNaclFiles(newInstanceInExistingFileID)).resolves.toEqual(['file_b.nacl'])
        })
        it('should add new instance to new file', async () => {
          await expect(source.getElementNaclFiles(newInstanceInNewFileID)).resolves.toEqual(['file_c.nacl'])
        })
        it('should apply nested changes', async () => {
          const updatedElement = (await source.get(modifiedInstanceID)) as InstanceElement
          expect(updatedElement).toBeDefined()
          expect(updatedElement.value).toHaveProperty('a', 'bla')
        })
        it('should keep modified instance in the same file', async () => {
          await expect(source.getElementNaclFiles(modifiedInstanceID)).resolves.toEqual(['file_b.nacl'])
        })
      })
    })
  })
})
