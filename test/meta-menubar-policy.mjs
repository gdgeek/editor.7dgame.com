import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
	getMrppAuxiliaryMenuType
} from '../plugin-dist/patches/MenubarPatches.js';

const testDir = dirname( fileURLToPath( import.meta.url ) );
const sourcePath = resolve( testDir, '../plugin/patches/MenubarPatches.ts' );
const source = readFileSync( sourcePath, 'utf8' );

assert.equal(
	getMrppAuxiliaryMenuType( 'meta' ),
	null,
	'Meta editor must not expose the scene menu because entity data has a one-way dependency.'
);

assert.equal( getMrppAuxiliaryMenuType( 'verse' ), 'entity' );
assert.equal( getMrppAuxiliaryMenuType( 'unknown' ), 'screenshot' );

assert.ok(
	! source.includes( "MenubarScene" ) && ! source.includes( "Menubar.Scene" ),
	'MenubarPatches must not import or insert MenubarScene.'
);
