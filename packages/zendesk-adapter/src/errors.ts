/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { EOL } from 'os'
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'

const log = logger(module)

type error1 = {
  errors: { title: string; detail: string }[]
}

// type error2 = {
//   description: string
//   details: Record<string, { description: string }>
// }
//
// type error3 = {
//   error: {
//     title: string
//     message: string
//   }
// }

const error1ToString = (error: error1): string => {
  const errorArray = ['\nError details:']
  let errorNum = 1
  error.errors.forEach(err => {
    errorArray.push(`${errorNum}. title: ${err.title}\n detail: ${err.detail}\n`)
    errorNum += 1
  })
  return errorArray.join(EOL)
}

export const getZendeskError = (fullName: string, error: Error): Error => {
  if (!(error instanceof clientUtils.HTTPError)) {
    return error
  }
  const baseErrorMessage = `Deployment of ${fullName} failed.`
  const errorData = error.response.data
  let errorMessage: string
  if (!_.isPlainObject(errorData)) {
    return new Error(baseErrorMessage)
  }
  log.error([baseErrorMessage, safeJsonStringify(error.response.data, undefined, 2)].join(EOL))
  if (_.isArray(errorData.errors)
    && (errorData.errors[0].title !== undefined)
    && errorData.errors[0].detail !== undefined) {
    errorMessage = error1ToString(errorData as error1)
  } else {
    errorMessage = safeJsonStringify(error.response.data, undefined, 2)
  }
  // errorMessage = (!_.isPlainObject(error.response.data))
  //   ? baseErrorMessage
  //   : [baseErrorMessage, safeJsonStringify(error.response.data, undefined, 2)].join(EOL)
  // log.error(errorMessage)
  return new Error([baseErrorMessage, errorMessage, `Status Code: ${error.response.status}`].join(EOL))
}
