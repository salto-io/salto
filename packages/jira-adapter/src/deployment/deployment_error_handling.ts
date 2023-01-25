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
import { ElemID } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { decorators } from '@salto-io/lowerdash'


export const handleDeploymentError = (err: Error, id?: ElemID): Error => {
  if (id !== undefined) {
    err.message = `Deployment of ${id.getFullName()} failed: ${err}`
  }
  if (err instanceof clientUtils.HTTPError && _.isPlainObject(err.response.data)) {
    const errorMessages = [
      ...(Array.isArray(err.response.data.errorMessages)
        ? err.response.data.errorMessages
        : []),
      ...(_.isPlainObject(err.response.data.errors)
        ? [safeJsonStringify(err.response.data.errors)]
        : []),
    ]
    if (errorMessages.length > 0) {
      err.message = `${err.message}. ${errorMessages.join(', ')}`
    }
  }
  return err
}

export const handleDeploymentErrors = (): decorators.InstanceMethodDecorator => (
  decorators.wrapMethodWith(
    async (
      originalMethod: decorators.OriginalCall,
    ): Promise<unknown> => {
      try {
        return originalMethod.call()
      } catch (err) {
        if (err instanceof Error) {
          throw handleDeploymentError(err)
        }
        throw err
      }
    }
  )
)
