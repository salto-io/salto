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
import Joi from 'joi'
import { InstanceElement } from '@salto-io/adapter-api'

export const createEmptyFieldErrorMessage = (fullName: string, fieldName: string): string =>
  `Can not change ${fullName}' ${fieldName} to be empty`

// Validates that the order field exists in the element's value
export const validateOrderType = (orderInstance: InstanceElement, orderField: string): boolean => {
  const orderType = Joi.object({ value: Joi.object({ [orderField]: Joi.required() }).required() }).unknown(true)
  return orderType.validate(orderInstance).error === undefined
}
