import { Element, ElemID } from 'adapter-api'

export interface ElementsDataSource {
  list(): Promise<ElemID[]>
  get(id: ElemID): Promise<Element>
  getAll(): Promise<Element[]>
  set(element: Element | Element[]): Promise<void>
  remove(id: ElemID | ElemID[]): Promise<void>
  flush(): Promise<void>
}
