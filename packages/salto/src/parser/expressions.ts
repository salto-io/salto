export interface Expression {
	evaluate(): any
}

export class LiteralExpression implements Expression {
	value: any
	constructor(value: any){
		this.value = value
	}

	evaluate(): any {
		return this.value
	}
}

export class TemplateExpression implements Expression {
	expresions: Expression[]
	constructor(expresions: Expression[]){
		this.expresions = expresions
	}

	evaluate(): any {
		return this.expresions.map(e => e.evaluate()).join("")
	}
}

export class ListExpression implements Expression {
	expresions: Expression[]
	constructor(expresions: Expression[]){
		this.expresions = expresions
	}

	evaluate(): any {
		return this.expresions.map(e => e.evaluate())
	}	
}