/*
*                      Copyright 2020 Salto Labs Ltd.
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
import path from 'path'
import { safe as safeColors } from './colors'
import quickHash, { MIN_HASH, MAX_HASH } from './quickhash'
// import {  } from './common.js'

// Partial of ES6 Module
export type LoggingModule = {
  id: string
}

export const isLoggingModule = (o: unknown): o is LoggingModule => typeof o === 'object'
  && Object.prototype.hasOwnProperty.call(o, 'id')

export type Namespace = string

export type NamespaceOrModule = Namespace | LoggingModule

const parentDir = (numLevels: number): string => path.normalize(
  path.join(__dirname, ...Array(numLevels).fill('..'))
)

const MONOREPO_PACKAGES_DIRNAME = parentDir(4)

const usableNamespaceColors = safeColors.map(c => c.hexString)

type Range = [number, number]

const mapToRange = (
  [sourceMin, sourceMax]: Range, [targetMin, targetMax]: Range,
) => (
  n: number
): number => ((n - sourceMin) / (sourceMax - sourceMin)) * (targetMax - targetMin) + targetMin

const mapHashRangeToNamespaceColorIndexRange = mapToRange(
  [MIN_HASH, MAX_HASH], [0, usableNamespaceColors.length - 1]
)

const hashToNamespaceColorIndex = (
  hash: number
): number => Math.floor(mapHashRangeToNamespaceColorIndexRange(hash))

export const toHexColor = (
  namespace: Namespace
): string => usableNamespaceColors[
  hashToNamespaceColorIndex(quickHash(namespace))
]

const fromId = (
  id: string
): Namespace => path.relative(MONOREPO_PACKAGES_DIRNAME, id)
  .replace(/dist\/((src)\/)?/, '')
  .replace(/\.[^.]+$/, '') // remove extension
  .replace(/\/{2}/g, '/') // normalize double slashes to single

export const normalizeNamespaceOrModule = (
  namespace: NamespaceOrModule,
): Namespace => (
  isLoggingModule(namespace)
    ? fromId(namespace.id)
    : namespace
)
