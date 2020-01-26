import { ElementsSource } from "../../src/tmp/elements_datasource";
import { Element, ElemID, Change, ChangeDataType } from "adapter-api";
import _ from "lodash";

export class MockElementSource implements ElementsSource {
    public lastChanges?: Change<ChangeDataType>[]
    constructor(private elements: Element[]){}

    async list(): Promise<ElemID[]> {
        return this.elements.map(e => e.elemID)
    }    
    async get(id: ElemID): Promise<Element | undefined> {
        return this.elements.find(e => _.isEqual(e.elemID, id))
    }
    async getAll(): Promise<Element[]> {
        return this.elements
    }
    async has(id: ElemID): Promise<boolean> {
        return  await this.get(id) !== undefined
    }
    async update(changes: Change<ChangeDataType>[]): Promise<void> {
        this.lastChanges = changes
    }
} 