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
import { readTextFile } from '@salto-io/file'
import { InstanceElement } from '@salto-io/adapter-api'
import customFieldsFilter from '../../../src/sfdx_parser/filters/custom_fields'
import { defaultFilterContext } from '../../utils'
import { mockTypes } from '../../mock_elements'
import { createInstanceElement } from '../../../src/transformers/transformer'

jest.mock('@salto-io/file', () => {
  const actual = jest.requireActual('@salto-io/file')
  const fileNotFoundError = new Error('File not found') as Error & { code: string }
  fileNotFoundError.code = 'ENOENT'
  const mockReadTextFile = jest.fn().mockRejectedValue(fileNotFoundError);
  (mockReadTextFile as unknown as typeof readTextFile).notFoundAsUndefined = (
    jest.fn().mockResolvedValue(undefined)
  )
  return {
    ...actual,
    readTextFile: mockReadTextFile,
  }
})

describe('custom fields filter', () => {
  const mockFiles: Record<string, string> = {
    'pkg/app/type/obj/fields/MyField__c.field-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
    <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
        <fullName>MyField__c</fullName>
        <defaultValue>false</defaultValue>
        <description>desc</description>
        <label>Check</label>
        <type>Checkbox</type>
    </CustomField>
    `,
    'pkg/app/type/other_obj/fields/OtherField__c.field-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
    <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
        <fullName>OtherField__c</fullName>
        <defaultValue>false</defaultValue>
        <label>Check</label>
        <type>Checkbox</type>
    </CustomField>
    `,
    'pkg/app/type/not_a_field.obj-meta.xml': '',
  }


  let filter: ReturnType<typeof customFieldsFilter>
  beforeEach(() => {
    // eslint-disable-next-line max-len
    const readTextFileMock = readTextFile.notFoundAsUndefined as jest.MockedFunction<typeof readTextFile.notFoundAsUndefined>
    readTextFileMock.mockImplementation(async filename => mockFiles[filename])
    filter = customFieldsFilter({
      config: defaultFilterContext,
      files: {
        baseDirName: '',
        sourceFileNames: Object.keys(mockFiles).concat('pkg/app/type/obj/fields/NoSuchFile__c.field-meta.xml'),
        staticFileNames: [],
      },
    })
  })
  describe('when called with custom object instances', () => {
    let elements: InstanceElement[]
    beforeEach(async () => {
      elements = [createInstanceElement({ fullName: 'obj' }, mockTypes.CustomObject)]
      await filter.onFetch?.(elements)
    })
    it('should add fields to the custom object that exists', () => {
      expect(elements[0].value.fields).toBeDefined()
      expect(elements[0].value.fields).toContainEqual(expect.objectContaining({ fullName: 'MyField__c' }))
    })
    it('should not add fields from other objects', () => {
      expect(elements[0].value.fields).toBeDefined()
      expect(elements[0].value.fields).not.toContainEqual(expect.objectContaining({ fullName: 'OtherField__c' }))
    })
  })
})
