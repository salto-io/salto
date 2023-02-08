/*
*                      Copyright 2023 Salto Labs Ltd.
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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID, InstanceElement, isReferenceExpression, ObjectType, ReferenceExpression, StaticFile, toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/element_references'
import { fileType } from '../../src/types/file_cabinet_types'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, PATH, SCRIPT_ID } from '../../src/constants'
import NetsuiteClient from '../../src/client/client'
import { SDF_CREATE_OR_UPDATE_GROUP_ID } from '../../src/group_changes'
import { FilterOpts } from '../../src/filter'
import { getDefaultAdapterConfig } from '../utils'


describe('instance_references filter', () => {
  describe('onFetch', () => {
    let fileInstance: InstanceElement
    let customSegmentInstance: InstanceElement
    let instanceInElementsSource: InstanceElement
    let workflowInstance: InstanceElement
    let instanceWithRefs: InstanceElement
    let customRecordType: ObjectType

    const getIndexesMock = jest.fn()
    const elementsSourceIndex = {
      getIndexes: getIndexesMock,
    }

    beforeEach(async () => {
      getIndexesMock.mockReset()
      getIndexesMock.mockResolvedValue({
        serviceIdRecordsIndex: {},
        internalIdsIndex: {},
      })

      const file = fileType()
      fileInstance = new InstanceElement('fileInstance', file, {
        [PATH]: '/Templates/file.name',
      })

      customSegmentInstance = new InstanceElement('customSegmentInstance', customsegmentType().type, {
        [SCRIPT_ID]: 'cseg_1',
        recordtype: '[scriptid=customrecord1]',
      })

      instanceInElementsSource = new InstanceElement('instanceInElementsSource', file, {
        [PATH]: '/Templates/instanceInElementsSource',
      })

      workflowInstance = new InstanceElement('instanceName', workflowType().type, {
        [SCRIPT_ID]: 'top_level',
        workflowstates: {
          workflowstate: [
            {
              [SCRIPT_ID]: 'one_nesting',
              workflowactions: [
                {
                  setfieldvalueaction: [
                    {
                      [SCRIPT_ID]: 'two_nesting',
                    },
                    {
                      [SCRIPT_ID]: 'two_nesting_with_inner_ref',
                      field: '[scriptid=top_level.one_nesting.two_nesting]',
                    },
                  ],
                },
              ],
            },
          ],
        },
      })

      instanceWithRefs = new InstanceElement(
        'instanceName',
        new ObjectType({ elemID: new ElemID('') }),
        {
          refToFilePath: '[/Templates/file.name]',
          refToScriptId: '[scriptid=top_level]',
          refToOneLevelNestedScriptId: '[scriptid=top_level.one_nesting]',
          refToTwoLevelNestedScriptId: '[scriptid=top_level.one_nesting.two_nesting]',
          refToNonExistingScriptId: '[scriptid=non_existing_script_id]',
          refToNonExistingPath: '[/Templates/non.existing]',
          refToInstanceInElementSourcePath: '[/Templates/instanceInElementsSource]',
          refToCustomSegment: '[type=customsegment, scriptid=cseg_1]',
          refToNonExistingTypedScriptId: '[type=customsegment, scriptid=non_existing_script_id]',
          refToScriptIdOfAnotherType: '[type=transactionbodycustomfield, scriptid=cseg_1]',
          stringWithMultipleRef: '[type=customsegment, scriptid=cseg_1]|STDBODYCUSTOMER|[type=customsegment, scriptid=cseg_1]|[scriptid=top_level.one_nesting.two_nesting]',
          stringWithMultipleNonExistingRef: '[type=nonExistingType, scriptid=nonExist]:STDBODYCUSTOMER:[scriptid=nonExisting.one_nesting]',
          refWithAppId: '[appid=foo.bar, scriptid=top_level]',
          refToCustomSegmentWithAppId: '[appid=foo.bar, type=customsegment, scriptid=cseg_1]',
          refWithBundleId: '[bundleid=123, scriptid=top_level]',
        },
        undefined,
        {
          refToFilePath: '[/Templates/file.name]',
          refToScriptId: '[scriptid=top_level]',
          [CORE_ANNOTATIONS.PARENT]: ['[/Templates/file.name]'],
        }
      )

      customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        fields: {
          custom_field: {
            refType: BuiltinTypes.STRING,
            annotations: {
              parent: '[scriptid=customrecord1]',
            },
          },
        },
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          [SCRIPT_ID]: 'customrecord1',
          customsegment: '[scriptid=cseg_1]',
        },
      })
    })

    it('should replace path references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])

      expect(instanceWithRefs.value.refToFilePath)
        .toEqual(new ReferenceExpression(fileInstance.elemID.createNestedID(PATH), '/Templates/file.name'))
    })

    it('should replace scriptid references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID(SCRIPT_ID), 'top_level'))
    })

    it('should replace annotations references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.annotations.refToFilePath)
        .toEqual(new ReferenceExpression(fileInstance.elemID.createNestedID(PATH), '/Templates/file.name'))
      expect(instanceWithRefs.annotations.refToScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID(SCRIPT_ID), 'top_level'))
    })

    it('should replace references in custom record type', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([customSegmentInstance, customRecordType])
      expect(customRecordType.annotations.customsegment)
        .toEqual(new ReferenceExpression(customSegmentInstance.elemID.createNestedID(SCRIPT_ID), 'cseg_1'))
      expect(customRecordType.fields.custom_field.annotations.parent)
        .toEqual(new ReferenceExpression(customRecordType.elemID.createNestedID('attr', SCRIPT_ID), 'customrecord1'))
    })

    it('should replace references to custom record type in instances', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([customSegmentInstance, customRecordType])
      expect(customSegmentInstance.value.recordtype)
        .toEqual(new ReferenceExpression(customRecordType.elemID.createNestedID('attr', SCRIPT_ID), 'customrecord1'))
    })

    it('parent should reference the element itself', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.annotations[CORE_ANNOTATIONS.PARENT])
        .toEqual([new ReferenceExpression(fileInstance.elemID)])
    })

    it('should replace scriptid with 1 nesting level references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToOneLevelNestedScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', SCRIPT_ID), 'one_nesting'))
    })

    it('should replace scriptid with 2 nesting level references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToTwoLevelNestedScriptId)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', 'workflowactions', '0', 'setfieldvalueaction', '0', SCRIPT_ID), 'two_nesting'))
    })

    it('should replace inner scriptid references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(workflowInstance.value.workflowstates.workflowstate[0].workflowactions[0]
        .setfieldvalueaction[1].field)
        .toEqual(new ReferenceExpression(workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', 'workflowactions', '0', 'setfieldvalueaction', '0', SCRIPT_ID), 'two_nesting'))
    })

    it('should replace type and scriptid references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([customSegmentInstance, fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToCustomSegment)
        .toEqual(new ReferenceExpression(customSegmentInstance.elemID.createNestedID(SCRIPT_ID), 'cseg_1'))
    })

    it('should not replace scriptid references for non existing scriptid', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToNonExistingScriptId)
        .toEqual('[scriptid=non_existing_script_id]')
    })

    it('should not replace type and scriptid references for non existing scriptid', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToNonExistingTypedScriptId)
        .toEqual('[type=customsegment, scriptid=non_existing_script_id]')
    })

    it('should not replace type and scriptid references when scriptid is of another type', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToScriptIdOfAnotherType)
        .toEqual('[type=transactionbodycustomfield, scriptid=cseg_1]')
    })

    it('should not replace appid and scriptid references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refWithAppId)
        .toEqual('[appid=foo.bar, scriptid=top_level]')
    })

    it('should not replace appid, type and scriptid references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToCustomSegmentWithAppId)
        .toEqual('[appid=foo.bar, type=customsegment, scriptid=cseg_1]')
    })

    it('should not replace bundleid and scriptid references', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refWithBundleId)
        .toEqual('[bundleid=123, scriptid=top_level]')
    })

    it('should not replace path references for unresolved ref', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToNonExistingPath)
        .toEqual('[/Templates/non.existing]')
    })

    it('should use elements source for creating the references with fetch is partial', async () => {
      getIndexesMock.mockResolvedValue({
        serviceIdRecordsIndex: {
          '/Templates/instanceInElementsSource': { elemID: instanceInElementsSource.elemID.createNestedID(PATH) },
        },
        internalIdsIndex: {},
      })
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: true,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToInstanceInElementSourcePath)
        .toEqual(new ReferenceExpression(instanceInElementsSource.elemID.createNestedID(PATH)))
    })

    it('should not use elements source for creating the references when fetch is not partial', async () => {
      getIndexesMock.mockResolvedValue({
        serviceIdRecordsIndex: {
          '/Templates/instanceInElementsSource': { elemID: instanceInElementsSource.elemID.createNestedID(PATH) },
        },
        internalIdsIndex: {},
      })
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([fileInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.refToInstanceInElementSourcePath)
        .toEqual('[/Templates/instanceInElementsSource]')
    })

    it('should create _genereated_dependencies annotation and not replace the value in complexed values', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([customSegmentInstance, workflowInstance, instanceWithRefs])


      expect(instanceWithRefs.value.stringWithMultipleRef)
        .toEqual('[type=customsegment, scriptid=cseg_1]|STDBODYCUSTOMER|[type=customsegment, scriptid=cseg_1]|[scriptid=top_level.one_nesting.two_nesting]')

      expect(instanceWithRefs.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
        .toHaveLength(3)
      expect(instanceWithRefs.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
        .toEqual([
          {
            reference: new ReferenceExpression(
              customSegmentInstance.elemID.createNestedID(SCRIPT_ID)
            ),
            occurrences: undefined,
          },
          {
            reference: new ReferenceExpression(
              workflowInstance.elemID.createNestedID(SCRIPT_ID)
            ),
            occurrences: undefined,
          },
          {
            reference: new ReferenceExpression(
              workflowInstance.elemID.createNestedID('workflowstates', 'workflowstate', '0', 'workflowactions', '0', 'setfieldvalueaction', '0', SCRIPT_ID)
            ),
            occurrences: undefined,
          },
        ])
    })

    it('should not replace complexed strings and ignore non existing refs', async () => {
      await filterCreator({
        client: {} as NetsuiteClient,
        elementsSourceIndex,
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }).onFetch?.([instanceWithRefs])


      expect(instanceWithRefs.value.stringWithMultipleNonExistingRef)
        .toEqual('[type=nonExistingType, scriptid=nonExist]:STDBODYCUSTOMER:[scriptid=nonExisting.one_nesting]')

      expect(instanceWithRefs.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
    })
  })
  describe('preDeploy', () => {
    let instanceWithReferences: InstanceElement
    let customRecordTypeWithReferences: ObjectType
    let fileInstanceWithContent: InstanceElement

    const filterOpts = { changesGroupId: SDF_CREATE_OR_UPDATE_GROUP_ID } as FilterOpts

    beforeEach(() => {
      const { type } = workflowType()
      const instance = new InstanceElement('customworkflow1', type, {
        [SCRIPT_ID]: 'customworkflow1',
        workflowstate: {
          workflowstate1: {
            [SCRIPT_ID]: 'workflowstate1',
          },
        },
      })
      instanceWithReferences = new InstanceElement(
        'customworkflow_test',
        type,
        {
          [SCRIPT_ID]: 'customworkflow_test',
          ref: new ReferenceExpression(instance.elemID.createNestedID(SCRIPT_ID), 'customworkflow1', instance),
        }
      )
      customRecordTypeWithReferences = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        fields: {
          custom_field: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [SCRIPT_ID]: 'customrecord1',
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          ref: new ReferenceExpression(instance.elemID.createNestedID('workflowstate', 'workflowstate1', SCRIPT_ID), 'workflowstate1', instance),
        },
      })
      customRecordTypeWithReferences.fields.custom_field.annotate({
        ref: new ReferenceExpression(customRecordTypeWithReferences.elemID.createNestedID('attr', SCRIPT_ID), 'customrecord1', customRecordTypeWithReferences),
      })
      fileInstanceWithContent = new InstanceElement(
        'file',
        fileType(),
        { content: new StaticFile({ filepath: '/file.txt', content: Buffer.from('some content') }) }
      )
    })
    it('should resolve references in instance', async () => {
      await filterCreator(filterOpts).preDeploy?.([toChange({ after: instanceWithReferences })])
      expect(instanceWithReferences.value.ref).toEqual('[scriptid=customworkflow1]')
    })
    it('should resolve references in custom record type', async () => {
      await filterCreator(filterOpts).preDeploy?.([toChange({ after: customRecordTypeWithReferences })])
      expect(customRecordTypeWithReferences.annotations.ref).toEqual('[scriptid=customworkflow1.workflowstate1]')
      expect(customRecordTypeWithReferences.fields.custom_field.annotations.ref).toEqual('[scriptid=customrecord1]')
    })
    it('should resolve static file', async () => {
      await filterCreator(filterOpts).preDeploy?.([toChange({ after: fileInstanceWithContent })])
      expect(fileInstanceWithContent.value.content).toEqual(Buffer.from('some content'))
    })
    it('should not resolve when groupID is not SDF', async () => {
      await filterCreator({} as FilterOpts).preDeploy?.([toChange({ after: instanceWithReferences })])
      expect(isReferenceExpression(instanceWithReferences.value.ref)).toBeTruthy()
    })
  })
})
