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
import { convertToFeaturesXmlContent, convertToXmlContent, parseFeaturesXml, parseFileCabinetDir, parseObjectsDir } from '../../src/client/sdf_parser'
import { MOCK_FEATURES_XML, MOCK_FILE_ATTRS_PATH, MOCK_FILE_PATH, MOCK_FOLDER_ATTRS_PATH, MOCK_TEMPLATE_CONTENT, OBJECT_XML_WITH_HTML_CHARS, readDirMockFunction, readFileMockFunction } from './mocks'

const readDirMock = jest.fn()
const readFileMock = jest.fn()
jest.mock('@salto-io/file', () => ({
  readDir: jest.fn().mockImplementation((...args) => readDirMock(...args)),
  readFile: jest.fn().mockImplementation((...args) => readFileMock(...args)),
}))

describe('sdf parser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    readDirMock.mockImplementation(() => readDirMockFunction())
    readFileMock.mockImplementation(path => readFileMockFunction(path))
  })
  describe('parseObjectsDir', () => {
    it('should parse', async () => {
      await expect(parseObjectsDir('objectsDir')).resolves.toEqual([
        {
          fileContent: MOCK_TEMPLATE_CONTENT,
          fileExtension: 'html',
          scriptId: 'a',
          typeName: 'addressForm',
          values: {
            '@_filename': 'a.xml',
          },
        },
        {
          scriptId: 'b',
          typeName: 'addressForm',
          values: {
            '@_filename': 'b.xml',
          },
        },
      ])
      expect(readFileMock).toHaveBeenCalledTimes(3)
    })
    it('should decode html chars', async () => {
      readDirMock.mockResolvedValue(['custentity_my_script_id.xml'])
      readFileMock.mockResolvedValue(OBJECT_XML_WITH_HTML_CHARS)
      await expect(parseObjectsDir('objectsDir')).resolves.toEqual([{
        typeName: 'entitycustomfield',
        values: {
          '@_scriptid': 'custentity_my_script_id',
          // There is ZeroWidthSpace char between element and Name
          label: 'Golf & Co’Co element​Name',
        },
        scriptId: 'custentity_my_script_id',
      }])
    })
  })
  describe('parseFileCabinetDir', () => {
    it('should parse', async () => {
      await expect(parseFileCabinetDir('fileCabinetDir', [
        MOCK_FILE_PATH,
        MOCK_FILE_ATTRS_PATH,
        MOCK_FOLDER_ATTRS_PATH,
      ])).resolves.toEqual([
        {
          fileContent: 'dummy file content',
          path: [
            'Templates',
            'E-mail Templates',
            'InnerFolder',
            'content.html',
          ],
          typeName: 'file',
          values: {
            description: 'file description',
          },
        },
        {
          path: [
            'Templates',
            'E-mail Templates',
            'InnerFolder',
          ],
          typeName: 'folder',
          values: {
            description: 'folder description',
          },
        },
      ])
      expect(readFileMock).toHaveBeenCalledTimes(3)
    })
  })
  describe('parseFeaturesXml', () => {
    it('should parse', async () => {
      await expect(parseFeaturesXml('src/features.xml')).resolves.toEqual({
        typeName: 'companyFeatures',
        values: {
          feature: [
            {
              id: 'SUITEAPPCONTROLCENTER',
              status: 'ENABLED',
            },
          ],
        },
      })
    })
  })
  describe('convertToXmlContent', () => {
    it('should encode to html chars', async () => {
      const custInfo = {
        typeName: 'entitycustomfield',
        values: {
          '@_scriptid': 'custentity_my_script_id',
          // There is ZeroWidthSpace char between element and Name
          label: 'Golf & Co’Co element​Name',
        },
        scriptId: 'custentity_my_script_id',
      }
      // We use here === instead of expect.toEqual() since jest treats html encoding as equal to
      // the decoded value
      expect(convertToXmlContent(custInfo) === OBJECT_XML_WITH_HTML_CHARS).toBeTruthy()
    })
  })
  describe('convertToFeaturesXmlContent', () => {
    it('should convert', () => {
      const featuresCustInfo = {
        typeName: 'companyFeatures',
        values: {
          feature: [
            {
              id: 'SUITEAPPCONTROLCENTER',
              status: 'ENABLED',
            },
          ],
        },
      }
      expect(convertToFeaturesXmlContent(featuresCustInfo)).toEqual(MOCK_FEATURES_XML)
    })
  })
})
