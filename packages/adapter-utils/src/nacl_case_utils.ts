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
import invert from 'lodash/invert'

const NACL_ESCAPING_SUFFIX_SEPARATOR = '@'
const NACL_CUSTOM_MAPPING_PREFIX = '_'
// Windows has the lowest known limit, of 255
// This can have an effect at a time we add a ~15 chars suffix
// So we are taking an extra buffer and limit it to 200
const MAX_PATH_LENGTH = 200

export const pathNaclCase = (name?: string): string =>
  (name ? name.split(NACL_ESCAPING_SUFFIX_SEPARATOR)[0] : '').slice(0, MAX_PATH_LENGTH)

/* eslint-disable quote-props */
// Current values in this mapping should not be changed
// Values in the map should be unique
// Adding more values should be with a leading z as an indication the value has more than one letter
// The code in this file assumes that the replacements are of maximum length of 2
const defaultNaclCaseMapping: Record<string, string> = {
  '?': 'a',
  '-': 'b',
  '\\': 'c',
  '/': 'd',
  '&': 'e',
  ':': 'f',
  '|': 'g',
  '[': 'h',
  ']': 'i',
  '(': 'j',
  ')': 'k',
  '!': 'l',
  '@': 'm',
  '#': 'n',
  '*': 'o',
  '%': 'p',
  ';': 'q',
  '"': 'r',
  ' ': 's',
  '\'': 't',
  '_': 'u',
  '.': 'v',
  '^': 'w',
  '<': 'x',
  '>': 'y',
  '`': 'za',
  '~': 'zb',
  '$': 'zc',
  ',': 'zd',
  '+': 'ze',
}

const invertedDefaultNaclCaseMapping = invert(defaultNaclCaseMapping)

const suffixFromList = (specialCharsMappingList: string[]): string => {
  if (specialCharsMappingList.length === 0
      // If all the special chars are _ then the suffix is empty
      || specialCharsMappingList
        .every(mappedSpecialChar => mappedSpecialChar === defaultNaclCaseMapping._)) {
    return ''
  }
  if (specialCharsMappingList
    .every(mappedSpecialChar => mappedSpecialChar === specialCharsMappingList[0])) {
    return `${NACL_ESCAPING_SUFFIX_SEPARATOR}${specialCharsMappingList[0]}`
  }
  return `${NACL_ESCAPING_SUFFIX_SEPARATOR}${specialCharsMappingList.join('')}`
}

const listFromSuffix = (suffix: string, startIdx = 0): string[] => {
  if (suffix.length === 0 || startIdx >= suffix.length) {
    return []
  }
  if (suffix[startIdx] === NACL_CUSTOM_MAPPING_PREFIX) {
    return [
      String.fromCharCode(
        Number(suffix.slice(startIdx + 1, startIdx + 6))
      ),
      ...listFromSuffix(suffix, startIdx + 6),
    ]
  }
  if (suffix[startIdx] === 'z') {
    return [
      invertedDefaultNaclCaseMapping[suffix.slice(startIdx, startIdx + 2)],
      ...listFromSuffix(suffix, startIdx + 2),
    ]
  }
  return [
    invertedDefaultNaclCaseMapping[suffix.slice(startIdx, startIdx + 1)],
    ...listFromSuffix(suffix, startIdx + 1),
  ]
}


export const naclCase = (name?: string): string => {
  // replace all special chars with _
  // then add a special chars mapping after the separator for uniqueness
  if (name === undefined) {
    return ''
  }
  if (/^\d+$/.test(name)) {
    // use suffix to avoid having a digit-only identifier
    return `${name}${NACL_ESCAPING_SUFFIX_SEPARATOR}`
  }
  const specialCharsMappingList: string[] = []
  const replaceChar = (char: string): string => {
    specialCharsMappingList.push(
      defaultNaclCaseMapping[char] ?? `${NACL_CUSTOM_MAPPING_PREFIX}${char.charCodeAt(0).toString().padStart(5, '0')}`
    )
    return '_'
  }
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, replaceChar)
  return `${cleanName}${suffixFromList(specialCharsMappingList)}`
}

export const invertNaclCase = (name: string): string => {
  if (name === '') {
    return ''
  }
  const [prefix, suffix] = name.split(NACL_ESCAPING_SUFFIX_SEPARATOR)
  if (!suffix) {
    return prefix
  }
  const specialCharsMappingList = listFromSuffix(suffix)
  return prefix.replace(/_/g, () =>
    (specialCharsMappingList.length === 1
      ? specialCharsMappingList[0]
      : specialCharsMappingList.shift() ?? ''))
}
