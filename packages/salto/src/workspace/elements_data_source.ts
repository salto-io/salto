import { Element, ElemID } from 'adapter-api'

export interface ElementsDataSource {
  list(): Promise<ElemID[]>
  get(id: ElemID): Promise<Element>
  getAll(): Promise<Element[]>
  // TODO: updates should be implemented using changes
  set(element: Element | Element[]): Promise<void>
  remove(id: ElemID | ElemID[]): Promise<void>
}
