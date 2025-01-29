/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import { stack } from '@salto-io/lowerdash'
import { safe as safeColors } from './colors'
import quickHash, { MIN_HASH, MAX_HASH } from './quickhash'

// Partial of ES6 Module
export type LoggingModule = {
  id: string | number // number when using webpack: https://webpack.js.org/api/module-variables/
}

export type Namespace = string
export type NamespaceFragment = string

export type NamespaceOrModule = Namespace | LoggingModule

const parentDir = (numLevels: number): string => path.normalize(path.join(__dirname, ...Array(numLevels).fill('..')))

const MONOREPO_PACKAGES_DIRNAME = parentDir(3)

const usableNamespaceColors = safeColors.map(c => c.hexString)

type Range = [number, number]

const mapToRange =
  ([sourceMin, sourceMax]: Range, [targetMin, targetMax]: Range) =>
  (n: number): number =>
    ((n - sourceMin) / (sourceMax - sourceMin)) * (targetMax - targetMin) + targetMin

const mapHashRangeToNamespaceColorIndexRange = mapToRange([MIN_HASH, MAX_HASH], [0, usableNamespaceColors.length - 1])

const hashToNamespaceColorIndex = (hash: number): number => Math.floor(mapHashRangeToNamespaceColorIndexRange(hash))

export const toHexColor = (namespace: Namespace): string =>
  usableNamespaceColors[hashToNamespaceColorIndex(quickHash(namespace))]

const fromFilename = (filename: string): Namespace =>
  path
    .relative(MONOREPO_PACKAGES_DIRNAME, filename)
    .replace(/.*:/, '') // remove 'var/task/webpack:' prefix
    .replace(/^\//, '') // remove '/' prefix
    .replace(/dist\/((src)\/)?/, '')
    .replace(/\.[^.]+$/, '') // remove extension
    .replace(/\/{2}/g, '/') // normalize double slashes to single

export type NamespaceNormalizer = (namespace: NamespaceOrModule, namespaceFragments?: NamespaceFragment[]) => Namespace

export const namespaceNormalizer =
  (lastLibraryFilename: string): NamespaceNormalizer =>
  (namespaceOrModule, namespaceFragments) => {
    const uniteNamespaceFragments = (s: NamespaceFragment): Namespace =>
      [s, ...(namespaceFragments || [])].filter(x => x).join('/')

    if (typeof namespaceOrModule === 'string') {
      return uniteNamespaceFragments(namespaceOrModule) // it's an explicit namespace - best case!
    }

    const { id } = namespaceOrModule

    if (typeof id === 'string') {
      // id is the filename
      return uniteNamespaceFragments(fromFilename(id))
    }

    // id is an arbitrary number by webpack, can't use it.
    // try to extract the caller filename instead.
    const callerFilename = stack.extractCallerFilename(new Error(), lastLibraryFilename)

    if (callerFilename !== undefined) {
      return uniteNamespaceFragments(fromFilename(callerFilename))
    }

    // last resort - not very meaningful
    return uniteNamespaceFragments(String(id))
  }
