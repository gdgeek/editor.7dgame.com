type RecordValue = Record<string, any>;

export const authoringPropertyConstraints = {
	Sound: { loop: 'boolean', play: 'boolean (authored initial playback flag)', volume: [ 0, 1 ], rate: [ 0.25, 4 ] },
	Text: { textMaxLength: 10000, rectMeters: [ 0.01, 10 ], size: [ 8, 200 ], color: '#RRGGBB', horizontal: [ 'left', 'center', 'right' ], vertical: [ 'top', 'middle', 'bottom' ], backgroundOpacity: [ 0, 1 ], follow: 'boolean' }
};

const record = ( value: unknown, label: string ): RecordValue => {
	if ( ! value || typeof value !== 'object' || Array.isArray( value ) ) throw new TypeError( `${ label } 必须是对象` );
	return value as RecordValue;
};
const keys = ( value: RecordValue, allowed: string[], label: string ) => {
	for ( const key of Object.keys( value ) ) if ( ! allowed.includes( key ) ) throw new TypeError( `${ label }.${ key } 不受支持` );
};
const bool = ( value: unknown, label: string ): boolean => {
	if ( typeof value !== 'boolean' ) throw new TypeError( `${ label } 必须是布尔值` );
	return value;
};
const number = ( value: unknown, min: number, max: number, label: string ): number => {
	if ( typeof value !== 'number' || ! Number.isFinite( value ) ) throw new TypeError( `${ label } 必须是有限数字` );
	if ( value < min || value > max ) throw new RangeError( `${ label } 必须在 ${ min } 到 ${ max } 之间` );
	return value;
};
const color = ( value: unknown, label: string ): string => {
	if ( typeof value !== 'string' || ! /^#[0-9a-f]{6}$/i.test( value ) ) throw new TypeError( `${ label } 必须是 #RRGGBB` );
	return value;
};
const enumValue = ( value: unknown, values: string[], label: string ): string => {
	if ( typeof value !== 'string' || ! values.includes( value ) ) throw new TypeError( `${ label } 无效` );
	return value;
};

/** Only actual persisted node fields; this does not promise runtime support. */
export function readAuthoringProperties( type: 'Sound' | 'Text', data: RecordValue ): RecordValue {
	if ( type === 'Sound' ) return { loop: data.loop ?? false, play: data.play ?? false, volume: data.volume ?? 1, rate: data.rate ?? 1 };
	return {
		text: data.text ?? 'Hello World', rect: { x: data.rect?.x ?? 1.28, y: data.rect?.y ?? 0.32 },
		size: data.size ?? 24, color: data.color ?? '#ffffff',
		align: { horizontal: data.align?.horizontal ?? 'center', vertical: data.align?.vertical ?? 'middle' },
		background: { enable: data.background?.enable ?? true, color: data.background?.color ?? '#808080', opacity: data.background?.opacity ?? 0.5 },
		follow: data.follow ?? false
	};
}

/** Merge a validated patch, preserving existing values for every omitted field. */
export function mergeAuthoringProperties( type: 'Sound' | 'Text', current: RecordValue, value: unknown ): RecordValue {
	const patch = record( value, 'properties' );
	const next = readAuthoringProperties( type, current );
	keys( patch, Object.keys( next ), 'properties' );
	if ( type === 'Sound' ) {
		for ( const key of [ 'loop', 'play' ] ) if ( patch[ key ] !== undefined ) next[ key ] = bool( patch[ key ], key );
		if ( patch.volume !== undefined ) next.volume = number( patch.volume, 0, 1, 'volume' );
		if ( patch.rate !== undefined ) next.rate = number( patch.rate, 0.25, 4, 'rate' );
		return next;
	}
	if ( patch.text !== undefined ) {
		if ( typeof patch.text !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test( patch.text ) ) throw new TypeError( 'text 必须是无控制字符的文字（支持换行和制表符）' );
		if ( patch.text.length > 10000 ) throw new RangeError( 'text 不能超过 10000 个字符' );
		next.text = patch.text;
	}
	if ( patch.size !== undefined ) {
		next.size = number( patch.size, 8, 200, 'size' );
		if ( ! Number.isInteger( next.size ) ) throw new RangeError( 'size 必须是整数' );
	}
	if ( patch.color !== undefined ) next.color = color( patch.color, 'color' );
	if ( patch.follow !== undefined ) next.follow = bool( patch.follow, 'follow' );
	if ( patch.rect !== undefined ) {
		const rect = record( patch.rect, 'rect' ); keys( rect, [ 'x', 'y' ], 'rect' );
		for ( const axis of [ 'x', 'y' ] ) if ( rect[ axis ] !== undefined ) next.rect[ axis ] = number( rect[ axis ], 0.01, 10, `rect.${ axis }` );
	}
	if ( patch.align !== undefined ) {
		const align = record( patch.align, 'align' ); keys( align, [ 'horizontal', 'vertical' ], 'align' );
		if ( align.horizontal !== undefined ) next.align.horizontal = enumValue( align.horizontal, [ 'left', 'center', 'right' ], 'align.horizontal' );
		if ( align.vertical !== undefined ) next.align.vertical = enumValue( align.vertical, [ 'top', 'middle', 'bottom' ], 'align.vertical' );
	}
	if ( patch.background !== undefined ) {
		const background = record( patch.background, 'background' ); keys( background, [ 'enable', 'color', 'opacity' ], 'background' );
		if ( background.enable !== undefined ) next.background.enable = bool( background.enable, 'background.enable' );
		if ( background.color !== undefined ) next.background.color = color( background.color, 'background.color' );
		if ( background.opacity !== undefined ) next.background.opacity = number( background.opacity, 0, 1, 'background.opacity' );
	}
	return next;
}
