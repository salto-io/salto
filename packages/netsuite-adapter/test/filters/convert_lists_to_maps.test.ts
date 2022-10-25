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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/convert_lists_to_maps'
import { getStandardTypes } from '../../src/autogen/types'
import { getInnerStandardTypes, getTopLevelStandardTypes } from '../../src/types'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'

describe('convert lists to maps filter', () => {
  const standardTypes = getStandardTypes()
  let instance: InstanceElement
  let instanceWithMixedFieldKeys: InstanceElement
  let customRecordType: ObjectType
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
    await filterCreator().onFetch([
      ...getTopLevelStandardTypes(standardTypes),
      ...getInnerStandardTypes(standardTypes),
      instance,
      instanceWithMixedFieldKeys,
      customRecordType,
    ])
  })

  it('should modify instance values', () => {
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

  it('should throw when missing some types with field mapping', async () => {
    await expect(filterCreator().onFetch([
      standardTypes.workflow.type,
      ...Object.values(standardTypes.workflow.innerTypes),
      instance,
    ])).rejects.toThrow('missing some types with field mapping')
  })
})
