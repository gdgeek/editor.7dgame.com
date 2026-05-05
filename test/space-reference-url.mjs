import assert from 'node:assert/strict';

import {
	SPACE_REFERENCE_VISIBILITY_ACTION,
	buildSpaceReferenceUserData,
	formatSpaceReferenceLabel,
	getSpaceModelUrl,
	normalizeSpaceReferenceVisibility
} from '../plugin-dist/mrpp/SpaceReference.js';
import {
	SPACE_REFERENCE_CONTROL_PARENT_ID
} from '../plugin-dist/ui/SpaceReferenceControl.js';

assert.equal(
	getSpaceModelUrl( {
		id: 7,
		name: 'SLAM Alpha',
		mesh: { url: 'https://example.test/mesh.glb' },
		file: { url: 'https://example.test/runtime.bytes' }
	} ),
	'https://example.test/mesh.glb'
);

assert.equal(
	getSpaceModelUrl( {
		id: 8,
		name: 'SLAM Beta',
		file: { url: 'https://example.test/runtime.glb' }
	} ),
	'https://example.test/runtime.glb'
);

assert.equal( getSpaceModelUrl( null ), '' );

assert.equal(
	SPACE_REFERENCE_VISIBILITY_ACTION,
	'set-space-reference-visible'
);

assert.equal(
	normalizeSpaceReferenceVisibility( { visible: false } ),
	false
);

assert.equal(
	normalizeSpaceReferenceVisibility( { visible: true } ),
	true
);

assert.equal(
	normalizeSpaceReferenceVisibility( {} ),
	true
);

assert.deepEqual(
	buildSpaceReferenceUserData( { foo: 'bar' } ),
	{
		foo: 'bar',
		hidden: true,
		spaceReference: true,
		internalHelper: true
	}
);

assert.equal(
	formatSpaceReferenceLabel( { name: '房间' }, '使用空间' ),
	'使用空间：房间'
);

assert.equal(
	formatSpaceReferenceLabel( { name: '   ' }, '使用空间' ),
	''
);

assert.equal(
	SPACE_REFERENCE_CONTROL_PARENT_ID,
	'toolbar'
);
