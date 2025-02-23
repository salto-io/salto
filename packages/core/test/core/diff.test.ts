/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import {
  merger,
  createElementSelector,
  elementSource,
  createElementSelectors,
  remoteMap,
  ReferenceIndexEntry,
  flags,
} from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { setupEnvVar } from '@salto-io/test-utils'
import { mockWorkspace } from '../common/workspace'
import { createDiffChanges, getEnvsDeletionsDiff } from '../../src/core/diff'
import { createElementSource } from '../common/helpers'
import { ChangeWithDetails } from '../../src/core/plan'

const { createInMemoryElementSource } = elementSource
const { awu } = collections.asynciterable
const { mergeElements } = merger
const { SALTO_FLAG_PREFIX, WORKSPACE_FLAGS } = flags

describe.each([0, 1])('with SALTO_CORE_REPLACE_GET_PLAN_WITH_CALCULATE_DIFF=%s', replaceGetPlanWithCalculateDiff => {
  setupEnvVar(
    SALTO_FLAG_PREFIX + WORKSPACE_FLAGS.replaceGetPlanWithCalculateDiff,
    replaceGetPlanWithCalculateDiff,
    'all',
  )
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
          const changes = await createDiffChanges({
            toElementsSrc: createElementSource(allElement),
            fromElementsSrc: createElementSource(allElement),
            referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
          })
          expect(changes).toHaveLength(0)
        })
      })
      describe('changesWithDetails', () => {
        it('should not create changes toElements and the fromElements are the same', async () => {
          const changes = await createDiffChanges({
            toElementsSrc: createElementSource(allElement),
            fromElementsSrc: createElementSource(allElement),
            referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
            resultType: 'changes',
          })
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
            changes = await createDiffChanges({
              toElementsSrc: createElementSource(beforeElements),
              fromElementsSrc: createElementSource(afterElements),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
            })
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
            changes = await createDiffChanges({
              toElementsSrc: createElementSource(beforeElements.concat(beforeInstance)),
              fromElementsSrc: createElementSource(afterElements.concat(afterInstance, addedInstance)),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              elementSelectors: selectors,
            })
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
            const changes = await createDiffChanges({
              toElementsSrc: createElementSource(beforeElements),
              fromElementsSrc: createElementSource(afterElements),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              elementSelectors: selectors,
            })
            expect(changes).toHaveLength(0)
          })
          // test disabled because validation is disabled.
          // eslint-disable-next-line
          it.skip('throws error when selector catches nothing', async () => {
            const selectors = [createElementSelector('salto.multiPathObj.field.thereisnofieldbythisname')]
            await expect(
              createDiffChanges({
                toElementsSrc: createElementSource(beforeElements),
                fromElementsSrc: createElementSource(afterElements),
                referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
                elementSelectors: selectors,
              }),
            ).rejects.toThrow()
          })
          it('includes child elements when their parent is selected ', async () => {
            const nestedID = singlePathInstMerged.elemID.createNestedID('nested').createNestedID('str').getFullName()
            const simpleId = singlePathInstMerged.elemID.createNestedID('simple').getFullName()
            const newSinglePathInstMergedAfter = singlePathInstMergedAfter.clone()
            newSinglePathInstMergedAfter.value.simple = 'old simple'
            const newAfterElements = [multiPathObjMerged, multiPathInstMerged, newSinglePathInstMergedAfter]
            const selectors = [createElementSelector(singlePathInstMerged.elemID.getFullName())]
            const changes = await createDiffChanges({
              toElementsSrc: createElementSource(beforeElements),
              fromElementsSrc: createElementSource(newAfterElements),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              elementSelectors: selectors,
            })
            expect(changes).toHaveLength(2)
            expect(changes.map(change => change.id.getFullName()).sort()).toEqual([nestedID, simpleId].sort())
          })
          it('includes field inner annotations when the field is selected', async () => {
            const newSinglePathObjMerged = singlePathObjMerged.clone() as ObjectType
            newSinglePathObjMerged.fields.simple.annotations.description = 'new description'
            const simpleFieldId = newSinglePathObjMerged.elemID.createNestedID('field', 'simple')
            const selectors = [createElementSelector(simpleFieldId.getFullName())]
            const changes = await createDiffChanges({
              toElementsSrc: createInMemoryElementSource([newSinglePathObjMerged]),
              fromElementsSrc: createInMemoryElementSource([singlePathObjMerged]),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              elementSelectors: selectors,
            })
            expect(changes.map(change => change.id.getFullName())).toEqual([
              simpleFieldId.createNestedID('description').getFullName(),
            ])
          })
        })
        describe('with compare options', () => {
          describe('compareListItems', () => {
            let changes: DetailedChange[]
            beforeAll(async () => {
              const beforeInstance = new InstanceElement('instance', singlePathObject, {
                simple: 'Simple',
                nested: {
                  str: 'Str',
                  num: 7,
                  list: [1, 2, 3],
                },
              })
              const afterInstance = new InstanceElement('instance', singlePathObject, {
                simple: 'Simple',
                nested: {
                  str: 'Str',
                  num: 7,
                  list: [2, 3, 4, 5],
                },
              })
              changes = await createDiffChanges({
                toElementsSrc: createElementSource([beforeInstance]),
                fromElementsSrc: createElementSource([afterInstance]),
                compareOptions: { compareListItems: true },
              })
            })
            it('should create all list items detailed changes', () => {
              expect(changes).toHaveLength(5)

              const firstItemRemoval = changes.find(change => change.elemIDs?.before?.name === '0')
              expect(firstItemRemoval?.action).toEqual('remove')
              expect(firstItemRemoval?.data).toEqual({ before: 1 })

              const secondItemReorder = changes.find(change => change.elemIDs?.before?.name === '1')
              expect(secondItemReorder?.action).toEqual('modify')
              expect(secondItemReorder?.data).toEqual({ before: 2, after: 2 })
              expect(secondItemReorder?.elemIDs?.after?.name).toEqual('0')

              const thirdItemReorder = changes.find(change => change.elemIDs?.before?.name === '2')
              expect(thirdItemReorder?.action).toEqual('modify')
              expect(thirdItemReorder?.data).toEqual({ before: 3, after: 3 })
              expect(thirdItemReorder?.elemIDs?.after?.name).toEqual('1')

              const fourthItemAddition = changes.find(change => change.elemIDs?.after?.name === '2')
              expect(fourthItemAddition?.action).toEqual('add')
              expect(fourthItemAddition?.data).toEqual({ after: 4 })

              const fifthItemAddition = changes.find(change => change.elemIDs?.after?.name === '3')
              expect(fifthItemAddition?.action).toEqual('add')
              expect(fifthItemAddition?.data).toEqual({ after: 5 })
            })
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
            changes = await createDiffChanges({
              toElementsSrc: createElementSource(beforeElements),
              fromElementsSrc: createElementSource(afterElements),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              resultType: 'changes',
            })
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
            changes = await createDiffChanges({
              toElementsSrc: createElementSource(beforeElements.concat(beforeInstance)),
              fromElementsSrc: createElementSource(afterElements.concat(afterInstance, addedInstance)),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              elementSelectors: selectors,
              resultType: 'changes',
            })
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
            const changes = await createDiffChanges({
              toElementsSrc: createElementSource(beforeElements),
              fromElementsSrc: createElementSource(afterElements),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              elementSelectors: selectors,
              resultType: 'changes',
            })
            expect(changes).toHaveLength(0)
          })
          // test disabled because validation is disabled.
          // eslint-disable-next-line
          it.skip('throws error when selector catches nothing', async () => {
            const selectors = [createElementSelector('salto.multiPathObj.field.thereisnofieldbythisname')]
            await expect(
              createDiffChanges({
                toElementsSrc: createElementSource(beforeElements),
                fromElementsSrc: createElementSource(afterElements),
                referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
                elementSelectors: selectors,
                resultType: 'changes',
              }),
            ).rejects.toThrow()
          })
          it('includes child elements when their parent is selected', async () => {
            const nestedID = singlePathInstMerged.elemID.createNestedID('nested').createNestedID('str').getFullName()
            const simpleId = singlePathInstMerged.elemID.createNestedID('simple').getFullName()
            const newSinglePathInstMergedAfter = singlePathInstMergedAfter.clone()
            newSinglePathInstMergedAfter.value.simple = 'old simple'
            const newAfterElements = [multiPathObjMerged, multiPathInstMerged, newSinglePathInstMergedAfter]
            const selectors = [createElementSelector(singlePathInstMerged.elemID.getFullName())]
            const changes = await createDiffChanges({
              toElementsSrc: createElementSource(beforeElements),
              fromElementsSrc: createElementSource(newAfterElements),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              elementSelectors: selectors,
              resultType: 'changes',
            })
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
            const changes = await createDiffChanges({
              toElementsSrc: createInMemoryElementSource([newSinglePathObjMerged]),
              fromElementsSrc: createInMemoryElementSource([singlePathObjMerged]),
              referenceSourcesIndex: new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
              elementSelectors: selectors,
              resultType: 'changes',
            })
            expect(changes).toHaveLength(1)
            expect(getChangeData(changes[0]).elemID).toEqual(simpleFieldId)
            expect(changes[0].detailedChanges().map(detailed => detailed.id.getFullName())).toEqual([
              simpleFieldId.createNestedID('description').getFullName(),
            ])
          })
        })
        describe('with compare options', () => {
          describe('compareListItems', () => {
            let changes: ChangeWithDetails[]
            let detailedChanges: DetailedChange[]
            beforeAll(async () => {
              const beforeInstance = new InstanceElement('instance', singlePathObject, {
                simple: 'Simple',
                nested: {
                  str: 'Str',
                  num: 7,
                  list: [1, 2, 3],
                },
              })
              const afterInstance = new InstanceElement('instance', singlePathObject, {
                simple: 'Simple',
                nested: {
                  str: 'Str',
                  num: 7,
                  list: [2, 3, 4, 5],
                },
              })
              changes = await createDiffChanges({
                toElementsSrc: createElementSource([beforeInstance]),
                fromElementsSrc: createElementSource([afterInstance]),
                compareOptions: { compareListItems: true },
                resultType: 'changes',
              })
              detailedChanges = changes.flatMap(c => c.detailedChanges())
            })
            it('should create all list items detailed changes', () => {
              expect(changes).toHaveLength(1)
              expect(detailedChanges).toHaveLength(5)

              const firstItemRemoval = detailedChanges.find(change => change.elemIDs?.before?.name === '0')
              expect(firstItemRemoval?.action).toEqual('remove')
              expect(firstItemRemoval?.data).toEqual({ before: 1 })

              const secondItemReorder = detailedChanges.find(change => change.elemIDs?.before?.name === '1')
              expect(secondItemReorder?.action).toEqual('modify')
              expect(secondItemReorder?.data).toEqual({ before: 2, after: 2 })
              expect(secondItemReorder?.elemIDs?.after?.name).toEqual('0')

              const thirdItemReorder = detailedChanges.find(change => change.elemIDs?.before?.name === '2')
              expect(thirdItemReorder?.action).toEqual('modify')
              expect(thirdItemReorder?.data).toEqual({ before: 3, after: 3 })
              expect(thirdItemReorder?.elemIDs?.after?.name).toEqual('1')

              const fourthItemAddition = detailedChanges.find(change => change.elemIDs?.after?.name === '2')
              expect(fourthItemAddition?.action).toEqual('add')
              expect(fourthItemAddition?.data).toEqual({ after: 4 })

              const fifthItemAddition = detailedChanges.find(change => change.elemIDs?.after?.name === '3')
              expect(fifthItemAddition?.action).toEqual('add')
              expect(fifthItemAddition?.data).toEqual({ after: 5 })
            })
          })
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
