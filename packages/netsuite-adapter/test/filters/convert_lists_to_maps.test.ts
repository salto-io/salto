/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { promises } from '@salto-io/lowerdash'
import { BuiltinTypes, Change, ElemID, getChangeData, InstanceElement, isListType, isObjectType, ListType, MapType, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/convert_lists_to_maps'
import { getStandardTypes } from '../../src/autogen/types'
import { getInnerStandardTypes, getTopLevelStandardTypes } from '../../src/types'
import { CUSTOM_RECORD_TYPE, LIST_MAPPED_BY_FIELD, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { TypeAndInnerTypes } from '../../src/types/object_types'

const getDataType = ({ withMaps }: { withMaps: boolean }): TypeAndInnerTypes => {
  const classTranslationType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'classTranslation'),
    fields: {
      locale: { refType: BuiltinTypes.STRING },
      language: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
    },
  })
  const classTranslationListType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'classTranslationList'),
    fields: {
      classTranslation: withMaps
        ? { refType: new MapType(classTranslationType), annotations: { [LIST_MAPPED_BY_FIELD]: ['locale', 'language'] } }
        : { refType: new ListType(classTranslationType) },
      replaceAll: { refType: BuiltinTypes.BOOLEAN },
    },
  })
  const type = new ObjectType({
    elemID: new ElemID(NETSUITE, 'subsidiary'),
    fields: {
      identifier: { refType: BuiltinTypes.SERVICE_ID },
      internalId: { refType: BuiltinTypes.STRING },
      classTranslationList: { refType: classTranslationListType },
    },
  })
  return {
    type,
    innerTypes: {
      classTranslationType,
      classTranslationListType,
    },
  }
}

