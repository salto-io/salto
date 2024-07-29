/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { FatalError } from '@salto-io/dag'
import { definitions, client as clientUtils } from '../..'

export class AbortFetchOnFailure extends FatalError {
  constructor({ adapterName, typeName, message }: { adapterName: string; typeName: string; message: string }) {
    super(`Aborting fetch due to error in ${adapterName}:${typeName}: ${message}`)
  }
}

export const getInsufficientPermissionsError: definitions.fetch.FetchResourceDefinition['onError'] = {
  custom:
    () =>
    ({ error, typeName }) => {
      if (error instanceof clientUtils.HTTPError && error.response.status === 403) {
        return {
          action: 'customSaltoError',
          value: {
            message: `Salto could not access the ${typeName} resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource`,
            severity: 'Info',
          },
        }
      }
      return { action: 'failEntireFetch', value: false }
    },
  // TODO SALTO-6004 remove
  // this is a workaround to overcome types checker, the "custom" function is applied any other values are ignored
  action: 'failEntireFetch',
  value: false,
}
