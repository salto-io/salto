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
import _ from 'lodash'
import { ModificationChange, InstanceElement, RemovalChange, ObjectType, PrimitiveTypes,
  ElemID, AdditionChange, DetailedChange, BuiltinTypes } from '@salto-io/adapter-api'
import { DirectoryStore } from '../../../src/workspace/dir_store'

import { naclFilesSource, NaclFilesSource } from '../../../src/workspace/nacl_files'
import { StaticFilesSource } from '../../../src/workspace/static_files'
import { ParseResultCache } from '../../../src/workspace/cache'

import { mockStaticFilesSource } from '../../utils'
import * as parser from '../../../src/parser'
import { toParsedNaclFile } from '../../../src/workspace/nacl_files/nacl_files_source'

describe('Nacl Files Source', () => {
  let mockDirStore: DirectoryStore<string>
  let mockCache: ParseResultCache
  let mockedStaticFilesSource: StaticFilesSource
  const mockDirStoreGet = jest.fn()

  beforeEach(() => {
    mockCache = {
      get: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockResolvedValue(undefined),
      clone: () => mockCache,
      flush: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      rename: () => Promise.resolve(),
    }
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
    }
    mockedStaticFilesSource = mockStaticFilesSource()
  })

  describe('change inner state', () => {
    let naclFileSourceTest: NaclFilesSource
    const objectTypeElemID = ElemID.fromFullName('dummy.test')
    const objectTypeObjectMatcher = {
      elemID: objectTypeElemID,
      fields: {
        a: { type: { primitive: PrimitiveTypes.STRING } },
        b: { type: { primitive: PrimitiveTypes.NUMBER } },
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
      const parsedNaclFiles = await Promise.all(naclFiles.map(async naclFile =>
        toParsedNaclFile(
          naclFile,
          await parser.parse(Buffer.from(naclFile.buffer), naclFile.filename, {})
        )))
      naclFileSourceTest = naclFilesSource(
        mockDirStore, mockCache, mockedStaticFilesSource, parsedNaclFiles
      )
      await naclFileSourceTest.getAll()
    })
    it('should includes expected elements', async () => {
      const elements = await naclFileSourceTest.getAll()
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
        const res = await naclFileSourceTest.setNaclFiles(newFile)
        expect(res).toHaveLength(1)
        const change = res[0] as unknown as ModificationChange<InstanceElement>
        expect(change).toMatchObject({
          action: 'modify',
          data: {
            before: { value: instanceElementValue },
            after: { value: newInstanceElementValue },
          },
        })
        expect(await naclFileSourceTest.getAll()).toHaveLength(2)
        expect((await naclFileSourceTest.get(change.data.before.elemID)))
          .toMatchObject({
            elemID: instanceElementElemID, value: newInstanceElementValue,
          })
        expect(await naclFileSourceTest.get(objectTypeElemID))
          .toMatchObject(objectTypeObjectMatcher)
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
        const res = await naclFileSourceTest.setNaclFiles(newFile)
        expect(res).toHaveLength(1)
        expect(res[0] as unknown as RemovalChange<InstanceElement>).toMatchObject({
          action: 'remove',
          data: { before: instanceElementObjectMatcher },
        })
        const allElements = await naclFileSourceTest.getAll()
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
        const res = await naclFileSourceTest.setNaclFiles(newFile)
        expect(res).toHaveLength(1)
        expect(res[0] as unknown as AdditionChange<InstanceElement>).toMatchObject({
          action: 'add',
          data: { after: { value: { a: 'me again', b: 6 } } },
        })
        const allElements = await naclFileSourceTest.getAll()
        expect(allElements).toHaveLength(3)
        expect(await naclFileSourceTest.get(objectTypeElemID))
          .toMatchObject(objectTypeObjectMatcher)
        expect(await naclFileSourceTest.get(instanceElementElemID))
          .toMatchObject(instanceElementObjectMatcher)
        expect(await naclFileSourceTest.get(newInstanceElementElemID))
          .toMatchObject(newInstanceElementObjectMatcher)
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
        const res = await naclFileSourceTest.setNaclFiles(newFile)
        expect(res).toHaveLength(0)
        const allElements = await naclFileSourceTest.getAll()
        expect(allElements).toHaveLength(2)
        expect(await naclFileSourceTest.get(objectTypeElemID))
          .toMatchObject(objectTypeObjectMatcher)
        expect(await naclFileSourceTest.get(instanceElementElemID))
          .toMatchObject(instanceElementObjectMatcher)
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
        const res = await naclFileSourceTest.setNaclFiles(newFile1, newFile2)
        expect(res).toHaveLength(3)
        const newObjectTypeObjectMatcher = {
          elemID: objectTypeElemID,
          fields: {
            a: { type: { primitive: PrimitiveTypes.STRING } },
            c: { type: { primitive: PrimitiveTypes.STRING } },
          },
        }
        expect(res).toMatchObject([
          {
            action: 'modify',
            data: { before: objectTypeObjectMatcher, after: newObjectTypeObjectMatcher },
          },
          {
            action: 'add',
            data: { after: newInstanceElementObjectMatcher },
          },
          {
            action: 'remove',
            data: { before: instanceElementObjectMatcher },
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
        const res = await naclFileSourceTest.setNaclFiles(newFile)
        expect(res).toHaveLength(1)
        const elements = await naclFileSourceTest.getAll()
        expect(elements).toHaveLength(2)
        const instance = elements
          .find(e => e.elemID.getFullName() === 'dummy.test.instance.inst') as InstanceElement
        const objType = elements.find(e => e.elemID.getFullName() === 'dummy.test') as ObjectType
        expect(objType).toBeDefined()
        expect(instance.type).toBe(objType)
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
            const parsedNaclFiles = await Promise.all(naclFiles.map(async naclFile =>
              toParsedNaclFile(
                naclFile,
                await parser.parse(Buffer.from(naclFile.buffer), naclFile.filename, {})
              )))
            naclFileSourceWithFragments = naclFilesSource(
              mockDirStore, mockCache, mockedStaticFilesSource, parsedNaclFiles
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
            const currentElements = await naclFileSourceWithFragments.getAll()
            const res = await naclFileSourceWithFragments.setNaclFiles(newFile)
            expect(res).toHaveLength(2)
            const objType1ElemID = new ElemID('dummy', 'test1')
            const objType2ElemID = new ElemID('dummy', 'test2')
            const objType1 = {
              before: new ObjectType({
                elemID: objType1ElemID,
                fields: { a: { type: BuiltinTypes.STRING }, b: { type: BuiltinTypes.NUMBER } },
              }),
              after: new ObjectType({
                elemID: objType1ElemID, fields: { b: { type: BuiltinTypes.NUMBER } },
              }),
            }
            const objType2 = {
              before: new ObjectType({
                elemID: objType2ElemID,
                fields: { a: { type: BuiltinTypes.NUMBER }, c: { type: BuiltinTypes.STRING } },
              }),
              after: new ObjectType({
                elemID: objType2ElemID,
                fields: { d: { type: BuiltinTypes.STRING }, c: { type: BuiltinTypes.STRING } },
              }),
            }
            expect(res).toEqual([
              { action: 'modify', data: objType2 },
              { action: 'modify', data: objType1 },
            ])
            expect(currentElements).toEqual([objType2.before, objType1.before])
            expect(await naclFileSourceWithFragments.getAll())
              .toEqual([objType2.after, objType1.after])
          })
        })
      })
    })
    describe('removeNaclFiles', () => {
      it('should not change anything if the file does not exist', async () => {
        expect(await naclFileSourceTest.removeNaclFiles('blabla')).toHaveLength(0)
        expect(await naclFileSourceTest.getAll()).toMatchObject([
          objectTypeObjectMatcher, instanceElementObjectMatcher,
        ])
      })
      it('should remove one file correctly', async () => {
        const changes = await naclFileSourceTest.removeNaclFiles('file2.nacl')
        expect(changes).toHaveLength(2)
        expect((changes[0] as unknown as ModificationChange<ObjectType>).data.after.fields.b)
          .toBeUndefined()
        const newObjectTypeObjectMatcher = {
          elemID: objectTypeElemID,
          fields: { a: { type: { primitive: PrimitiveTypes.STRING } } },
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
        const currentElements = await naclFileSourceTest.getAll()
        expect(currentElements).toHaveLength(1)
        const typeElement = currentElements[0] as ObjectType
        expect(Object.keys(typeElement.fields)).toHaveLength(1)
        expect(typeElement).toMatchObject(newObjectTypeObjectMatcher)
      })
      it('should remove multiple files correctly', async () => {
        const changes = await naclFileSourceTest.removeNaclFiles('file1.nacl', 'file2.nacl')
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
        expect(await naclFileSourceTest.getAll()).toEqual([])
      })
    })
    describe('updateNaclFiles', () => {
      it('should not change anything if there are no changes', async () => {
        expect(await naclFileSourceTest.updateNaclFiles([])).toHaveLength(0)
        expect(await naclFileSourceTest.getAll()).toMatchObject([
          objectTypeObjectMatcher, instanceElementObjectMatcher,
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
        const changes = await naclFileSourceTest.updateNaclFiles([detailedChange])
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject(_.omit(detailedChange, ['id', 'path']))
        expect(await naclFileSourceTest.getAll()).toMatchObject([
          instanceElementObjectMatcher,
          {
            elemID: objectTypeElemID,
            fields: { b: { type: { primitive: PrimitiveTypes.NUMBER } } },
          },
        ])
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
        const changes = await naclFileSourceTest.updateNaclFiles([detailedChange])
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject(_.omit(detailedChange, ['id', 'path']))
        expect(await naclFileSourceTest.getAll()).toMatchObject([
          instanceElementObjectMatcher, objectTypeObjectMatcher, newInstanceElementObjectMatcher,
        ])
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
        const changes = await naclFileSourceTest.updateNaclFiles([detailedChange])
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject(_.omit(detailedChange, ['id', 'path']))
        expect(await naclFileSourceTest.getAll()).toMatchObject([objectTypeObjectMatcher])
      })
    })
  })
})
