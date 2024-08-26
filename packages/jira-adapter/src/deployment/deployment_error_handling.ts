/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { decorators } from '@salto-io/lowerdash'

export const handleDeploymentError = (err: Error): Error => {
  if (err instanceof clientUtils.HTTPError && _.isPlainObject(err.response.data)) {
    const errorMessages = [
      ...(Array.isArray(err.response.data.errorMessages) ? err.response.data.errorMessages : []),
      ...(_.isPlainObject(err.response.data.errors) && !_.isEmpty(err.response.data.errors)
        ? [safeJsonStringify(err.response.data.errors)]
        : []),
    ]
    if (errorMessages.length > 0) {
      err.message = `${err.message}. ${errorMessages.join(', ')}`
    }
  }
  return err
}

export const handleDeploymentErrors = (): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(async (originalMethod: decorators.OriginalCall): Promise<unknown> => {
    try {
      const result = await originalMethod.call()
      return result
    } catch (err) {
      if (err instanceof Error) {
        throw handleDeploymentError(err)
      }
      throw err
    }
  })
