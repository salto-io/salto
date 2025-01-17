/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, isStaticFile, ObjectType, StaticFile } from '@salto-io/adapter-api'
import filterCreator, { CONTENT_TYPE } from '../../src/filters/static_resource_file_ext'
import {
  INSTANCE_FULL_NAME_FIELD,
  METADATA_CONTENT_FIELD,
  SALESFORCE,
  STATIC_RESOURCE_METADATA_TYPE,
} from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('Static Resource File Extension Filter', () => {
  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>
  const baseStaticResourceInstance = new InstanceElement(
    'testStaticResourceInstance',
    new ObjectType({
      elemID: new ElemID(SALESFORCE, STATIC_RESOURCE_METADATA_TYPE),
    }),
    {
      [INSTANCE_FULL_NAME_FIELD]: 'testStaticResourceInstance',
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
    staticResourceInstance.value[METADATA_CONTENT_FIELD] = new StaticFile({
      filepath,
      content,
    })

    await filter.onFetch([staticResourceInstance])

    const updatedContent = staticResourceInstance.value[METADATA_CONTENT_FIELD]
    expect(isStaticFile(updatedContent)).toEqual(true)
    expect(await (updatedContent as StaticFile).getContent()).toEqual(content)
    expect((updatedContent as StaticFile).filepath).toEqual('salesforce/staticresources/filename.png')
  })

  it('should do nothing if contentType is not a string', async () => {
    staticResourceInstance.value[CONTENT_TYPE] = undefined
    staticResourceInstance.value[METADATA_CONTENT_FIELD] = new StaticFile({
      filepath,
      content,
    })

    await filter.onFetch([staticResourceInstance])

    const updatedContent = staticResourceInstance.value[METADATA_CONTENT_FIELD]
    expect(isStaticFile(updatedContent)).toEqual(true)
    expect(await (updatedContent as StaticFile).getContent()).toEqual(content)
    expect((updatedContent as StaticFile).filepath).toEqual(filepath)
  })

  it('should do nothing if contentType has unrecognized extension', async () => {
    staticResourceInstance.value[CONTENT_TYPE] = 'dummy content type'
    staticResourceInstance.value[METADATA_CONTENT_FIELD] = new StaticFile({
      filepath,
      content,
    })

    await filter.onFetch([staticResourceInstance])

    const updatedContent = staticResourceInstance.value[METADATA_CONTENT_FIELD]
    expect(isStaticFile(updatedContent)).toEqual(true)
    expect(await (updatedContent as StaticFile).getContent()).toEqual(content)
    expect((updatedContent as StaticFile).filepath).toEqual(filepath)
  })

  it('should do nothing if static file content is undefined', async () => {
    staticResourceInstance.value[CONTENT_TYPE] = 'image/png'
    staticResourceInstance.value[METADATA_CONTENT_FIELD] = content

    await filter.onFetch([staticResourceInstance])

    const updatedContent = staticResourceInstance.value[METADATA_CONTENT_FIELD]
    expect(updatedContent).toEqual(content)
  })
})
