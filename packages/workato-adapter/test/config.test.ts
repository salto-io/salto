/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { API_DEFINITIONS_CONFIG, ENABLE_DEPLOY_SUPPORT_FLAG, getDefaultConfig } from '../src/config'

describe('config', () => {
  describe('getDefaultConfig', () => {
    describe('without deploy support', () => {
      it('should include extended_schema in fieldToOmit', () => {
        const config = getDefaultConfig(false)
        expect(config[ENABLE_DEPLOY_SUPPORT_FLAG]).toBe(false)
        expect(config[API_DEFINITIONS_CONFIG].typeDefaults.transformation?.fieldsToOmit).toBeDefined()
        expect(config[API_DEFINITIONS_CONFIG].typeDefaults.transformation?.fieldsToOmit).toContainEqual({
          fieldName: 'extended_input_schema',
        })
        expect(config[API_DEFINITIONS_CONFIG].typeDefaults.transformation?.fieldsToOmit).toContainEqual({
          fieldName: 'extended_output_schema',
        })
      })
    })
    describe('with deploy support', () => {
      it('should add flag and not include extended_schemas in fieldToOmit', () => {
        const config = getDefaultConfig(true)
        expect(config[ENABLE_DEPLOY_SUPPORT_FLAG]).toBe(true)
        expect(config[API_DEFINITIONS_CONFIG].typeDefaults.transformation?.fieldsToOmit).toBeDefined()
        expect(config[API_DEFINITIONS_CONFIG].typeDefaults.transformation?.fieldsToOmit).not.toContainEqual({
          fieldName: 'extended_input_schema',
        })
        expect(config[API_DEFINITIONS_CONFIG].typeDefaults.transformation?.fieldsToOmit).not.toContainEqual({
          fieldName: 'extended_output_schema',
        })
      })
    })
  })
})
