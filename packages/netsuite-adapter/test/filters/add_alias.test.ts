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
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Element,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { CUSTOM_RECORD_TYPE, IS_SUB_INSTANCE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import filterCreator from '../../src/filters/add_alias'
import { LocalFilterOpts } from '../../src/filter'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { translationcollectionType } from '../../src/autogen/types/standard_types/translationcollection'
import { fileType } from '../../src/types/file_cabinet_types'
import { getConfigurationTypes } from '../../src/types/configuration_types'
import { bundleType } from '../../src/types/bundle_type'
import { emptyQueryParams, fullQueryParams } from '../../src/config/config_creator'

describe('add alias filter', () => {
  const { type: workflow } = workflowType()
  const { type: customsegment } = customsegmentType()
  const { type: translationcollection } = translationcollectionType()
  const { type: bundle } = bundleType()
  const { companyFeatures } = getConfigurationTypes()
  const file = fileType()
  const customer = new ObjectType({ elemID: new ElemID(NETSUITE, 'customer') })
  const assemblyItem = new ObjectType({ elemID: new ElemID(NETSUITE, 'assemblyItem') })

  let standardInstance: InstanceElement
  let fileCabinetInstance: InstanceElement
  let dataInstance: InstanceElement
  let itemInstance: InstanceElement

  let customRecordType: ObjectType
  let segmentInstance: InstanceElement
  let customRecordTypeWithSegment: ObjectType

  let settingsInstance: InstanceElement
  let bundleInstance: InstanceElement
  let customRecordInstance: InstanceElement
  let subInstance: InstanceElement

  let dataInstanceWithFallback: InstanceElement
  let itemInstanceWithFallback: InstanceElement
  let subInstanceWithFallback: InstanceElement

  let translationCollectionInstance: InstanceElement
  let standardInstanceWithTranslation: InstanceElement
  let customRecordTypeWithTranslation: ObjectType
  let segmentInstanceWithTranslation: InstanceElement
  let customRecordTypeWithSegmentWithTranslation: ObjectType

  let elements: Element[]

  let defaultOpts: LocalFilterOpts
  let optsWithoutAlias: LocalFilterOpts
  let optsWithAlias: LocalFilterOpts
  let optsWithAliasAndIsPartial: LocalFilterOpts
  beforeEach(async () => {
    standardInstance = new InstanceElement('customworkflow1', workflow, {
      name: 'Custom Workflow 1',
    })
    fileCabinetInstance = new InstanceElement('someFile', file, {
      path: '/SuiteScript/someFile.txt',
    })
    dataInstance = new InstanceElement('customer1', customer, {
      firstName: 'Salto',
      lastName: 'User',
      accountNumber: 'A01',
      entityId: 'entity id',
    })
    itemInstance = new InstanceElement('assemblyItem1', assemblyItem, {
      displayName: 'Assembly Item 1',
      itemId: 'item id',
    })
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: {
        recordname: 'Custom Record 1',
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    segmentInstance = new InstanceElement('cseg1', customsegment, {
      label: 'Custom Segment 1',
    })
    customRecordTypeWithSegment = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord_cseg1'),
      annotations: {
        customsegment: new ReferenceExpression(segmentInstance.elemID.createNestedID(SCRIPT_ID)),
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    settingsInstance = new InstanceElement(ElemID.CONFIG_NAME, companyFeatures)
    bundleInstance = new InstanceElement('12345', bundle, {
      name: 'Bundle Name',
    })
    customRecordInstance = new InstanceElement('val_123', customRecordType, {
      name: 'Custom Record Instance',
    })
    subInstance = new InstanceElement('subInstance1', customer, {
      name: 'Sub Instance 1',
      label: 'some label',
      [IS_SUB_INSTANCE]: true,
    })
    dataInstanceWithFallback = new InstanceElement('customer2', customer, {
      entityId: 'Customer 2',
    })
    itemInstanceWithFallback = new InstanceElement('assemblyItem2', assemblyItem, {
      itemId: 'Assembly Item 2',
    })
    subInstanceWithFallback = new InstanceElement('subInstance2', customer, {
      label: 'Sub Instance 2',
      [IS_SUB_INSTANCE]: true,
    })

    translationCollectionInstance = new InstanceElement('custtranslation1', translationcollection, {
      name: new ReferenceExpression(
        translationcollection.elemID.createNestedID(
          'instance',
          'custtranslation1',
          'strings',
          'string',
          'self',
          SCRIPT_ID,
        ),
      ),
      strings: {
        string: {
          self: {
            scriptid: 'translated_custtranslation',
            defaulttranslation: 'Translated Custom Translation',
          },
          customworkflow: {
            scriptid: 'translated_customworkflow',
            defaulttranslation: 'Translated Custom Workflow',
          },
          customrecord: {
            scriptid: 'translated_customrecord',
            defaulttranslation: 'Translated Custom Record Type',
          },
          customsegment: {
            scriptid: 'translated_customsegment',
            defaulttranslation: 'Translated Custom Segment',
          },
        },
      },
    })
    standardInstanceWithTranslation = new InstanceElement('customworkflow2', workflow, {
      name: new ReferenceExpression(
        translationCollectionInstance.elemID.createNestedID('strings', 'string', 'customworkflow', SCRIPT_ID),
      ),
    })
    customRecordTypeWithTranslation = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord2'),
      annotations: {
        recordname: new ReferenceExpression(
          translationCollectionInstance.elemID.createNestedID('strings', 'string', 'customrecord', SCRIPT_ID),
        ),
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    segmentInstanceWithTranslation = new InstanceElement('cseg2', customsegment, {
      label: new ReferenceExpression(
        translationCollectionInstance.elemID.createNestedID('strings', 'string', 'customsegment', SCRIPT_ID),
      ),
    })
    customRecordTypeWithSegmentWithTranslation = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord_cseg2'),
      annotations: {
        customsegment: new ReferenceExpression(segmentInstanceWithTranslation.elemID.createNestedID(SCRIPT_ID)),
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })

    elements = [
      standardInstance,
      fileCabinetInstance,
      dataInstance,
      itemInstance,
      customRecordType,
      segmentInstance,
      customRecordTypeWithSegment,
      settingsInstance,
      bundleInstance,
      customRecordInstance,
      subInstance,
      dataInstanceWithFallback,
      itemInstanceWithFallback,
      subInstanceWithFallback,
      translationCollectionInstance,
      standardInstanceWithTranslation,
      customRecordTypeWithTranslation,
      segmentInstanceWithTranslation,
      customRecordTypeWithSegmentWithTranslation,
    ]

    defaultOpts = {
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
    optsWithoutAlias = {
      ...defaultOpts,
      config: {
        fetch: {
          include: fullQueryParams(),
          exclude: emptyQueryParams(),
          addAlias: false,
        },
      },
    }
    optsWithAlias = {
      ...defaultOpts,
      config: {
        fetch: {
          include: fullQueryParams(),
          exclude: emptyQueryParams(),
          addAlias: true,
        },
      },
    }
    optsWithAliasAndIsPartial = {
      ...optsWithAlias,
      isPartial: true,
      elementsSource: buildElementsSourceFromElements([translationCollectionInstance]),
    }
  })
  it('should not add aliases when addAlias=false', async () => {
    await filterCreator(optsWithoutAlias).onFetch?.(elements)
    expect(elements.some(elem => elem.annotations[CORE_ANNOTATIONS.ALIAS] !== undefined)).toBeFalsy()
  })
  it('should add aliases by default', async () => {
    await filterCreator(defaultOpts).onFetch?.(elements)
    expect(elements.every(elem => elem.annotations[CORE_ANNOTATIONS.ALIAS] !== undefined)).toBeTruthy()
  })
  it('should add aliases', async () => {
    await filterCreator(optsWithAlias).onFetch?.(elements)

    expect(standardInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Custom Workflow 1')
    expect(fileCabinetInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('someFile.txt')
    expect(dataInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Salto User A01')
    expect(itemInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Assembly Item 1')
    expect(customRecordType.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Custom Record 1')
    expect(segmentInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Custom Segment 1')
    expect(customRecordTypeWithSegment.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Custom Segment 1')
    expect(settingsInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Company Features')
    expect(bundleInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Bundle Name')
    expect(customRecordInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Custom Record Instance')
    expect(subInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Sub Instance 1')
    expect(dataInstanceWithFallback.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Customer 2')
    expect(itemInstanceWithFallback.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Assembly Item 2')
    expect(subInstanceWithFallback.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Sub Instance 2')
    expect(translationCollectionInstance.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Translated Custom Translation')
    expect(standardInstanceWithTranslation.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Translated Custom Workflow')
    expect(customRecordTypeWithTranslation.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Translated Custom Record Type')
    expect(segmentInstanceWithTranslation.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Translated Custom Segment')
    expect(customRecordTypeWithSegmentWithTranslation.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual(
      'Translated Custom Segment',
    )
  })
  it('should take translated names from element source on partial fetch', async () => {
    await filterCreator(optsWithAliasAndIsPartial).onFetch?.([
      standardInstanceWithTranslation,
      customRecordTypeWithTranslation,
      segmentInstanceWithTranslation,
      customRecordTypeWithSegmentWithTranslation,
    ])
    expect(standardInstanceWithTranslation.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Translated Custom Workflow')
    expect(customRecordTypeWithTranslation.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Translated Custom Record Type')
    expect(segmentInstanceWithTranslation.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual('Translated Custom Segment')
    expect(customRecordTypeWithSegmentWithTranslation.annotations[CORE_ANNOTATIONS.ALIAS]).toEqual(
      'Translated Custom Segment',
    )
  })
})
