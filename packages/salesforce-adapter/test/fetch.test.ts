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
import _ from 'lodash'
import { FileProperties } from 'jsforce-types'
import { MockInterface } from '@salto-io/test-utils'
import {
  InstanceElement,
} from '@salto-io/adapter-api'
import Connection from '../src/client/jsforce'
import createMockClient from './client'
import { retrieveMetadataInstances } from '../src/fetch'
import { mockTypes } from './mock_elements'
import {
  CUSTOM_OBJECT,
  DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
  PROFILE_METADATA_TYPE,
} from '../src/constants'
import SalesforceClient from '../src/client/client'
import { buildMetadataQuery } from '../src/fetch_profile/metadata_query'
import {
  mockFileProperties,
  mockRetrieveLocator,
  mockRetrieveResult,
} from './connection'
import { ZipFile } from './utils'
import { MetadataObjectType } from '../src/transformers/transformer'
import { isInstanceOfType } from '../src/filters/utils'

describe('Fetch via retrieve API', () => {
  let connection: MockInterface<Connection>
  let client: SalesforceClient

  const updateProfileZipFileContents = (zipFile: ZipFile, fileProps: FileProperties[]): void => {
    const customObjectTypes = [...new Set(fileProps
      .filter(fileProp => fileProp.type === CUSTOM_OBJECT)
      .map(fileProp => fileProp.fullName))]
    zipFile.content = `<?xml version="1.0" encoding="UTF-8"?>
          <Profile xmlns="http://soap.sforce.com/2006/04/metadata">
              <apiVersion>57.0</apiVersion>
              <custom>false</custom>`
    customObjectTypes.forEach(type => {
      zipFile.content += `<fieldPermissions>
        <editable>true</editable>
        <field>${type}.SomeField</field>
        <readable>true</readable>
    </fieldPermissions>`
    })
    zipFile.content += '</Profile>'
  }

  const setupMocks = async (fileProps: FileProperties[], zipFiles: ZipFile[]): Promise<void> => {
    connection.metadata.list.mockImplementation(async inputQueries => {
      const queries = Array.isArray(inputQueries) ? inputQueries : [inputQueries]
      return _(queries)
        .map(query => fileProps.filter(fileProp => fileProp.type === query.type))
        .flatten()
        .value()
    })
    zipFiles
      .filter(zipFile => zipFile.content.includes('</Profile>'))
      .forEach(zipFile => updateProfileZipFileContents(zipFile, fileProps))
    connection.metadata.retrieve.mockReturnValue(mockRetrieveLocator(mockRetrieveResult({ zipFiles })))
  }

  const createFilePath = (fileName: string, type: MetadataObjectType): string => (
    `unpackaged/${fileName}${type.annotations.hasMetaFile ? '-meta.xml' : ''}`
  )

  const generateMockData = (
    instanceDefs: { type: MetadataObjectType; instanceName: string }[]
  ): { fileProps: FileProperties[]; zipFiles: ZipFile[] } => {
    const fileProps = instanceDefs
      .map(({ type, instanceName }) => mockFileProperties({ type: type.elemID.typeName, fullName: instanceName }))

    const zipFiles = _.zip(fileProps, instanceDefs)
      .map(([fileProp, instanceDef]) => {
        if (fileProp === undefined || instanceDef === undefined) {
          // can't happen
          return { path: '', content: '' }
        }
        return {
          path: createFilePath(fileProp.fileName, instanceDef.type),
          content: `<?xml version="1.0" encoding="UTF-8"?>
          <${fileProp.type} xmlns="http://soap.sforce.com/2006/04/metadata">
              <apiVersion>57.0</apiVersion>
          </${fileProp.type}>`,
        }
      })
    return {
      fileProps,
      zipFiles,
    }
  }

  beforeEach(async () => {
    ({ connection, client } = createMockClient())
  })

  describe.each([
    {
      desc: 'Single regular instance',
      chunkSize: DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
      testData: [
        { type: mockTypes.ApexClass, instanceName: 'SomeApexClass' },
      ],
    },
    {
      desc: 'Single chunk of regular instances',
      chunkSize: DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
      testData: [
        { type: mockTypes.ApexClass, instanceName: 'SomeApexClass' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
      ],
    },
    {
      desc: 'Multiple chunks of regular instances',
      chunkSize: 1,
      testData: [
        { type: mockTypes.ApexClass, instanceName: 'SomeApexClass' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
      ],
    },
    {
      desc: 'Single chunk with profile',
      chunkSize: DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
      testData: [
        { type: mockTypes.CustomObject, instanceName: 'Case' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
        { type: mockTypes.Profile, instanceName: 'SomeProfile' },
      ],
    },
    {
      desc: 'Multiple chunks with profile',
      chunkSize: 2,
      testData: [
        { type: mockTypes.CustomObject, instanceName: 'Case' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
        { type: mockTypes.Profile, instanceName: 'SomeProfile' },
      ],
    },
    {
      desc: 'Multiple chunks with multiple profiles',
      chunkSize: 3,
      testData: [
        { type: mockTypes.CustomObject, instanceName: 'Case' },
        { type: mockTypes.CustomObject, instanceName: 'Account' },
        { type: mockTypes.Profile, instanceName: 'SomeProfile' },
        { type: mockTypes.Profile, instanceName: 'SomeOtherProfile' },
      ],
    },
  ])('$desc', ({ chunkSize, testData }) => {
    let elements: InstanceElement[] = []

    beforeEach(async () => {
      const mockData = generateMockData(testData)
      await setupMocks(mockData.fileProps, mockData.zipFiles)

      elements = (await retrieveMetadataInstances(
        {
          client,
          types: [...new Set(testData.map(({ type }) => type))],
          maxItemsInRetrieveRequest: chunkSize,
          metadataQuery: buildMetadataQuery({}),
          addNamespacePrefixToFullName: false,
          typesToSkip: new Set(),
        }
      )
      ).elements
    })
    it('should fetch the correct instances', () => {
      expect(elements).toHaveLength(testData.length)
      expect(elements).toIncludeAllPartialMembers(
        testData
          .map(({ type, instanceName }) => ({ elemID: type.elemID.createNestedID('instance', instanceName) }))
      )
      const customObjectTypes = testData
        .filter(({ type }) => type.elemID.typeName === 'CustomObject')
        .map(({ instanceName }) => instanceName)
      elements
        .filter(isInstanceOfType(PROFILE_METADATA_TYPE))
        .forEach(profileInstance => {
          // ensure we got permissions for all the customobjects we sent with the profile
          expect(profileInstance.value.fieldPermissions).not.toBeEmpty()
          profileInstance.value.fieldPermissions.forEach((perm: {field: string}) => {
            expect(customObjectTypes).toInclude(perm.field.split('.')[0])
          })

          // ensure there are no duplications (we know we only add one field permission per object in the mock)
          const objectsInProfile = profileInstance.value.fieldPermissions
            .map((perm: {field: string}) => perm.field.split('.')[0])
          expect(_.sortBy(objectsInProfile)).toEqual(_.sortBy(customObjectTypes))
        })
    })
  })
})
