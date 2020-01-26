import { Element, ElemID } from 'adapter-api'

export interface ElementsSource {
  list(): Promise<ElemID[]>
  get(id: ElemID): Promise<Element | Element[]>
  getAll(): Promise<Element[]>
  flush(): Promise<void>
}
