/**
 * Type declarations for three.js/editor/js/libs/ui.js
 *
 * The UI library uses dynamic method generation (UIElement.prototype[method])
 * for CSS property setters and DOM event handlers, which TypeScript cannot infer.
 * This declaration file provides type information for those dynamic methods.
 */

export class UIElement {
	dom: HTMLElement;
	constructor(dom: HTMLElement);
	add(...args: UIElement[]): this;
	remove(...args: UIElement[]): this;
	clear(): this;
	setId(id: string): this;
	getId(): string;
	setClass(name: string): this;
	addClass(name: string): this;
	removeClass(name: string): this;
	setStyle(style: string, args: any): this;
	setDisabled(value: boolean): this;
	setTextContent(value: string): this;
	getIndexOfChild(element: UIElement): number;

	// Dynamic CSS property setters (generated from properties array)
	setPosition(...args: any[]): this;
	setLeft(...args: any[]): this;
	setTop(...args: any[]): this;
	setRight(...args: any[]): this;
	setBottom(...args: any[]): this;
	setWidth(...args: any[]): this;
	setHeight(...args: any[]): this;
	setDisplay(...args: any[]): this;
	setVerticalAlign(...args: any[]): this;
	setOverflow(...args: any[]): this;
	setColor(...args: any[]): this;
	setBackground(...args: any[]): this;
	setBackgroundColor(...args: any[]): this;
	setOpacity(...args: any[]): this;
	setBorder(...args: any[]): this;
	setBorderLeft(...args: any[]): this;
	setBorderTop(...args: any[]): this;
	setBorderRight(...args: any[]): this;
	setBorderBottom(...args: any[]): this;
	setBorderColor(...args: any[]): this;
	setMargin(...args: any[]): this;
	setMarginLeft(...args: any[]): this;
	setMarginTop(...args: any[]): this;
	setMarginRight(...args: any[]): this;
	setMarginBottom(...args: any[]): this;
	setPadding(...args: any[]): this;
	setPaddingLeft(...args: any[]): this;
	setPaddingTop(...args: any[]): this;
	setPaddingRight(...args: any[]): this;
	setPaddingBottom(...args: any[]): this;
	setFontSize(...args: any[]): this;
	setFontWeight(...args: any[]): this;
	setTextAlign(...args: any[]): this;
	setTextDecoration(...args: any[]): this;
	setTextTransform(...args: any[]): this;
	setCursor(...args: any[]): this;
	setZIndex(...args: any[]): this;

	// Dynamic DOM event handlers (generated from events array)
	onKeyUp(callback: Function): this;
	onKeyDown(callback: Function): this;
	onMouseOver(callback: Function): this;
	onMouseOut(callback: Function): this;
	onClick(callback: Function): this;
	onDblClick(callback: Function): this;
	onChange(callback: Function): this;
	onInput(callback: Function): this;
}

export class UISpan extends UIElement {
	constructor();
}

export class UIDiv extends UIElement {
	constructor();
}

export class UIRow extends UIElement {
	constructor();
}

export class UIPanel extends UIElement {
	constructor();
}

export class UIText extends UIElement {
	constructor(text?: string);
	getValue(): string;
	setValue(value: string): this;
}

export class UIInput extends UIElement {
	constructor(text?: string);
	getValue(): string;
	setValue(value: string): this;
}

export class UITextArea extends UIElement {
	constructor();
	getValue(): string;
	setValue(value: string): this;
}

export class UISelect extends UIElement {
	constructor();
	setMultiple(boolean: boolean): this;
	setOptions(options: Record<string, string>): this;
	getValue(): string;
	setValue(value: string): this;
}

export class UICheckbox extends UIElement {
	constructor(boolean?: boolean);
	getValue(): boolean;
	setValue(value: boolean): this;
}

export class UIColor extends UIElement {
	constructor();
	getHexValue(): number;
	getValue(): string;
	setValue(value: string): this;
}

export class UINumber extends UIElement {
	constructor(number?: number);
	getValue(): number;
	setValue(value: number): this;
	setUnit(unit: string): this;
	setPrecision(precision: number): this;
	setStep(step: number): this;
	setNudge(nudge: number): this;
	setRange(min: number, max: number): this;
}

export class UIInteger extends UIElement {
	constructor(number?: number);
	getValue(): number;
	setValue(value: number): this;
	setStep(step: number): this;
	setNudge(nudge: number): this;
	setRange(min: number, max: number): this;
}

export class UIBreak extends UIElement {
	constructor();
}

export class UIHorizontalRule extends UIElement {
	constructor();
}

export class UIButton extends UIElement {
	constructor(value?: string);
}

export class UIProgress extends UIElement {
	constructor(value?: number);
	setValue(value: number): this;
}

export class UITabbedPanel extends UIElement {
	constructor();
	select(id: string): this;
	addTab(id: string, label: string, items: UIElement[]): void;
}

export class UIListbox extends UIElement {
	constructor();
	setItems(items: any[]): this;
	getValue(): any;
	setValue(value: any): this;
}

export class ListboxItem extends UIElement {
	constructor();
}
