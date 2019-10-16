import path from 'path'
import { safe as safeColors } from './colors'
import quickHash, { MAX_HASH } from './quickhash'
import { Namespace, NamespaceOrModule, isLoggingModule } from './common.js'

const parentDir = (numLevels: number): string => path.normalize(
  path.join(__dirname, ...Array(numLevels).fill('..'))
)

const MONOREPO_PACKAGES_DIRNAME = parentDir(5)

const usableNamespaceColors = safeColors.map(c => c.hexString)

type Range = [number, number]

const mapToRange = (
  [sourceMin, sourceMax]: Range, [targetMin, targetMax]: Range,
) => (
  n: number
): number => ((n - sourceMin) / (sourceMax - sourceMin)) * (targetMax - targetMin) + targetMin

const mapHashRangeToNamespaceColorIndexRange = mapToRange(
  [0, MAX_HASH], [0, usableNamespaceColors.length - 1]
)

const hashToNamespaceColorIndex = (
  hash: number
): number => Math.floor(mapHashRangeToNamespaceColorIndexRange(hash))

export const toHexColor = (
  namespace: string
): string => usableNamespaceColors[
  hashToNamespaceColorIndex(quickHash(namespace))
]

export const concat = (
  ...namespaces: string[]
): string => namespaces.filter(s => s).join('.')

const fromFilename = (
  filename: string
): Namespace => path.relative(MONOREPO_PACKAGES_DIRNAME, filename)
  .replace(/dist\/((src)|(test)\/)?/, '')
  .replace(/\.[^.]+$/, '') // remove extension

export const normalizeNamespaceOrModule = (
  parentNamespace: string,
  childNamespace: NamespaceOrModule,
): Namespace => (
  isLoggingModule(childNamespace)
    ? fromFilename(childNamespace.filename)
    : concat(parentNamespace, childNamespace as string)
)
