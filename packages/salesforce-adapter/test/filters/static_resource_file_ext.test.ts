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
  InstanceElement, isStaticFile, ObjectType, StaticFile,
} from '@salto-io/adapter-api'
import filterCreator, {
  CONTENT, CONTENT_TYPE,
  STATIC_RESOURCE_METADATA_TYPE_ID,
} from '../../src/filters/static_resource_file_ext'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'

describe('Static Resource File Extension Filter', () => {
  const filter = filterCreator() as FilterWith<'onFetch'>
  const baseStaticResourceInstance = new InstanceElement(
    'testStaticResourceInstance',
    new ObjectType({
      elemID: STATIC_RESOURCE_METADATA_TYPE_ID,
    }),
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'testStaticResourceInstance',
    },
  )
  const filepath = 'salesforce/staticresources/filename.resource'
  const content = Buffer.from('file content')

  let staticResourceInstance: InstanceElement
  beforeEach(() => {
    staticResourceInstance = baseStaticResourceInstance.clone()
  })

  it('should replace the file extension', async () => {
    staticResourceInstance.value[CONTENT_TYPE] = 'image/png'
    staticResourceInstance.value[CONTENT] = new StaticFile({ filepath, content })

    await filter.onFetch([staticResourceInstance])

    const updatedContent = staticResourceInstance.value[CONTENT]
    expect(isStaticFile(updatedContent)).toEqual(true)
    expect((updatedContent as StaticFile).content).toEqual(content)
    expect((updatedContent as StaticFile).filepath)
      .toEqual('salesforce/staticresources/filename.png')
  })

  it('should do nothing if contentType is not a string', async () => {
    staticResourceInstance.value[CONTENT_TYPE] = undefined
    staticResourceInstance.value[CONTENT] = new StaticFile({ filepath, content })

    await filter.onFetch([staticResourceInstance])

    const updatedContent = staticResourceInstance.value[CONTENT]
    expect(isStaticFile(updatedContent)).toEqual(true)
    expect((updatedContent as StaticFile).content).toEqual(content)
    expect((updatedContent as StaticFile).filepath).toEqual(filepath)
  })

  it('should do nothing if contentType has unrecognized extension', async () => {
    staticResourceInstance.value[CONTENT_TYPE] = 'dummy content type'
    staticResourceInstance.value[CONTENT] = new StaticFile({ filepath, content })

    await filter.onFetch([staticResourceInstance])

    const updatedContent = staticResourceInstance.value[CONTENT]
    expect(isStaticFile(updatedContent)).toEqual(true)
    expect((updatedContent as StaticFile).content).toEqual(content)
    expect((updatedContent as StaticFile).filepath).toEqual(filepath)
  })

  it('should do nothing if static file content is undefined', async () => {
    staticResourceInstance.value[CONTENT_TYPE] = 'image/png'
    staticResourceInstance.value[CONTENT] = content

    await filter.onFetch([staticResourceInstance])

    const updatedContent = staticResourceInstance.value[CONTENT]
    expect(updatedContent).toEqual(content)
  })
})
