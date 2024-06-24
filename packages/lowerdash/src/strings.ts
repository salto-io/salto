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

export const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'

export const insecureRandomString = ({
  length = 10,
  alphabet = DEFAULT_ALPHABET,
}: {
  length?: number
  alphabet?: string
} = {}): string =>
  Array(...Array(length))
    .map(() => alphabet.charAt(Math.floor(Math.random() * alphabet.length)))
    .join('')

export const capitalizeFirstLetter = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

export const lowerCaseFirstLetter = (str: string): string => str.charAt(0).toLowerCase() + str.slice(1)

export const continuousSplit = (str: string, regexes: RegExp[], i = 0): string[] => {
  if (regexes.length === i) {
    return [str]
  }
  return str
    .split(regexes[i])
    .flatMap(st => continuousSplit(st, regexes, i + 1))
    .filter(st => !_.isEmpty(st))
}

export const humanFileSize = (size: number): string => {
  const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024))
  return `${Number(size / 1024 ** i).toFixed(2)} ${['B', 'kB', 'MB', 'GB', 'TB'][i]}`
}

/**
 * Find all matches to the specified regular expression.
 * This is a partial replacement for String.prototype.matchAll which
 * is not currently available in node.
 */
export function* matchAll(str: string, matcher: RegExp): Iterable<RegExpExecArray> {
  if (!matcher.global) {
    throw new Error('matchAll only supports global regular expressions')
  }
  while (true) {
    const match = matcher.exec(str)
    if (match === null) {
      break
    }
    yield match
  }
}

export const isNumberStr = (str: string): boolean => !Number.isNaN(Number(str)) && str !== ''
