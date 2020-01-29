import wu from 'wu'
import { SetId } from './set'
import { DefaultMap } from './map'

export const groupBy = <T>(elements: Iterable<T>, groupFunc: (t: T) => SetId): Map<SetId, T[]> => (
  new Map(wu(elements).reduce(
    (groupMap, elem) => { groupMap.get(groupFunc(elem)).push(elem); return groupMap },
    new DefaultMap<SetId, T[]>(() => []),
  ))
)
