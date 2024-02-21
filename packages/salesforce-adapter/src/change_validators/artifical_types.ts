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
import {
  ChangeError,
  ChangeValidator,
  Element,
  getChangeData,
} from '@salto-io/adapter-api'
import { CURRENCY_CODE_TYPE_NAME } from '../constants'

const createCurrencyIsoCodeError = (element: Element): ChangeError => ({
  elemID: element.elemID,
  message: "The list of currency codes can't be changed via Salto.",
  detailedMessage:
    'To add or remove currency codes, follow the instructions at https://help.salesforce.com/s/articleView?id=sf.admin_currency.htm',
  severity: 'Error',
})

const changeValidator: ChangeValidator = async (changes) =>
  changes
    .map(getChangeData)
    .filter((element) => element.elemID.typeName === CURRENCY_CODE_TYPE_NAME)
    .map(createCurrencyIsoCodeError)

export default changeValidator
