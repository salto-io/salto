import wu from 'wu'

export const update = <T>(target: Set<T>, source: Iterable<T>): void => {
  wu(source).forEach(target.add.bind(target))
}

export const deleteFrom = <T>(target: Set<T>, source: Iterable<T>): void => {
  wu(source).forEach(target.delete.bind(target))
}
