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
import { ElemID, InstanceElement, StaticFile, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import { mockFunction } from '@salto-io/test-utils'
import { CustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo } from '../src/client/types'
import {
  CONFIG_FEATURES,
  CUSTOM_RECORD_TYPE,
  ENTITY_CUSTOM_FIELD,
  FILE,
  FILE_CABINET_PATH,
  FOLDER,
  INTEGRATION,
  NETSUITE,
  PATH,
  RECORDS_PATH,
  SCRIPT_ID,
  SETTINGS_PATH,
} from '../src/constants'
import loadElementsFromFolder from '../src/sdf_folder_loader'
import { getMetadataTypes, isCustomRecordType, metadataTypesToList } from '../src/types'
import { createCustomRecordTypes } from '../src/custom_records/custom_record_type'
import { LocalFilterCreator } from '../src/filter'
import { addApplicationIdToType, addBundleFieldToType } from '../src/transformer'
import { createEmptyElementsSourceIndexes } from './utils'
import { fullFetchConfig } from '../src/config/config_creator'

const parseSdfProjectDirMock = jest.fn()
jest.mock('../src/client/sdf_parser', () => ({
  parseSdfProjectDir: jest.fn().mockImplementation((...args) => parseSdfProjectDirMock(...args)),
}))

const createElementsSourceIndexMock = jest.fn()
jest.mock('../src/elements_source_index/elements_source_index', () => ({
  createElementsSourceIndex: jest.fn().mockImplementation((...args) => createElementsSourceIndexMock(...args)),
}))

describe('sdf folder loader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  it('should return elements', async () => {
    const folderCustomizationInfo: FolderCustomizationInfo = {
      typeName: FOLDER,
      values: {},
      path: ['a', 'b'],
    }

    const fileCustomizationInfo: FileCustomizationInfo = {
      typeName: FILE,
      values: {},
      path: ['a', 'b', 'c'],
      fileContent: Buffer.from('Dummy content'),
    }

    const featuresCustomTypeInfo: CustomTypeInfo = {
      typeName: CONFIG_FEATURES,
      scriptId: CONFIG_FEATURES,
      values: {
        feature: [{ id: 'feature', label: 'Feature', status: 'ENABLED' }],
      },
    }

    const customTypeInfo: CustomTypeInfo = {
      typeName: ENTITY_CUSTOM_FIELD,
      values: {
        '@_scriptid': 'custentity_my_script_id',
        label: 'elementName',
      },
      scriptId: 'custentity_my_script_id',
    }

    const customRecordTypeCustInfo: CustomTypeInfo = {
      typeName: CUSTOM_RECORD_TYPE,
      values: {
        '@_scriptid': 'customrecord1',
        recordname: 'custom record 1',
      },
      scriptId: 'customrecord1',
    }

    const integrationCustInfo = {
      typeName: INTEGRATION,
      values: '',
    }

    parseSdfProjectDirMock.mockResolvedValue([
      folderCustomizationInfo,
      fileCustomizationInfo,
      featuresCustomTypeInfo,
      customTypeInfo,
      customRecordTypeCustInfo,
      integrationCustInfo,
    ])

    const elementsSourceIndex = createEmptyElementsSourceIndexes()
    createElementsSourceIndexMock.mockReturnValue(elementsSourceIndex)
    const filterMock = mockFunction<LocalFilterCreator>().mockReturnValue({
      name: 'filter',
      onFetch: () => Promise.resolve(undefined),
    })
    const elementsSource = buildElementsSourceFromElements([])

    const { elements } = await loadElementsFromFolder(
      {
        baseDir: 'projectDir',
        elementsSource,
      },
      [filterMock],
    )

    expect(createElementsSourceIndexMock).toHaveBeenCalledWith(elementsSource, true)
    expect(filterMock).toHaveBeenCalledWith({
      elementsSourceIndex,
      elementsSource,
      isPartial: true,
      config: { fetch: fullFetchConfig() },
    })
    expect(parseSdfProjectDirMock).toHaveBeenCalledWith('projectDir')

    const { standardTypes, additionalTypes, innerAdditionalTypes } = getMetadataTypes()
    const metadataTypes = metadataTypesToList({ standardTypes, additionalTypes, innerAdditionalTypes }).concat(
      createCustomRecordTypes([], standardTypes.customrecordtype.type),
    )

    addApplicationIdToType(additionalTypes.bundle)
    // metadataTypes + folderInstance + fileInstance + featuresInstance + customTypeInstance + customRecordType
    expect(elements).toHaveLength(metadataTypes.length + 5)
    const instance = elements.find(elem => isInstanceElement(elem) && elem.elemID.typeName === ENTITY_CUSTOM_FIELD)
    addApplicationIdToType(standardTypes[ENTITY_CUSTOM_FIELD].type)
    addBundleFieldToType(standardTypes[ENTITY_CUSTOM_FIELD].type, additionalTypes.bundle)
    expect(instance).toEqual(
      new InstanceElement(
        'custentity_my_script_id',
        standardTypes[ENTITY_CUSTOM_FIELD].type,
        {
          [SCRIPT_ID]: 'custentity_my_script_id',
          label: 'elementName',
        },
        [NETSUITE, RECORDS_PATH, ENTITY_CUSTOM_FIELD, 'custentity_my_script_id'],
      ),
    )

    const fileInstance = elements.find(elem => isInstanceElement(elem) && elem.elemID.typeName === FILE)
    addApplicationIdToType(additionalTypes[FILE])
    addBundleFieldToType(additionalTypes[FILE], additionalTypes.bundle)
    expect(fileInstance).toEqual(
      new InstanceElement(
        naclCase('a/b/c'),
        additionalTypes[FILE],
        {
          [PATH]: '/a/b/c',
          content: new StaticFile({
            filepath: 'netsuite/FileCabinet/a/b/c',
            content: Buffer.from('Dummy content'),
          }),
        },
        [NETSUITE, FILE_CABINET_PATH, 'a', 'b', 'c'],
      ),
    )

    const folderInstance = elements.find(elem => isInstanceElement(elem) && elem.elemID.typeName === FOLDER)
    addApplicationIdToType(additionalTypes[FOLDER])
    addBundleFieldToType(additionalTypes[FOLDER], additionalTypes.bundle)
    expect(folderInstance).toEqual(
      new InstanceElement(
        naclCase('a/b'),
        additionalTypes[FOLDER],
        {
          [PATH]: '/a/b',
        },
        [NETSUITE, FILE_CABINET_PATH, 'a', 'b', 'b'],
      ),
    )

    const featuresInstance = elements.find(elem => isInstanceElement(elem) && elem.elemID.typeName === CONFIG_FEATURES)
    addApplicationIdToType(additionalTypes[CONFIG_FEATURES])
    expect(featuresInstance).toEqual(
      new InstanceElement(
        ElemID.CONFIG_NAME,
        additionalTypes[CONFIG_FEATURES],
        {
          feature: [{ id: 'feature', label: 'Feature', status: 'ENABLED' }],
        },
        [NETSUITE, SETTINGS_PATH, CONFIG_FEATURES],
      ),
    )

    const customRecordType = elements.find(elem => isObjectType(elem) && isCustomRecordType(elem))
    addApplicationIdToType(standardTypes[CUSTOM_RECORD_TYPE].type)
    addBundleFieldToType(standardTypes[CUSTOM_RECORD_TYPE].type, additionalTypes.bundle)
    expect(customRecordType).toEqual(
      createCustomRecordTypes(
        [
          new InstanceElement('customrecord1', standardTypes[CUSTOM_RECORD_TYPE].type, {
            [SCRIPT_ID]: 'customrecord1',
            recordname: 'custom record 1',
          }),
        ],
        standardTypes[CUSTOM_RECORD_TYPE].type,
      )[0],
    )
  })
})
