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

type Error403 = {
  errors: { title: string; detail: string }[]
}

type Error422 = {
  description: string
  details: Record<string, { description: string }[]>
}

type Error400 = {
  error: {
    title: string
    message: string
  }
}

const is403Error = (error: Record<string, unknown>): error is Error403 =>
  (_.isArray(error.errors)
    && (error.errors[0].title !== undefined)
    && (error.errors[0].detail !== undefined))

const is422Error = (error: Record<string, unknown>): error is Error422 =>
  ((error.description !== undefined)
    && (_.isPlainObject(error.details))
    && (_.isObject(error.details))
    && Object.values(error.details).every(val => _.isArray(val) && (val[0].description !== undefined)))

const is400Error = (error: Record<string, unknown>): error is Error400 =>
  (_.isPlainObject(error.error)
    && (_.isObject(error.error))
    && (error.error !== undefined)
    && ('title' in error.error)
    && ('message' in error.error))

const error403ToString = (error: Error403): string => {
  const errorArray = ['\nError details:']
  error.errors.forEach(err => {
    errorArray.push(`* Title: ${err.title}\n  Detail: ${err.detail}\n`)
  })
  return errorArray.join(EOL)
}

const error422ToString = (error: Error422): string => {
  const errorArray = []
  errorArray.push(`\n${error.description}\n\nError details:`)
  Object.keys(error.details).forEach(key => {
    error.details[key].forEach(val => {
      errorArray.push(`* ${val.description}`)
    })
  })
  return errorArray.join(EOL)
}
const error400ToString = (error: Error400): string => {
  const errorArray = ['\nError details:']
  errorArray.push(`* Title: ${error.error.title}\n  Detail: ${error.error.message}\n`)
  return errorArray.join(EOL)
}

export const getZendeskError = (fullName: string, error: Error): Error => {
  if (!(error instanceof clientUtils.HTTPError)) {
    return error
  }
  const baseErrorMessage = `Deployment of ${fullName} failed.`
  const errorData = error.response.data
  if (!_.isPlainObject(errorData)) {
    return new Error(`${baseErrorMessage} ${error}`)
  }
  log.error([baseErrorMessage, safeJsonStringify(error.response.data, undefined, 2)].join(EOL))
  if (is403Error(errorData)) {
    return new Error([baseErrorMessage, error403ToString(errorData)].join(EOL))
  }
  if (is422Error(errorData)) {
    return new Error([baseErrorMessage, error422ToString(errorData)].join(EOL))
  }
  if (is400Error(errorData)) {
    return new Error([baseErrorMessage, error400ToString(errorData)].join(EOL))
  }
  const errorMessage = [`${error}`, safeJsonStringify(error.response.data, undefined, 2)].join(EOL)
  return new Error([baseErrorMessage, errorMessage].join(EOL))
}
