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
import _ from 'lodash'
import {
  ModificationChange,
  InstanceElement,
  RemovalChange,
  ObjectType,
  ElemID,
  AdditionChange,
  DetailedChange,
  BuiltinTypes,
  getChangeData,
  TypeReference,
} from '@salto-io/adapter-api'
import { parser } from '@salto-io/parser'
import { collections } from '@salto-io/lowerdash'
import { DirectoryStore } from '../../../src/workspace/dir_store'

import { naclFilesSource, NaclFilesSource } from '../../../src/workspace/nacl_files'
import { StaticFilesSource } from '../../../src/workspace/static_files'

import { mockStaticFilesSource, persistentMockCreateRemoteMap } from '../../utils'
import { toParsedNaclFile } from '../../../src/workspace/nacl_files/nacl_files_source'

const { awu } = collections.asynciterable

describe('Nacl Files Source', () => {
  let mockDirStore: DirectoryStore<string>
  let mockedStaticFilesSource: StaticFilesSource
  const mockDirStoreGet = jest.fn()

  beforeEach(async () => {
    mockDirStore = {
      list: () => Promise.resolve([]),
      isEmpty: () => Promise.resolve(false),
      get: mockDirStoreGet.mockResolvedValue(undefined),
      getFiles: jest.fn().mockResolvedValue([undefined]),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      rename: () => Promise.resolve(),
      renameFile: () => Promise.resolve(),
      flush: () => Promise.resolve(),
      mtimestamp: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
      getTotalSize: () => Promise.resolve(0),
      clone: () => mockDirStore,
      getFullPath: filename => filename,
      isPathIncluded: jest.fn().mockResolvedValue(true),
      exists: jest.fn().mockResolvedValue(false),
    }
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
      const naclFiles = [file1, file2]
      const parsedNaclFiles = await Promise.all(
        naclFiles.map(async naclFile =>
          toParsedNaclFile(naclFile, await parser.parse(Buffer.from(naclFile.buffer), naclFile.filename, {})),
        ),
      )
      naclFileSourceTest = await naclFilesSource(
        '',
        mockDirStore,
        mockedStaticFilesSource,
        persistentMockCreateRemoteMap(),
        true,
        parsedNaclFiles,
      )
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
        expect(await naclFileSourceTest.getElementReferencedFiles(removedElemId)).toEqual(['file2.nacl'])
        await naclFileSourceTest.setNaclFiles([newFile])
        expect(await naclFileSourceTest.getElementReferencedFiles(removedElemId)).toEqual([])
      })
      describe('splitted elements', () => {
        describe('fragmented in all files', () => {
          let naclFileSourceWithFragments: NaclFilesSource
          const splittedFile1 = {
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
          const splittedFile2 = {
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
            const naclFiles = [splittedFile1, splittedFile2]
            const parsedNaclFiles = await Promise.all(
              naclFiles.map(async naclFile =>
                toParsedNaclFile(naclFile, await parser.parse(Buffer.from(naclFile.buffer), naclFile.filename, {})),
              ),
            )
            naclFileSourceWithFragments = await naclFilesSource(
              '',
              mockDirStore,
              mockedStaticFilesSource,
              persistentMockCreateRemoteMap(),
              true,
              parsedNaclFiles,
            )
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
        const currentObjectType = await naclFileSourceTest.get(objectTypeElemID)
        const newObjectType = new ObjectType({ elemID: objectTypeElemID, fields: {} })
        const detailedChange = {
          action: 'modify',
          id: objectTypeElemID,
          data: { before: currentObjectType, after: newObjectType },
          path: ['file1'],
        } as DetailedChange
        mockDirStoreGet.mockResolvedValue(file1)
        const { changes } = await naclFileSourceTest.updateNaclFiles([detailedChange])
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject(_.omit(detailedChange, ['id', 'path']))
        expect(
          _.sortBy(await awu(await naclFileSourceTest.getAll()).toArray(), e => e.elemID.getFullName()),
        ).toMatchObject(
          _.sortBy(
            [
              instanceElementObjectMatcher,
              {
                elemID: objectTypeElemID,
                fields: { b: { refType: { elemID: BuiltinTypes.NUMBER.elemID } } },
              },
            ],
            e => e.elemID.getFullName(),
          ),
        )
      })
      it('should add an element correctly', async () => {
        const currentObjectType = await naclFileSourceTest.get(objectTypeElemID)
        const newInstanceElement = new InstanceElement('inst2', currentObjectType, newInstanceElementValue)
        const detailedChange = {
          action: 'add',
          id: newInstanceElementElemID,
          data: { after: newInstanceElement },
          path: ['file1'],
        } as DetailedChange
        mockDirStoreGet.mockResolvedValue(file1)
        const { changes } = await naclFileSourceTest.updateNaclFiles([detailedChange])
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject(_.omit(detailedChange, ['id', 'path', 'data']))
        expect(getChangeData(changes[0]).isEqual(getChangeData(detailedChange))).toBeTruthy()

        const sortedAll = _.sortBy(await awu(await naclFileSourceTest.getAll()).toArray(), e => e.elemID.getFullName())
        expect(sortedAll).toMatchObject(
          _.sortBy([instanceElementObjectMatcher, objectTypeObjectMatcher, newInstanceElementObjectMatcher], e =>
            e.elemID.getFullName(),
          ),
        )
      })
      it('should remove an element correctly', async () => {
        const currentInstanceElement = await naclFileSourceTest.get(instanceElementElemID)
        const detailedChange = {
          action: 'remove',
          id: instanceElementElemID,
          data: { before: currentInstanceElement },
          path: ['file2'],
        } as DetailedChange
        mockDirStoreGet.mockResolvedValue(file2)
        const { changes } = await naclFileSourceTest.updateNaclFiles([detailedChange])
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject(_.omit(detailedChange, ['id', 'path']))
        expect(await awu(await naclFileSourceTest.getAll()).toArray()).toMatchObject([objectTypeObjectMatcher])
      })
    })
  })
})
