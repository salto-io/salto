/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import JSZip from 'jszip'
import { InstanceElement, StaticFile } from '@salto-io/adapter-api'
import filterCreator, { StaticResourceInstance } from '../../src/filters/static_resource_zip_timestamps'
import { METADATA_CONTENT_FIELD } from '../../src/constants'
import { defaultFilterContext } from '../utils'
import mockClient from '../client'
import { FilterWith } from './mocks'
import { mockTypes } from '../mock_elements'

describe('Static Resource File Extension Filter', () => {
  let filter: FilterWith<'onFetch'>

  const createZipStaticResource = async (date: Date): Promise<StaticResourceInstance> => {
    const zip = new JSZip()
    zip.file('file1.txt', 'content 1', { date })
    zip.file('file2.txt', 'content 2', { date })
    zip.file('folder/nested.txt', 'nested content', { date })

    return new InstanceElement('mockStaticResource', mockTypes.StaticResource, {
      contentType: 'application/zip',
      [METADATA_CONTENT_FIELD]: new StaticFile({
        filepath: 'zip.zip',
        content: await zip.generateAsync({ type: 'nodebuffer' }),
      }),
    }) as StaticResourceInstance
  }

  describe('when running on zip static resources with different dates', () => {
    let instance1: StaticResourceInstance
    let instance2: StaticResourceInstance

    beforeEach(async () => {
      filter = filterCreator({
        config: defaultFilterContext,
      }) as FilterWith<'onFetch'>

      instance1 = await createZipStaticResource(new Date('2020-01-01T00:00:00.000'))
      instance2 = await createZipStaticResource(new Date())
      await filter.onFetch([instance1, instance2])
    })

    it('should return identical static resources', () => {
      expect(instance1.value[METADATA_CONTENT_FIELD].hash).toEqual(instance2.value[METADATA_CONTENT_FIELD].hash)
    })
  })

  describe('when a client is passed', () => {
    let instance: StaticResourceInstance
    let hashBefore: string

    beforeEach(async () => {
      filter = filterCreator({
        client: mockClient().client,
        config: defaultFilterContext,
      }) as FilterWith<'onFetch'>

      instance = await createZipStaticResource(new Date('2020-01-01T00:00:00.000'))
      hashBefore = instance.value[METADATA_CONTENT_FIELD].hash
      await filter.onFetch([instance])
    })

    it('should not change the static file', () => {
      expect(instance.value[METADATA_CONTENT_FIELD].hash).toEqual(hashBefore)
    })
  })
})
