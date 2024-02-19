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
  Element,
  ObjectType,
  ElemID,
  BuiltinTypes,
  ListType,
  InstanceElement,
  DetailedChange,
  TypeReference,
  isAdditionChange,
  isRemovalChange,
  isModificationChange,
  getChangeData,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { merger, createElementSelector, elementSource, createElementSelectors, remoteMap } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { mockWorkspace } from '../common/workspace'
import { createDiffChanges, getEnvsDeletionsDiff } from '../../src/core/diff'
import { createElementSource } from '../common/helpers'
import { ChangeWithDetails } from '../../src/core/plan/plan_item'

const { createInMemoryElementSource } = elementSource
const { awu } = collections.asynciterable
const { mergeElements } = merger

describe('diff', () => {
  const nestedType = new ObjectType({
    elemID: new ElemID('salto', 'nested'),
    fields: {
      str: {
        refType: new TypeReference(BuiltinTypes.STRING.elemID),
      },
      num: {
        refType: new TypeReference(BuiltinTypes.NUMBER.elemID),
      },
      list: {
        refType: new TypeReference(new ListType(BuiltinTypes.NUMBER).elemID),
      },
    },
  })
  // singlePathObject
  const singlePathObject = new ObjectType({
    elemID: new ElemID('salto', 'singlePathObj'),
    fields: {
      simple: {
        annotations: {
          description: 'description',
        },
        refType: new TypeReference(BuiltinTypes.STRING.elemID),
      },
      nested: {
        refType: new TypeReference(nestedType.elemID),
      },
    },
    annotationRefsOrTypes: {
      simple: BuiltinTypes.STRING,
      nested: nestedType,
    },
    annotations: {
      simple: 'simple',
      nested: {
        str: 'Str',
        num: 7,
        list: [1, 2, 3],
      },
    },
    path: ['salto', 'obj', 'simple'],
  })

  const multiPathAnnoObj = new ObjectType({
    elemID: new ElemID('salto', 'multiPathObj'),
    annotationRefsOrTypes: {
      simple: BuiltinTypes.STRING,
      nested: nestedType,
    },
    annotations: {
      simple: 'simple',
      nested: {
        str: 'Str',
        num: 7,
        list: [1, 2, 3],
      },
    },
    path: ['salto', 'obj', 'multi', 'anno'],
  })
  // singlePathObject
  const multiPathFieldsObj = new ObjectType({
    elemID: new ElemID('salto', 'multiPathObj'),
    fields: {
      simple: {
        refType: new TypeReference(BuiltinTypes.STRING.elemID),
      },
      nested: {
        refType: new TypeReference(nestedType.elemID),
      },
    },
    path: ['salto', 'obj', 'multi', 'fields'],
  })
  // singlePathInstance
  const singlePathInstance = new InstanceElement(
    'singlePathInst',
    singlePathObject,
    {
      simple: 'Simple',
      nested: {
        str: 'Str',
        num: 7,
        list: [1, 2, 3],
      },
    },
    ['salto', 'inst', 'simple'],
  )
  // multiPathInstance
  const multiPathInstace1 = new InstanceElement(
    'multiPathInst',
    singlePathObject,
    {
      simple: 'Simple',
      nested: {
        list: [1, 2, 3],
      },
    },
    ['salto', 'inst', 'nested', '1'],
  )
  const multiPathInstace2 = new InstanceElement(
    'multiPathInst',
    singlePathObject,
    {
      nested: {
        str: 'Str',
        num: 7,
      },
    },
    ['salto', 'inst', 'nested', '2'],
  )

  const elementfragments = [
    singlePathInstance,
    multiPathAnnoObj,
    multiPathFieldsObj,
    multiPathInstace1,
    multiPathInstace2,
  ]

  let allElement: Element[]
  let singlePathObjMerged: Element
  let multiPathObjMerged: Element
  let singlePathInstMerged: Element
  let multiPathInstMerged: Element

  beforeAll(async () => {
    const { merged } = await mergeElements(awu([singlePathObject, ...elementfragments]))
    allElement = await awu(merged.values()).toArray()
    multiPathObjMerged = allElement[0].clone()
    multiPathInstMerged = allElement[2].clone()
    singlePathObjMerged = allElement[1].clone()
    singlePathInstMerged = allElement[3].clone()
  })

  describe('with no changes', () => {
    describe('detailedChanges', () => {
      it('should not create changes toElements and the fromElements are the same', async () => {
        const changes = await createDiffChanges(
          createElementSource(allElement),
          createElementSource(allElement),
          new remoteMap.InMemoryRemoteMap<ElemID[]>(),
        )
        expect(changes).toHaveLength(0)
      })
    })
    describe('changesWithDetails', () => {
      it('should not create changes toElements and the fromElements are the same', async () => {
        const changes = await createDiffChanges(
          createElementSource(allElement),
          createElementSource(allElement),
          new remoteMap.InMemoryRemoteMap<ElemID[]>(),
          undefined,
          undefined,
          'changes',
        )
        expect(changes).toHaveLength(0)
      })
    })
  })

  describe('with changes', () => {
    describe('detailedChanges', () => {
      let singlePathInstMergedAfter: InstanceElement
      let beforeElements: Element[]
      let afterElements: Element[]
      beforeAll(async () => {
        singlePathInstMergedAfter = singlePathInstMerged.clone() as InstanceElement
        beforeElements = [singlePathObjMerged, multiPathInstMerged, singlePathInstMerged, nestedType]
        singlePathInstMergedAfter.value.nested.str = 'modified'
        afterElements = [multiPathObjMerged, singlePathInstMergedAfter, multiPathInstMerged, nestedType]
      })
      describe('without filters', () => {
        let changes: DetailedChange[]
        beforeAll(async () => {
          changes = await createDiffChanges(
            createElementSource(beforeElements),
            createElementSource(afterElements),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
          )
        })
        it('should create all changes', () => {
          expect(changes).toHaveLength(3)
        })
        it('should create add changes for elements which are only in the fromElements', () => {
          const addChanges = changes.filter(c => c.action === 'add')
          expect(addChanges).toHaveLength(1)
          addChanges.forEach(change => expect(change.id).toEqual(multiPathObjMerged.elemID))
        })
        it('should create remove changes for elements which are only in the workspace', () => {
          const removeChange = changes.find(c => c.action === 'remove')
          expect(removeChange).toBeDefined()
          expect(removeChange?.id).toEqual(singlePathObjMerged.elemID)
          expect(removeChange?.path).toBeUndefined()
        })
        it('should create remove changes for elements which have different values in the fromElements and toElements', () => {
          const modifyChange = changes.find(c => c.action === 'modify')
          expect(modifyChange).toBeDefined()
          expect(modifyChange?.id).toEqual(
            singlePathInstMergedAfter.elemID.createNestedID('nested').createNestedID('str'),
          )
        })
      })
      describe('with filters', () => {
        let changes: DetailedChange[]
        const addedInstance = new InstanceElement('addedInstance', singlePathObject, {
          nested: {
            str: 'Str',
            num: 7,
            list: [1, 2, 3],
          },
        })
        const beforeInstance = new InstanceElement('instance', singlePathObject, {
          simple: 'Simple',
          nested: {
            str: 'Str',
            num: 7,
            list: [1, 2, 3],
          },
        })
        beforeAll(async () => {
          const afterInstance = beforeInstance.clone()
          afterInstance.value.simple = undefined
          const selectors = [
            createElementSelector(singlePathObjMerged.elemID.getFullName()),
            createElementSelector(singlePathInstMerged.elemID.getFullName()),
            createElementSelector(addedInstance.elemID.createNestedID('nested', 'str').getFullName()),
            createElementSelector(afterInstance.elemID.createNestedID('nested').getFullName()),
          ]
          changes = await createDiffChanges(
            createElementSource(beforeElements.concat(beforeInstance)),
            createElementSource(afterElements.concat(afterInstance, addedInstance)),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            selectors,
          )
        })
        it('should filter out changes that did not pass any of the filters', () => {
          expect(changes).toHaveLength(3)
        })
        it('should include changes that matches a selector equally', () => {
          expect(changes.find(c => c.id.isEqual(singlePathObjMerged.elemID))).toBeTruthy()
        })
        it('should include changes that matches as child of a selector', () => {
          expect(
            changes.find(c => c.id.isEqual(singlePathInstMerged.elemID.createNestedID('nested', 'str'))),
          ).toBeTruthy()
        })
        it('should include changes that matches as parent of a selector', () => {
          expect(changes.find(c => c.id.isEqual(addedInstance.elemID))).toBeTruthy()
        })
      })
      describe('check diff handling of selectors', () => {
        it('returns empty diff when element id exists but is not in diff', async () => {
          const selectors = [createElementSelector(multiPathInstMerged.elemID.getFullName())]
          const changes = await createDiffChanges(
            createElementSource(beforeElements),
            createElementSource(afterElements),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            selectors,
          )
          expect(changes).toHaveLength(0)
        })
        // test disabled because validation is disabled.
        // eslint-disable-next-line
        it.skip('throws error when selector catches nothing', async () => {
          const selectors = [createElementSelector('salto.multiPathObj.field.thereisnofieldbythisname')]
          await expect(
            createDiffChanges(
              createElementSource(beforeElements),
              createElementSource(afterElements),
              new remoteMap.InMemoryRemoteMap<ElemID[]>(),
              selectors,
            ),
          ).rejects.toThrow()
        })
        it('includes child elements when their parent is selected ', async () => {
          const nestedID = singlePathInstMerged.elemID.createNestedID('nested').createNestedID('str').getFullName()
          const simpleId = singlePathInstMerged.elemID.createNestedID('simple').getFullName()
          const newSinglePathInstMergedAfter = singlePathInstMergedAfter.clone() as InstanceElement
          newSinglePathInstMergedAfter.value.simple = 'old simple'
          const newAfterElements = [multiPathObjMerged, multiPathInstMerged, newSinglePathInstMergedAfter]
          const selectors = [createElementSelector(singlePathInstMerged.elemID.getFullName())]
          const changes = await createDiffChanges(
            createElementSource(beforeElements),
            createElementSource(newAfterElements),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            selectors,
          )
          expect(changes).toHaveLength(2)
          expect(changes.map(change => change.id.getFullName()).sort()).toEqual([nestedID, simpleId].sort())
        })
        it('includes field inner annotations when the field is selected', async () => {
          const newSinglePathObjMerged = singlePathObjMerged.clone() as ObjectType
          newSinglePathObjMerged.fields.simple.annotations.description = 'new description'
          const simpleFieldId = newSinglePathObjMerged.elemID.createNestedID('field', 'simple')
          const selectors = [createElementSelector(simpleFieldId.getFullName())]
          const changes = await createDiffChanges(
            createInMemoryElementSource([newSinglePathObjMerged]),
            createInMemoryElementSource([singlePathObjMerged]),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            selectors,
          )
          expect(changes.map(change => change.id.getFullName())).toEqual([
            simpleFieldId.createNestedID('description').getFullName(),
          ])
        })
      })
    })
    describe('changesWithDetails', () => {
      let singlePathInstMergedAfter: InstanceElement
      let beforeElements: Element[]
      let afterElements: Element[]
      beforeAll(async () => {
        singlePathInstMergedAfter = singlePathInstMerged.clone() as InstanceElement
        beforeElements = [singlePathObjMerged, multiPathInstMerged, singlePathInstMerged, nestedType]
        singlePathInstMergedAfter.value.nested.str = 'modified'
        afterElements = [multiPathObjMerged, singlePathInstMergedAfter, multiPathInstMerged, nestedType]
      })
      describe('without filters', () => {
        let changes: ChangeWithDetails[]
        beforeAll(async () => {
          changes = await createDiffChanges(
            createElementSource(beforeElements),
            createElementSource(afterElements),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            undefined,
            undefined,
            'changes',
          )
        })
        it('should create all changes', () => {
          expect(changes).toHaveLength(3)
        })
        it('should create add changes for elements which are only in the fromElements', () => {
          const addChanges = changes.filter(isAdditionChange)
          expect(addChanges).toHaveLength(1)
          const changeId = addChanges[0].data.after.elemID
          expect(changeId).toEqual(multiPathObjMerged.elemID)
          const detailedChanges = addChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(1)
          expect(detailedChanges[0].id).toEqual(changeId)
        })
        it('should create remove changes for elements which are only in the workspace', () => {
          const removeChanges = changes.filter(isRemovalChange)
          expect(removeChanges).toHaveLength(1)
          const changeId = removeChanges[0].data.before.elemID
          expect(changeId).toEqual(singlePathObjMerged.elemID)
          const detailedChanges = removeChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(1)
          expect(detailedChanges[0].id).toEqual(changeId)
          expect(detailedChanges[0].path).toBeUndefined()
        })
        it('should create modify changes for elements which have different values in the fromElements and toElements', () => {
          const modifyChanges = changes.filter(isModificationChange)
          expect(modifyChanges).toHaveLength(1)
          const changeId = modifyChanges[0].data.after.elemID
          expect(changeId).toEqual(singlePathInstMergedAfter.elemID)
          const detailedChanges = modifyChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(1)
          expect(detailedChanges[0].id).toEqual(changeId.createNestedID('nested').createNestedID('str'))
        })
      })
      describe('with filters', () => {
        let changes: ChangeWithDetails[]
        const addedInstance = new InstanceElement('addedInstance', singlePathObject, {
          nested: {
            str: 'Str',
            num: 7,
            list: [1, 2, 3],
          },
        })
        const beforeInstance = new InstanceElement('instance', singlePathObject, {
          simple: 'Simple',
          nested: {
            str: 'Str',
            num: 7,
            list: [1, 2, 3],
          },
        })
        beforeAll(async () => {
          const afterInstance = beforeInstance.clone()
          afterInstance.value.simple = undefined
          const selectors = [
            createElementSelector(singlePathObjMerged.elemID.getFullName()),
            createElementSelector(singlePathInstMerged.elemID.getFullName()),
            createElementSelector(addedInstance.elemID.createNestedID('nested', 'str').getFullName()),
            createElementSelector(afterInstance.elemID.createNestedID('nested').getFullName()),
          ]
          changes = await createDiffChanges(
            createElementSource(beforeElements.concat(beforeInstance)),
            createElementSource(afterElements.concat(afterInstance, addedInstance)),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            selectors,
            undefined,
            'changes',
          )
        })
        it('should filter out changes that did not pass any of the filters', () => {
          expect(changes).toHaveLength(3)
        })
        it('should include changes that matches a selector equally', () => {
          const matchedChanges = changes.filter(c => getChangeData(c).elemID.isEqual(singlePathObjMerged.elemID))
          expect(matchedChanges).toHaveLength(1)
          const detailedChanges = matchedChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(1)
          expect(detailedChanges[0].id).toEqual(singlePathObjMerged.elemID)
        })
        it('should include changes that matches as child of a selector', () => {
          const matchedChanges = changes.filter(c => getChangeData(c).elemID.isEqual(singlePathInstMerged.elemID))
          expect(matchedChanges).toHaveLength(1)
          const detailedChanges = matchedChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(1)
          expect(detailedChanges[0].id).toEqual(singlePathInstMerged.elemID.createNestedID('nested', 'str'))
        })
        it('should include changes that matches as parent of a selector', () => {
          const matchedChanges = changes.filter(c => getChangeData(c).elemID.isEqual(addedInstance.elemID))
          expect(matchedChanges).toHaveLength(1)
          const detailedChanges = matchedChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(1)
          expect(detailedChanges[0].id).toEqual(addedInstance.elemID)
        })
        it('should not filter change content by selectors', () => {
          const matchedChanges = changes.filter(c => getChangeData(c).elemID.isEqual(addedInstance.elemID))
          expect(matchedChanges).toHaveLength(1)
          const changeData = getChangeData(matchedChanges[0])
          expect(isInstanceElement(changeData) && changeData.isEqual(addedInstance)).toBeTruthy()
        })
      })
      describe('check diff handling of selectors', () => {
        it('returns empty diff when element id exists but is not in diff', async () => {
          const selectors = [createElementSelector(multiPathInstMerged.elemID.getFullName())]
          const changes = await createDiffChanges(
            createElementSource(beforeElements),
            createElementSource(afterElements),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            selectors,
            undefined,
            'changes',
          )
          expect(changes).toHaveLength(0)
        })
        // test disabled because validation is disabled.
        // eslint-disable-next-line
        it.skip('throws error when selector catches nothing', async () => {
          const selectors = [createElementSelector('salto.multiPathObj.field.thereisnofieldbythisname')]
          await expect(
            createDiffChanges(
              createElementSource(beforeElements),
              createElementSource(afterElements),
              new remoteMap.InMemoryRemoteMap<ElemID[]>(),
              selectors,
              undefined,
              'changes',
            ),
          ).rejects.toThrow()
        })
        it('includes child elements when their parent is selected', async () => {
          const nestedID = singlePathInstMerged.elemID.createNestedID('nested').createNestedID('str').getFullName()
          const simpleId = singlePathInstMerged.elemID.createNestedID('simple').getFullName()
          const newSinglePathInstMergedAfter = singlePathInstMergedAfter.clone() as InstanceElement
          newSinglePathInstMergedAfter.value.simple = 'old simple'
          const newAfterElements = [multiPathObjMerged, multiPathInstMerged, newSinglePathInstMergedAfter]
          const selectors = [createElementSelector(singlePathInstMerged.elemID.getFullName())]
          const changes = await createDiffChanges(
            createElementSource(beforeElements),
            createElementSource(newAfterElements),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            selectors,
            undefined,
            'changes',
          )
          expect(changes).toHaveLength(1)
          expect(getChangeData(changes[0]).elemID).toEqual(singlePathInstMerged.elemID)
          expect(
            changes[0]
              .detailedChanges()
              .map(detailed => detailed.id.getFullName())
              .sort(),
          ).toEqual([nestedID, simpleId].sort())
        })
        it('includes field inner annotations when the field is selected', async () => {
          const newSinglePathObjMerged = singlePathObjMerged.clone() as ObjectType
          newSinglePathObjMerged.fields.simple.annotations.description = 'new description'
          const simpleFieldId = newSinglePathObjMerged.elemID.createNestedID('field', 'simple')
          const selectors = [createElementSelector(simpleFieldId.getFullName())]
          const changes = await createDiffChanges(
            createInMemoryElementSource([newSinglePathObjMerged]),
            createInMemoryElementSource([singlePathObjMerged]),
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            selectors,
            undefined,
            'changes',
          )
          expect(changes).toHaveLength(1)
          expect(getChangeData(changes[0]).elemID).toEqual(simpleFieldId)
          expect(changes[0].detailedChanges().map(detailed => detailed.id.getFullName())).toEqual([
            simpleFieldId.createNestedID('description').getFullName(),
          ])
        })
      })
    })
  })
})

describe('getEnvsDeletionsDiff', () => {
  it('should return the deletions diff', async () => {
    const idInSource = new ElemID('adapter', 'type1')
    const selectors = createElementSelectors(['adapter.*'])

    const workspace = mockWorkspace({})
    const getElementIdsBySelectorsMock = workspace.getElementIdsBySelectors as jest.Mock
    getElementIdsBySelectorsMock.mockResolvedValueOnce([idInSource, new ElemID('adapter', 'type2')])
    getElementIdsBySelectorsMock.mockResolvedValueOnce([idInSource])
    const elementsToDelete = await getEnvsDeletionsDiff(
      workspace,
      [idInSource],
      ['env2', 'env3'],
      selectors.validSelectors,
    )
    expect(elementsToDelete).toEqual({
      env2: [new ElemID('adapter', 'type2')],
    })
  })
})
