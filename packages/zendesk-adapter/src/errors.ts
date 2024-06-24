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
import _ from 'lodash'
import { EOL } from 'os'
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  createSaltoElementError,
  createSaltoElementErrorFromError,
  ElemID,
  SaltoElementError,
} from '@salto-io/adapter-api'

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
  _.isArray(error.errors) && error.errors.every(val => 'title' in val && 'detail' in val)

const is422Error = (error: Record<string, unknown>): error is Error422 =>
  error.description !== undefined &&
  _.isObject(error.details) &&
  Object.values(error.details).every(val => _.isArray(val) && val[0].description !== undefined)

const is400Error = (error: Record<string, unknown>): error is Error400 =>
  _.isObject(error.error) && error.error !== undefined && 'title' in error.error && 'message' in error.error

const error403ToString = (error: Error403): string[] => {
  const errorArray = ['', 'Error details:']
  const errorStrings = error.errors.flatMap(err => [`* Title: ${err.title}`, `  Detail: ${err.detail}`, ''])
  return [...errorArray, ...errorStrings]
}

const error422ToString = (error: Error422): string[] => {
  const errorArray = ['', `${error.description}`, '', 'Error details:']
  const errorStrings = Object.values(error.details).flatMap(value => value.map(val => `* ${val.description}`))
  return [...errorArray, ...errorStrings]
}

const error400ToString = (error: Error400): string[] => [
  '',
  'Error details:',
  `* Title: ${error.error.title}`,
  `  Detail: ${error.error.message}`,
  '',
]

const generateErrorMessage = (errorData: Record<string, unknown>): string[] => {
  if (is403Error(errorData)) {
    return error403ToString(errorData)
  }
  if (is422Error(errorData)) {
    return error422ToString(errorData)
  }
  if (is400Error(errorData)) {
    return error400ToString(errorData)
  }
  return []
}

export const getZendeskError = (elemID: ElemID, error: Error): SaltoElementError => {
  if (!(error instanceof clientUtils.HTTPError)) {
    return createSaltoElementErrorFromError({
      error,
      severity: 'Error',
      elemID,
    })
  }
  const logBaseErrorMessage = `Deployment of ${elemID.getFullName()} failed:`
  const errorData = error.response.data
  if (!_.isPlainObject(errorData)) {
    return createSaltoElementError({
      message: `${error}`,
      severity: 'Error',
      elemID,
    })
  }
  log.error([logBaseErrorMessage, safeJsonStringify(error.response.data, undefined, 2)].join(' '))
  const errorGenerated = generateErrorMessage(errorData)
  if (!_.isEmpty(errorGenerated)) {
    return createSaltoElementError({
      message: [...errorGenerated].join(EOL),
      severity: 'Error',
      elemID,
    })
  }
  const errorMessage = [`${error}`, safeJsonStringify(error.response.data, undefined, 2)].join(EOL)
  return createSaltoElementError({
    message: errorMessage,
    severity: 'Error',
    elemID,
  })
}
