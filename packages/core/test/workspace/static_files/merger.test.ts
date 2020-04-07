/*
*                      Copyright 2020 Salto Labs Ltd.
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
  ObjectType, PrimitiveType, PrimitiveTypes,
  ElemID, InstanceElement, BuiltinTypes,
} from '@salto-io/adapter-api'

import { StaticFilesSource } from '../../../src/workspace/static_files/source'
import { StaticFileMetaData, StaticFileNaclValue } from '../../../src/workspace/static_files/common'
import { updateStaticFilesValuesForElements } from '../../../src/workspace/static_files/merger'

export const mockStaticFileSource = (): StaticFilesSource => ({
  getMetaData: jest.fn(),
  getStaticFile: jest.fn(),
  flush: jest.fn(),
  clone: jest.fn(),
})

const exampleStaticFile = new StaticFileNaclValue('none')

const elementWithNoFile = new PrimitiveType({
  elemID: new ElemID('salesforce', 'field'),
  primitive: PrimitiveTypes.NUMBER,
  annotationTypes: {
    jerry: BuiltinTypes.STRING,
  },
})

const elementWithFile = new PrimitiveType({
  elemID: new ElemID('salesforce', 'field'),
  primitive: PrimitiveTypes.NUMBER,
  annotationTypes: {
    jerry: BuiltinTypes.STRING,
  },
  annotations: {
    jerry: exampleStaticFile,
  },
})

const model = new ObjectType({
  elemID: new ElemID('salesforce', 'test'),
  annotationTypes: {
    ServiceId: BuiltinTypes.SERVICE_ID,
  },
})

const instanceElemWithFileValue = new InstanceElement(
  'instush',
  model,
  {
    jerry: exampleStaticFile,
  }
)

const instanceElemWithArrayWithFileValue = new InstanceElement(
  'instush',
  model,
  [
    {
      jerry: exampleStaticFile,
    },
    2,
  ]
)

const instanceElemWithDeepFileValue = new InstanceElement(
  'instush',
  model,
  {
    tom: {
      jerry: exampleStaticFile,
    },
  }
)

const instanceElemWithDeepExtremelyFileValues = new InstanceElement(
  'instush',
  model,
  {
    tom: {
      jerry: exampleStaticFile,
    },
    another: [
      1,
      2,
      {
        moshe: exampleStaticFile,
      },
    ],
  }
)

const instanceElemWithFileAnnotation = new InstanceElement(
  'instush',
  model,
  {
    something: 123,
  },
  undefined,
  {
    jerry: exampleStaticFile,
  },
)

const instanceElemWithoutFile = new InstanceElement(
  'instush',
  model,
  {
    something: 123,
  },
  undefined,
  {
    another: 'aaa',
  },
)

const exampleResult = new StaticFileMetaData(
  exampleStaticFile.filepath,
  'ZOMG',
)

describe('Static Files Element Merger', () => {
  let mockedStaticFileSource: StaticFilesSource
  beforeEach(() => {
    mockedStaticFileSource = mockStaticFileSource()
    mockedStaticFileSource.getMetaData = jest.fn().mockResolvedValue(exampleResult)
  })

  it('should not fail on empty elements', () =>
    expect(updateStaticFilesValuesForElements(mockedStaticFileSource, [])).resolves.toEqual([]))

  describe('Non instance elements annotations', () => {
    it('should not change any elements if there are no static files', async () => {
      await updateStaticFilesValuesForElements(mockedStaticFileSource, [elementWithNoFile])
      expect(mockedStaticFileSource.getMetaData).toHaveBeenCalledTimes(0)
    })
    it('should alter static files', async () => {
      const result = await updateStaticFilesValuesForElements(
        mockedStaticFileSource, [elementWithFile]
      )
      expect(mockedStaticFileSource.getMetaData).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect(result[0].annotations).toHaveProperty('jerry', exampleResult)
    })
  })
  describe('Instance Elements', () => {
    it('should not change any elements if there are no static files', async () => {
      await updateStaticFilesValuesForElements(mockedStaticFileSource, [instanceElemWithoutFile])
      expect(mockedStaticFileSource.getMetaData).toHaveBeenCalledTimes(0)
    })
    it('should alter static files on annotations', async () => {
      const result = await updateStaticFilesValuesForElements(
        mockedStaticFileSource, [instanceElemWithFileAnnotation]
      )
      expect(mockedStaticFileSource.getMetaData).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect(result[0].annotations).toHaveProperty('jerry', exampleResult)
    })
    it('should alter static files on values', async () => {
      const result = await updateStaticFilesValuesForElements(
        mockedStaticFileSource, [instanceElemWithFileValue]
      )
      expect(mockedStaticFileSource.getMetaData).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect((result[0] as InstanceElement).value).toHaveProperty('jerry', exampleResult)
    })
    it('should alter static files on deep values', async () => {
      const result = await updateStaticFilesValuesForElements(
        mockedStaticFileSource, [instanceElemWithDeepFileValue]
      )
      expect(mockedStaticFileSource.getMetaData).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect((result[0] as InstanceElement).value).toHaveProperty('tom', {
        jerry: exampleResult,
      })
    })
    it('should alter static files on extremely deep values', async () => {
      const result = await updateStaticFilesValuesForElements(
        mockedStaticFileSource, [instanceElemWithDeepExtremelyFileValues]
      )
      expect(mockedStaticFileSource.getMetaData).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(1)
      const resultValues = (result[0] as InstanceElement).value
      expect(resultValues).toHaveProperty('tom', {
        jerry: exampleResult,
      })
      expect(resultValues).toHaveProperty('another')
      expect(resultValues.another[2].moshe)
        .toBeInstanceOf(StaticFileMetaData)
    })
    it('should alter static files at array values', async () => {
      const result = await updateStaticFilesValuesForElements(
        mockedStaticFileSource, [instanceElemWithArrayWithFileValue]
      )
      expect(mockedStaticFileSource.getMetaData).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      const resultValues = (result[0] as InstanceElement).value
      expect(resultValues[0])
        .toHaveProperty('jerry', exampleResult)
    })
  })
})
