import wu from 'wu'

export type SetId = number | string

export const update = <T>(target: Set<T>, source: Iterable<T>): void => {
  wu(source).forEach(target.add.bind(target))
}

export const intersection = <T>(s1: Iterable<T>, s2: Set<T>): Set<T> =>
  new Set<T>(wu(s1).filter(i => s2.has(i)))

export const difference = <T>(s1: Iterable<T>, s2: Set<T>): Set<T> =>
  new Set<T>(wu(s1).filter(i => !s2.has(i)))

export const equals = <T>(s1: Set<T>, s2: Set<T>): boolean =>
  s1.size === s2.size && difference(s1, s2).size === 0
