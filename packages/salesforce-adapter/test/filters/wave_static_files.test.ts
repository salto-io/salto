/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, StaticFile } from '@salto-io/adapter-api'
import filterCreator, { WAVE_TYPES_WITH_STATIC_FILES } from '../../src/filters/wave_static_files'
import { INSTANCE_FULL_NAME_FIELD, RECORDS_PATH, SALESFORCE } from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('waveStaticFilesFilter', () => {
  let filter: FilterWith<'onFetch'>
  beforeEach(() => {
    filter = filterCreator({
      config: defaultFilterContext,
    }) as FilterWith<'onFetch'>
  })
  describe('onFetch', () => {
    const content = 'eyJuYW1lIjoiSm9obiIsImFnZSI6MzB9'
    beforeEach(() => {
      filter = filterCreator({
        config: defaultFilterContext,
      }) as FilterWith<'onFetch'>
    })
    it.each(WAVE_TYPES_WITH_STATIC_FILES)('should convert %s instance content to static file', async typeName => {
      const instance = new InstanceElement(
        'TestInstance',
        new ObjectType({
          elemID: new ElemID(SALESFORCE, typeName),
          annotations: {
            metadataType: typeName,
          },
        }),
        {
          [INSTANCE_FULL_NAME_FIELD]: 'TestInstance',
          content,
        },
      )
      await filter.onFetch([instance])
      expect(instance.value.content).toEqual(
        new StaticFile({
          filepath: `${SALESFORCE}/${RECORDS_PATH}/${typeName}/TestInstance`,
          content: Buffer.from(content, 'base64'),
        }),
      )
    })
  })
})
