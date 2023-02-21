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

import { invertNaclCase } from '@salto-io/adapter-utils'

const JIRA = 'jira'
const ZUORA = 'zuora_billing'
const NETSUITE = 'netsuite'
const SALESFORCE = 'salesforce'


const allCapsRegex = /^[A-Z]+$/
const camelCaseRegex = /[a-z][A-Z]/g
const allCapsCamelCaseRegex = /[A-Z]([A-Z][a-z])/g

const cleanCustomSuffix = (str: string): string => str.replace('__c', '')

const prettifyWord = (str: string): string[] => {
  if (allCapsRegex.test(str)) {
    return [str]
  }
  let result = str
  if (camelCaseRegex.test(str)) {
    result = str.replace(camelCaseRegex, ([lower, upper]) => [lower, upper].join(' '))
  }
  if (allCapsCamelCaseRegex.test(result)) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    result = result.replace(allCapsCamelCaseRegex, (match, subMatch) => `${match[0]} ${subMatch}`)
  }

  return result.split(' ')
}


const recapitalize = (str: string): string => str.slice(0, 1).toUpperCase() + str.slice(1)


// todo check what happens with fields (if they have @ in the types)
export const prettifyName = (name: string, adapter: string): string => {
  let cleanNaclCase = invertNaclCase(name)

  if ([ZUORA, JIRA].includes(adapter)) {
    cleanNaclCase = cleanCustomSuffix(cleanNaclCase)
  }

  if (cleanNaclCase.includes(' ')) {
    return cleanNaclCase
  }
  if ([NETSUITE].includes(adapter)) {
    return cleanNaclCase
  }
  if (SALESFORCE === adapter && name.includes('__')) {
    return cleanNaclCase
  }

  const words = cleanNaclCase.split('_').flatMap(prettifyWord).map(recapitalize)
  return words.join(' ')
}
