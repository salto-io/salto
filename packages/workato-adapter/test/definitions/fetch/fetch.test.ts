/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { createFetchDefinitions } from '../../../src/definitions/fetch'
import { DEFAULT_CONFIG } from '../../../src/user_config'

describe('createFetchDefinitions', () => {
  it('should not omit extended schema fields when enableDeploySupport is true', () => {
    const configWithDeployEnabled = { ...DEFAULT_CONFIG, enableDeploySupport: true }
    const fetchDefinitions = createFetchDefinitions(configWithDeployEnabled)
    const defaultCustomizations = fetchDefinitions.instances.default?.element?.fieldCustomizations as Record<
      string,
      unknown
    >
    expect(Object.keys(defaultCustomizations)).not.toContain('extended_input_schema')
    expect(Object.keys(defaultCustomizations)).not.toContain('extended_output_schema')
  })
  it('should omit extended schema fields when enableDeploySupport is false', () => {
    const configWithDeployDisabled = { ...DEFAULT_CONFIG, enableDeploySupport: false }
    const fetchDefinitions = createFetchDefinitions(configWithDeployDisabled)
    const defaultCustomizations = fetchDefinitions.instances.default?.element?.fieldCustomizations as Record<
      string,
      unknown
    >
    expect(Object.keys(defaultCustomizations)).toContain('extended_input_schema')
    expect(Object.keys(defaultCustomizations)).toContain('extended_output_schema')
  })
  it('should omit extended schema fields when enableDeploySupport is undefined', () => {
    const configWithUndefinedDeploy = { ...DEFAULT_CONFIG, enableDeploySupport: undefined }
    const fetchDefinitions = createFetchDefinitions(configWithUndefinedDeploy)
    const defaultCustomizations = fetchDefinitions.instances.default?.element?.fieldCustomizations as Record<
      string,
      unknown
    >
    expect(Object.keys(defaultCustomizations)).toContain('extended_input_schema')
    expect(Object.keys(defaultCustomizations)).toContain('extended_output_schema')
  })
})