describe('convert lists to maps filter', () => {
  describe('onFetch', () => {
    const standardTypes = getStandardTypes()
    let instance: InstanceElement
    let instanceWithMixedFieldKeys: InstanceElement
    let customRecordType: ObjectType
    let dataInstance: InstanceElement
    beforeAll(async () => {
      instance = new InstanceElement(
        'workflow1',
        standardTypes.workflow.type,
        {
          scriptid: 'customworkflow_changed_id',
          workflowcustomfields: {
            workflowcustomfield: [
              {
                scriptid: 'custworkflow1',
              },
              {
                scriptid: 'custworkflow2',
              },
            ],
          },
          workflowstates: {
            workflowstate: [
              {
                scriptid: 'workflowstate1',
                workflowactions: [
                  {
                    triggertype: 'ONENTRY',
                  },
                ],
              },
            ],
          },
        }
      )
      instanceWithMixedFieldKeys = new InstanceElement(
        'centercategory',
        standardTypes.centercategory.type,
        {
          scriptid: 'custcentercategory2',
          links: {
            link: [
              {
                linklabel: 'Asset Register',
                linkobject: '[scriptid=customscript_ncfar_assetregisterreport.customdeploy1]',
                linktasktype: 'SCRIPT',
                shortlist: false,
              },
              {
                linklabel: 'Asset Summary',
                linkobject: '[scriptid=customscript_ncfar_summaryreport_sl.customdeploy1]',
                linktasktype: 'SCRIPT',
                shortlist: false,
              },
              {
                linklabel: 'Depreciation Schedule',
                linkid: 'id1',
                linktasktype: 'SCRIPT',
                shortlist: false,
              },
              {
                linklabel: 'Depreciation Schedule (portrait)',
                linkid: 'id2',
                linktasktype: 'SCRIPT',
                shortlist: false,
              },
              {
                linklabel: 'Report Status',
                linkobject: '[scriptid=customscript_ncfar_reportstatus_sl.customdeploy_ncfar_reportstatus_sl]',
                linktasktype: 'SCRIPT',
                shortlist: false,
              },
            ],
          },
        }
      )
      customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotationRefsOrTypes: await promises.object.mapValuesAsync(
          standardTypes.customrecordtype.type.fields,
          field => field.getType()
        ),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          instances: {
            instance: [{
              [SCRIPT_ID]: 'customrecord1_record1',
            }, {
              [SCRIPT_ID]: 'customrecord1_record2',
            }],
          },
        },
      })
      const dataType = getDataType({ withMaps: false })
      dataInstance = new InstanceElement('subsidiary1', dataType.type, {
        identifier: 'subsidiary1',
        internalId: '1',
        classTranslationList: {
          classTranslation: [{
            language: 'Czech',
            name: 'a',
          }, {
            language: 'Danish',
            name: 'b',
          }, {
            language: 'German',
            name: 'c',
          }],
        },
      })

      await filterCreator().onFetch([
        ...getTopLevelStandardTypes(standardTypes),
        ...getInnerStandardTypes(standardTypes),
        instance,
        instanceWithMixedFieldKeys,
        customRecordType,
        dataType.type,
        ...Object.values(dataType.innerTypes),
        dataInstance,
      ])
    })
    it('should modify standard instance values', () => {
      expect(instance.value).toEqual({
        scriptid: 'customworkflow_changed_id',
        workflowcustomfields: {
          workflowcustomfield: {
            custworkflow1: {
              scriptid: 'custworkflow1',
              index: 0,
            },
            custworkflow2: {
              scriptid: 'custworkflow2',
              index: 1,
            },
          },
        },
        workflowstates: {
          workflowstate: {
            workflowstate1: {
              scriptid: 'workflowstate1',
              index: 0,
              workflowactions: {
                ONENTRY: {
                  triggertype: 'ONENTRY',
                  index: 0,
                },
              },
            },
          },
        },
      })
    })
    it('should modify data instance values', () => {
      expect(dataInstance.value).toEqual({
        identifier: 'subsidiary1',
        internalId: '1',
        classTranslationList: {
          classTranslation: {
            Czech: {
              language: 'Czech',
              name: 'a',
            },
            Danish: {
              language: 'Danish',
              name: 'b',
            },
            German: {
              language: 'German',
              name: 'c',
            },
          },
        },
      })
    })
    it('should modify instance values with mixed field keys', () => {
      expect(instanceWithMixedFieldKeys.value).toEqual({
        scriptid: 'custcentercategory2',
        links: {
          link: {
            'customscript_ncfar_assetregisterreport_customdeploy1@uuv': {
              linklabel: 'Asset Register',
              linkobject: '[scriptid=customscript_ncfar_assetregisterreport.customdeploy1]',
              linktasktype: 'SCRIPT',
              shortlist: false,
              index: 0,
            },
            'customscript_ncfar_summaryreport_sl_customdeploy1@uuuv': {
              linklabel: 'Asset Summary',
              linkobject: '[scriptid=customscript_ncfar_summaryreport_sl.customdeploy1]',
              linktasktype: 'SCRIPT',
              shortlist: false,
              index: 1,
            },
            id1: {
              linklabel: 'Depreciation Schedule',
              linkid: 'id1',
              linktasktype: 'SCRIPT',
              shortlist: false,
              index: 2,
            },
            id2: {
              linklabel: 'Depreciation Schedule (portrait)',
              linkid: 'id2',
              linktasktype: 'SCRIPT',
              shortlist: false,
              index: 3,
            },
            'customscript_ncfar_reportstatus_sl_customdeploy_ncfar_reportstatus_sl@uuuvuuu': {
              linklabel: 'Report Status',
              linkobject: '[scriptid=customscript_ncfar_reportstatus_sl.customdeploy_ncfar_reportstatus_sl]',
              linktasktype: 'SCRIPT',
              shortlist: false,
              index: 4,
            },
          },
        },
      })
    })
    it('should modify custom record type annotations', () => {
      expect(customRecordType.annotations).toEqual({
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        instances: {
          instance: {
            customrecord1_record1: {
              [SCRIPT_ID]: 'customrecord1_record1',
              index: 0,
            },
            customrecord1_record2: {
              [SCRIPT_ID]: 'customrecord1_record2',
              index: 1,
            },
          },
        },
      })
    })
  })
  describe('preDeploy', () => {
    let dataInstanceChange: Change<InstanceElement>
    beforeAll(async () => {
      dataInstanceChange = toChange({
        after: new InstanceElement('subsidiary1', getDataType({ withMaps: true }).type, {
          identifier: 'subsidiary1',
          internalId: '1',
          classTranslationList: {
            classTranslation: {
              Czech: {
                language: 'Czech',
                name: 'a',
              },
              Danish: {
                language: 'Danish',
                name: 'b',
              },
              German: {
                language: 'German',
                name: 'c',
              },
            },
          },
        }),
      })

      await filterCreator().preDeploy([dataInstanceChange])
    })
    it('should modify data instance values', () => {
      expect(getChangeData(dataInstanceChange).value).toEqual({
        identifier: 'subsidiary1',
        internalId: '1',
        classTranslationList: {
          classTranslation: [{
            language: 'Czech',
            name: 'a',
          }, {
            language: 'Danish',
            name: 'b',
          }, {
            language: 'German',
            name: 'c',
          }],
        },
      })
    })
    it('should modify data instance ref type', () => {
      const instance = getChangeData(dataInstanceChange)
      expect(
        isObjectType(instance.refType.type)
        && isObjectType(instance.refType.type.fields.classTranslationList.refType.type)
        && isListType(instance.refType.type.fields.classTranslationList.refType.type
          .fields.classTranslation.refType.type)
      ).toBeTruthy()
    })
  })
})
